import { describe, expect, it } from 'vitest';

import { validateIntegrationDatabaseUrl, validateIntegrationRedisUrl } from './integration-env';

describe('integration environment guards', () => {
  it('accepts the local disposable database and redis index', () => {
    expect(
      validateIntegrationDatabaseUrl('postgresql://softtech:softtech@127.0.0.1:5433/softtech_test'),
    ).toContain('softtech_test');
    expect(validateIntegrationRedisUrl('redis://127.0.0.1:6380/15')).toContain('/15');
    expect(
      validateIntegrationDatabaseUrl('postgresql://softtech:softtech@localhost:5432/softtech_test'),
    ).toContain('softtech_test');
    expect(
      validateIntegrationDatabaseUrl('postgresql://postgres:secret@127.0.0.1:5432/softtech_test'),
    ).toContain('softtech_test');
  });

  it('requires integration variables and rejects application substitutes', () => {
    expect(() => validateIntegrationDatabaseUrl(undefined)).toThrow(/INTEGRATION_DATABASE_URL/);
    expect(() => validateIntegrationDatabaseUrl(undefined)).toThrow(
      /DATABASE_URL is not a substitute/,
    );
    expect(() => validateIntegrationRedisUrl(undefined)).toThrow(/INTEGRATION_REDIS_URL/);
    expect(() => validateIntegrationRedisUrl(undefined)).toThrow(/REDIS_URL is not a substitute/);
  });

  it('refuses remote or wrong-name database targets without echoing credentials', () => {
    expect(() =>
      validateIntegrationDatabaseUrl('postgresql://user:secret@db.example.com:5432/softtech_test'),
    ).toThrow(/host db.example.com is not allowed/);
    expect(() =>
      validateIntegrationDatabaseUrl('postgresql://user:secret@127.0.0.1:5432/softtech'),
    ).toThrow(/database must be softtech_test/);
    expect(() =>
      validateIntegrationDatabaseUrl('postgresql://user:secret@127.0.0.1:5432/softtech'),
    ).not.toThrow(/secret/);
  });

  it('refuses non-local or wrong-index redis targets', () => {
    expect(() => validateIntegrationRedisUrl('redis://cache.example.com:6379/15')).toThrow(
      /host cache.example.com is not allowed/,
    );
    expect(() => validateIntegrationRedisUrl('redis://127.0.0.1:6379/0')).toThrow(
      /database index must be 15/,
    );
  });
});
