import {
  validateIntegrationDatabaseUrl as validateDatabaseGuard,
  validateIntegrationRedisUrl as validateRedisGuard,
} from '../../../../scripts/integration-guards.mjs';

export function validateIntegrationDatabaseUrl(url: string | undefined): string {
  const result = validateDatabaseGuard(url);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return url as string;
}

export function validateIntegrationRedisUrl(url: string | undefined): string {
  const result = validateRedisGuard(url);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return url as string;
}
