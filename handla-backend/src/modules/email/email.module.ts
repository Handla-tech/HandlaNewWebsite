import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    ConfigModule,

    // ─── Redis connection (shared across all queues in this app) ───────────
    // Using forRootAsync so we can read the Redis URL from ConfigService.
    // When REDIS_URL is set (production), Bull uses that URI directly.
    // Otherwise, it falls back to REDIS_HOST / REDIS_PORT env vars or localhost.
    //
    // Auth (optional, backward-compatible): when REDIS_USERNAME / REDIS_PASSWORD
    // are set, they are passed to ioredis so Bull authenticates against a
    // password-protected / ACL-enabled Redis. When they are unset (e.g. local
    // dev against an open Redis) the connection behaves exactly as before.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        if (redisUrl) {
          return { url: redisUrl };
        }

        const username = configService.get<string>('REDIS_USERNAME');
        const password = configService.get<string>('REDIS_PASSWORD');

        return {
          redis: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
            // Only include auth fields when provided so unauthenticated
            // (dev) Redis keeps working unchanged.
            ...(username ? { username } : {}),
            ...(password ? { password } : {}),
          },
        };
      },
    }),

    // ─── Register the 'email' queue ────────────────────────────────────────
    BullModule.registerQueue({ name: 'email' }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
