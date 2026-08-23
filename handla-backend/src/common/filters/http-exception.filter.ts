import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * INFO-01 — Redact public capability tokens from any URL before it is logged or
 * echoed back to a client. The public routes carry the token as the last path
 * segment: `/erp/{invoices,quotations,contracts}/public/token/<TOKEN>` and the
 * legacy quotation route `/erp/quotations/public/<TOKEN>`. If the token is not
 * masked, an invalid-token 404/410 would write the probed token into the app
 * log and the JSON error body. We replace the token segment with [REDACTED].
 *
 * NOTE: reverse-proxy (Traefik) access logs may still record the raw request
 * path — that is out of scope for this application-layer fix and treated as
 * operational residual risk (documented in SECURITY.md).
 */
export function redactPublicToken(url: string): string {
  if (typeof url !== 'string' || url.length === 0) return url;
  // Split off any query string so we only touch the path.
  const [path, ...rest] = url.split('?');
  const suffix = rest.length ? `?${rest.join('?')}` : '';
  const redacted = path
    // /public/token/<token>  → /public/token/[REDACTED]
    .replace(/(\/public\/token\/)[^/]+/gi, '$1[REDACTED]')
    // legacy /quotations/public/<token>[/accept|/reject] → mask the token seg
    .replace(
      /(\/quotations\/public\/)(?!token\/)[^/]+/gi,
      '$1[REDACTED]',
    );
  return redacted + suffix;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;
    // Optional machine-readable error code (e.g. OTP_INVALID, RESEND_COOLDOWN)
    // that the client maps to a localized message. Only ever set for
    // client-fault (4xx) HttpExceptions that deliberately provide it.
    let code: string | undefined;
    let retryAfterSeconds: number | undefined;
    // The full, potentially-sensitive message is always logged, but only
    // surfaced to the client for non-5xx (client-fault) errors.
    let internalMessage = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, any>;
        message = res.message ?? message;
        if (Array.isArray(res.message)) {
          errors = res.message;
          message = 'Validation failed';
        }
        // Preserve app-defined machine-readable fields so the frontend can map
        // them to localized copy. Never leaked for 5xx (see clientMessage).
        if (typeof res.code === 'string') code = res.code;
        if (typeof res.retryAfterSeconds === 'number') retryAfterSeconds = res.retryAfterSeconds;
      }
      internalMessage = Array.isArray(message) ? message.join('; ') : String(message);
    } else if (exception instanceof Error) {
      internalMessage = exception.message;
      // SECURITY: never echo raw runtime/ORM/driver error text to the client
      // in production — it can leak SQL, file paths, stack context, secrets.
      // Client only ever sees the generic 500 message.
      message = isProd ? 'Internal server error' : exception.message;
    }

    // INFO-01 — redact any public capability token from the logged URL.
    const safeUrl = redactPublicToken(request.url);

    this.logger.error(
      `[${request.method}] ${safeUrl} → ${status}: ${internalMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // For any 5xx in production, force a generic message so we never leak
    // server internals even if an HttpException was constructed with a
    // detailed message.
    const clientMessage =
      isProd && status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : message;

    // Only surface the machine-readable code for client-fault (4xx) errors —
    // never for 5xx, to avoid leaking internal failure taxonomy.
    const exposeCode = status < HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      success: false,
      statusCode: status,
      message: clientMessage,
      ...(exposeCode && code ? { code } : {}),
      ...(exposeCode && retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: safeUrl,
    });
  }
}
