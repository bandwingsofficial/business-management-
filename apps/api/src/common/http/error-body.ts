import type { ErrorDetail } from '@/common/errors/application-error';

export interface ErrorBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details: readonly ErrorDetail[];
}

export function createErrorBody(input: {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: readonly ErrorDetail[];
}): ErrorBody {
  return {
    statusCode: input.statusCode,
    code: input.code,
    message: input.message,
    requestId: input.requestId,
    details: input.details ?? [],
  };
}
