import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

import { StructuredLogger } from '@/common/logging/structured-logger';
import { MetricsRegistry } from '@/platform/observability/metrics';

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  public constructor(
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(MetricsRegistry) private readonly metrics: MetricsRegistry,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const route = request.route as { path?: string } | undefined;
    const path = route?.path ?? 'unmatched';
    return next.handle().pipe(
      tap(() => {
        this.finish(request.method, path, response.statusCode, started);
      }),
    );
  }

  private finish(method: string, route: string, status: number, started: number): void {
    const durationMs = Date.now() - started;
    this.metrics.increment('http_requests_total', { method, route, status: String(status) });
    if (status >= 500) {
      this.metrics.increment('http_errors_total', { method, route });
    }
    this.logger.record(status >= 500 ? 'error' : 'info', 'request completed', {
      method,
      route,
      status,
      durationMs,
    });
  }
}
