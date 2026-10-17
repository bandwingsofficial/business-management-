import { ConflictError, InfrastructureError, NotFoundError } from './application-error';

export function translateDatabaseError(
  error: unknown,
): ConflictError | NotFoundError | InfrastructureError | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  if (code === 'P2002') {
    return new ConflictError();
  }
  if (code === 'P2025') {
    return new NotFoundError();
  }
  if (code === 'P1001' || code === 'P1008' || code === 'P1017') {
    return new InfrastructureError();
  }
  return undefined;
}
