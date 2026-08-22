import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();
    const statusCode = response.statusCode;

    // CACHE-01 — every API response is dynamic, per-user, cookie-authenticated
    // JSON. Mark it non-cacheable so no shared/intermediary/browser cache can
    // ever serve one user's authenticated payload to another (web cache
    // poisoning / cross-user cache leakage). `Vary: Cookie, Authorization`
    // additionally keys any private cache on the credential.
    if (response.setHeader) {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Vary', 'Cookie, Authorization');
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode,
        message: data?.message ?? 'Success',
        data: data?.data !== undefined ? data.data : data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
