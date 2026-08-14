import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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
      }
      internalMessage = Array.isArray(message) ? message.join('; ') : String(message);
    } else if (exception instanceof Error) {
      internalMessage = exception.message;
      // SECURITY: never echo raw runtime/ORM/driver error text to the client
      // in production — it can leak SQL, file paths, stack context, secrets.
      // Client only ever sees the generic 500 message.
      message = isProd ? 'Internal server error' : exception.message;
    }

    this.logger.error(
      `[${request.method}] ${request.url} → ${status}: ${internalMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // For any 5xx in production, force a generic message so we never leak
    // server internals even if an HttpException was constructed with a
    // detailed message.
    const clientMessage =
      isProd && status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : message;

    response.status(status).json({
      success: false,
      statusCode: status,
      message: clientMessage,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
