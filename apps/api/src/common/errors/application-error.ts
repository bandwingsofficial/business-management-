export interface ErrorDetail {
  readonly path: string;
  readonly message: string;
}

export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly errorDetails: readonly ErrorDetail[];

  public constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Readonly<Record<string, string>>,
    statusCode = 500,
    errorDetails: readonly ErrorDetail[] = [],
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorDetails = errorDetails;
  }
}

export class ValidationError extends ApplicationError {
  public constructor(errorDetails: readonly ErrorDetail[]) {
    super('VALIDATION_ERROR', 'The request is invalid.', undefined, 422, errorDetails);
  }
}

export class AuthenticationError extends ApplicationError {
  public constructor() {
    super('AUTHENTICATION_REQUIRED', 'Authentication is required.', undefined, 401);
  }
}

export class AuthorizationError extends ApplicationError {
  public constructor(code: 'ORGANIZATION_REQUIRED' | 'MEMBERSHIP_DENIED' | 'PERMISSION_DENIED') {
    super(code, 'The request is not permitted.', undefined, 403);
  }
}

export class NotFoundError extends ApplicationError {
  public constructor() {
    super('RESOURCE_NOT_FOUND', 'The requested resource was not found.', undefined, 404);
  }
}

export class ConflictError extends ApplicationError {
  public constructor() {
    super(
      'RESOURCE_CONFLICT',
      'The requested operation conflicts with existing data.',
      undefined,
      409,
    );
  }
}

export class PayloadTooLargeError extends ApplicationError {
  public constructor() {
    super('PAYLOAD_TOO_LARGE', 'The request body exceeds the configured limit.', undefined, 413);
  }
}

export class RateLimitError extends ApplicationError {
  public constructor(public readonly retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many requests.', undefined, 429);
  }
}

export class ExternalProviderError extends ApplicationError {
  public constructor() {
    super('EXTERNAL_PROVIDER_FAILURE', 'An external service failed.', undefined, 502);
  }
}

export class InfrastructureError extends ApplicationError {
  public constructor(code = 'INFRASTRUCTURE_UNAVAILABLE') {
    super(code, 'A required service is unavailable.', undefined, 503);
  }
}
