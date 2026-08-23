import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DataSource } from 'typeorm';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { globalValidationPipe } from './common/pipes/validation.pipe';
import { JwtAuthGuard } from './common/guards/jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OwnershipGuard } from './common/guards/ownership.guard';

/**
 * Idempotent schema patch: adds the archive/disable columns to the `users`
 * table if they don't already exist.  Runs before the application starts
 * serving requests so every query can safely reference these columns.
 *
 * MySQL does not support `ADD COLUMN IF NOT EXISTS` directly, so we check
 * information_schema first and only run the ALTER when needed.
 */
async function applyUserArchiveColumns(dataSource: DataSource): Promise<void> {
  const log = new Logger('SchemaPatch');
  try {
    const db = await dataSource.query('SELECT DATABASE() AS db').then((r: Array<{ db: string }>) => r[0]?.db ?? '');

    const existing: Array<{ COLUMN_NAME: string }> = await dataSource.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('is_archived', 'archived_at', 'is_disabled')`,
      [db],
    );
    const found = existing.map(r => r.COLUMN_NAME);

    const alterParts: string[] = [];
    if (!found.includes('is_archived')) alterParts.push('ADD COLUMN `is_archived` TINYINT(1) NOT NULL DEFAULT 0');
    if (!found.includes('archived_at')) alterParts.push('ADD COLUMN `archived_at` DATETIME NULL DEFAULT NULL');
    if (!found.includes('is_disabled')) alterParts.push('ADD COLUMN `is_disabled` TINYINT(1) NOT NULL DEFAULT 0');

    if (alterParts.length > 0) {
      await dataSource.query(`ALTER TABLE \`users\` ${alterParts.join(', ')}`);
      log.log(`Added missing columns to users table: ${alterParts.map(p => p.split('`')[1]).join(', ')}`);
    } else {
      log.log('users archive/disable columns already present — skipping patch');
    }

    // Safety: ensure no ADMIN account is accidentally archived or disabled.
    // Admins cannot archive themselves via the UI (controller guards prevent
    // it), but bad test data or direct DB edits could leave admins locked out.
    const fixed = await dataSource.query(
      `UPDATE \`users\` SET is_archived = 0, archived_at = NULL, is_disabled = 0
       WHERE role = 'ADMIN' AND (is_archived = 1 OR is_disabled = 1)`
    );
    const fixedCount = (fixed as { affectedRows?: number })?.affectedRows ?? 0;
    if (fixedCount > 0) {
      log.warn(`Auto-restored ${fixedCount} ADMIN account(s) that had is_archived=1 or is_disabled=1`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Schema patch failed: ${msg}`);
  }
}

/**
 * Idempotent schema patch: adds email-verification / OAuth-provider columns to
 * `users`, backfills existing users as verified (so they aren't locked out),
 * and creates the `email_verifications` table. Mirrors the migration
 * AddEmailVerificationAndProvider so dev environments without a migration run
 * still get the schema. Safe to run repeatedly.
 */
async function applyAuthVerificationSchema(dataSource: DataSource): Promise<void> {
  const log = new Logger('SchemaPatch');
  try {
    const db = await dataSource
      .query('SELECT DATABASE() AS db')
      .then((r: Array<{ db: string }>) => r[0]?.db ?? '');

    const existing: Array<{ COLUMN_NAME: string }> = await dataSource.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('email_verified_at', 'provider', 'provider_id')`,
      [db],
    );
    const found = existing.map((r) => r.COLUMN_NAME);

    if (!found.includes('email_verified_at')) {
      await dataSource.query(
        "ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME NULL DEFAULT NULL",
      );
      // Backfill legacy users as verified so the new "must verify" rule does
      // not lock out anyone who signed up before OTP existed.
      await dataSource.query(
        'UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL',
      );
      log.log('Added users.email_verified_at (+ backfilled existing users as verified)');
    }
    if (!found.includes('provider')) {
      await dataSource.query("ALTER TABLE `users` ADD COLUMN `provider` VARCHAR(32) NULL DEFAULT NULL");
    }
    if (!found.includes('provider_id')) {
      await dataSource.query("ALTER TABLE `users` ADD COLUMN `provider_id` VARCHAR(255) NULL DEFAULT NULL");
    }

    // password_hash must be nullable for Google-only accounts.
    await dataSource
      .query("ALTER TABLE `users` MODIFY COLUMN `password_hash` VARCHAR(255) NULL DEFAULT NULL")
      .catch(() => undefined);

    const evExists: Array<{ TABLE_NAME: string }> = await dataSource.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'email_verifications'`,
      [db],
    );
    if (evExists.length === 0) {
      await dataSource.query(`
        CREATE TABLE \`email_verifications\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`email\` VARCHAR(255) NOT NULL,
          \`user_id\` VARCHAR(36) NULL DEFAULT NULL,
          \`code_hash\` VARCHAR(255) NOT NULL,
          \`purpose\` ENUM('SIGNUP','LOGIN','GOOGLE','PASSWORD_RESET') NOT NULL,
          \`payload\` TEXT NULL DEFAULT NULL,
          \`attempt_count\` INT NOT NULL DEFAULT 0,
          \`expires_at\` DATETIME NOT NULL,
          \`consumed_at\` DATETIME NULL DEFAULT NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          INDEX \`idx_email_verifications_lookup\` (\`email\`, \`purpose\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      log.log('Created email_verifications table');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Auth verification schema patch failed: ${msg}`);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const corsOriginEnv = configService.get<string>('SOCKET_CORS_ORIGIN') || 'http://localhost:3000';
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  // ─── Fail-fast on insecure production configuration ─────────────────────────
  // In production we must NEVER boot with the built-in development fallback
  // secrets (they are public in the repo). Refuse to start rather than run
  // with a trivially-forgeable JWT signing key.
  if (nodeEnv === 'production') {
    const bootLog = new Logger('Bootstrap');
    const jwtSecret = configService.get<string>('jwt.secret');
    const refreshSecret = configService.get<string>('jwt.refreshSecret');
    const insecure = [
      ['JWT_SECRET', jwtSecret, 'dev_secret_change_in_prod'],
      ['JWT_REFRESH_SECRET', refreshSecret, 'dev_refresh_secret_change_in_prod'],
    ].filter(([, value, fallback]) => !value || value === fallback || String(value).length < 32);

    if (insecure.length > 0) {
      const names = insecure.map(([n]) => n).join(', ');
      bootLog.error(
        `FATAL: refusing to start in production with missing/weak secrets: ${names}. ` +
          `Set strong (>=32 char) unique values in the environment.`,
      );
      process.exit(1);
    }

    if (!process.env.SAAS_INTERNAL_CALLBACK_SECRET) {
      bootLog.warn(
        'SAAS_INTERNAL_CALLBACK_SECRET is not set — product provisioning callbacks will be rejected (fail-closed).',
      );
    }
  }

  // In development, accept any localhost port (3000–3010) so the frontend
  // can run on whatever port Next.js picks (3000, 3001, 3002, …)
  const corsOrigin =
    nodeEnv !== 'production'
      ? (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          if (!origin || /^http:\/\/localhost:(3\d{3}|[1-9]\d{3})$/.test(origin)) {
            cb(null, true);
          } else {
            cb(new Error(`CORS: origin ${origin} not allowed`));
          }
        }
      : corsOriginEnv;

  // ─── Logger ─────────────────────────────────────────────────────────────────
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // ─── Security ───────────────────────────────────────────────────────────────
  const isProd = nodeEnv === 'production';
  app.use(
    helmet({
      // CSP is disabled in dev because it interferes with the Swagger UI assets;
      // enabled with a conservative policy in production.
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              connectSrc: ["'self'", 'https:', 'wss:'],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: isProd,
      // Strict-Transport-Security: force HTTPS for a year (incl. subdomains).
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Hide the Express fingerprint header.
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance?.();
  if (instance?.disable) instance.disable('x-powered-by');

  // ─── Reverse-proxy / client-IP trust (rate-limit correctness + anti-spoof) ──
  //
  // Production topology (deploy/nginx/conf.d/handla.conf + docker-compose):
  //   client → nginx (TLS, container `nginx`) → NestJS (`api:3001`)
  // i.e. EXACTLY ONE trusted proxy hop. nginx sets:
  //   X-Forwarded-For $proxy_add_x_forwarded_for   (appends the real $remote_addr)
  //   X-Real-IP       $remote_addr
  //
  // Without `trust proxy`, Express reports req.ip = the nginx *container* IP for
  // EVERY visitor, so @nestjs/throttler would key all traffic into ONE bucket
  // (every visitor throttled as a single IP). Setting `trust proxy` too loosely
  // (e.g. `true`) would do the opposite — blindly trust a client-supplied
  // X-Forwarded-For and let an attacker rotate spoofed IPs to escape throttling.
  //
  // The correct model is a NUMERIC HOP COUNT: trust exactly the number of
  // proxies we actually operate (default 1 = nginx). Express then takes the
  // (n+1)-th-from-the-right XFF entry as the client IP; any extra entries an
  // attacker prepends are to the LEFT and are ignored. Never trust more hops
  // than you control. Override via TRUST_PROXY_HOPS only if you add another
  // trusted layer in front of nginx (e.g. Cloudflare → set 2 AND ensure that
  // edge overwrites XFF). Set to 0 to disable (direct-to-Node, no proxy).
  const trustProxyHops = parseInt(
    configService.get<string>('TRUST_PROXY_HOPS') ?? '1',
    10,
  );
  if (instance?.set) {
    instance.set('trust proxy', Number.isFinite(trustProxyHops) ? trustProxyHops : 1);
  }

  // ─── Response compression ───────────────────────────────────────────────────
  app.use(compression());

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // ─── Cookie Parser ──────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ─── Body size limits (mitigate large-payload DoS) ──────────────────────────
  // Explicit 1 MB cap on JSON / urlencoded bodies. Endpoints that legitimately
  // accept larger uploads should use dedicated multipart handling, not the
  // JSON body parser.
  const bodyLimit = configService.get<string>('BODY_LIMIT') || '1mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // ─── Global Prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  // Ensures OnApplicationShutdown hooks (e.g. the SaaS ProvisioningWorker
  // interval, DB pool) are cleaned up on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // ─── Global Pipes, Filters, Interceptors, Guards ────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector),
    new OwnershipGuard(reflector),
  );

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Handla API')
      .setDescription('Handla Software Services Marketing Platform API')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .addTag('auth', 'Authentication endpoints')
      .addTag('chat', 'Chat & conversations')
      .addTag('notifications', 'In-app notifications')
      .addTag('testimonials', 'Testimonials (public + admin CRUD)')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    Logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }

  // ─── Schema patch: ensure archive/disable columns exist ────────────────────
  const dataSource = app.get(DataSource);
  await applyUserArchiveColumns(dataSource);
  await applyAuthVerificationSchema(dataSource);

  await app.listen(port);
  Logger.log(`🚀 Handla API running on http://localhost:${port}/api`);
  Logger.log(`🌍 Environment: ${nodeEnv}`);
}

bootstrap();
