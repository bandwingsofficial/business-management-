import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  ApplicationError,
  type ErrorDetail,
  PayloadTooLargeError,
} from '@/common/errors/application-error';
import { translateDatabaseError } from '@/common/errors/translate-database-error';
import { createErrorBody } from '@/common/http/error-body';
import { requestContext } from '@/common/http/request-context';
import { StructuredLogger } from '@/common/logging/structured-logger';
import { ErrorReporter } from '@/platform/observability/error-reporter';
import { MetricsRegistry } from '@/platform/observability/metrics';

@Catch()
export class PlatformExceptionFilter implements ExceptionFilter {
  public constructor(
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(MetricsRegistry) private readonly metrics: MetricsRegistry,
    @Inject(ErrorReporter) private readonly reporter: ErrorReporter,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = requestContext.current()?.requestId ?? 'unknown';
    const mapped = mapException(exception);
    this.metrics.increment('http_requests_total', { status: String(mapped.statusCode) });
    this.logger.record(mapped.statusCode >= 500 ? 'error' : 'warn', 'request failed', {
      code: mapped.code,
      statusCode: mapped.statusCode,
    });
    if (mapped.statusCode >= 500 && mapped.code !== 'NOT_READY') {
      this.reporter.capture(exception, requestId);
    }
    if (!response.headersSent) {
      response.status(mapped.statusCode).json(
        createErrorBody({
          statusCode: mapped.statusCode,
          code: mapped.code,
          message: mapped.message,
          requestId,
          details: mapped.details,
        }),
      );
    }
  }
}

function mapException(exception: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details: readonly ErrorDetail[];
} {
  if (isPayloadTooLarge(exception)) {
    const error = new PayloadTooLargeError();
    return { statusCode: error.statusCode, code: error.code, message: error.message, details: [] };
  }
  const databaseError = translateDatabaseError(exception);
  if (databaseError) {
    return {
      statusCode: databaseError.statusCode,
      code: databaseError.code,
      message: databaseError.message,
      details: databaseError.errorDetails,
    };
  }
  if (exception instanceof ApplicationError) {
    return {
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
      details: exception.errorDetails,
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      statusCode: status,
      code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'HTTP_ERROR',
      message: status >= 500 ? 'The request could not be completed.' : exception.message,
      details: [],
    };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'The request could not be completed.',
    details: [],
  };
}

function isPayloadTooLarge(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  const candidate = exception as { status?: number; statusCode?: number; type?: string };
  return (
    candidate.type === 'entity.too.large' ||
    candidate.status === 413 ||
    candidate.statusCode === 413
  );
}
