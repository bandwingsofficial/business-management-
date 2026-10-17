import { describe, expect, it } from 'vitest';

import { ConfigurationError } from './env-source';
import { loadEnv } from './load-env';
import { formatStartupSummary } from './startup-summary';

const SECRET = 'super-secret-password';

describe('loadEnv', () => {
  it('applies local defaults without infrastructure credentials', () => {
    const config = loadEnv({ NODE_ENV: 'development' });

    expect(config.app).toEqual({ name: 'Softtech Core', env: 'development' });
    expect(config.http.port).toBe(3001);
    expect(config.http.prefix).toBe('api');
    expect(config.http.corsOrigins).toEqual(['http://localhost:3000']);
    expect(config.database.url).toBeUndefined();
    expect(config.redis.url).toBeUndefined();
    expect(config.openapi.enabled).toBe(true);
    expect(config.security.helmetEnabled).toBe(true);
    expect(config.storage.driver).toBe('none');
    expect(config.email.driver).toBe('none');
    expect(config.jobs.driver).toBe('none');
  });

  it('treats blank credential values as unset', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: '   ',
      REDIS_URL: '',
    });

    expect(config.database.url).toBeUndefined();
    expect(config.redis.url).toBeUndefined();
    expect(config.openapi.enabled).toBe(false);
    expect(config.http.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('requires an explicit port in production and keeps unused services optional', () => {
    const config = loadEnv({ NODE_ENV: 'production', API_PORT: '4000' });

    expect(config.http.port).toBe(4000);
    expect(config.http.corsOrigins).toEqual([]);
    expect(config.openapi.enabled).toBe(false);
    expect(config.database.url).toBeUndefined();
  });

  it('rejects invalid production configuration without echoing secret values', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: `postgresql://softtech:${SECRET}@db.internal:5432/softtech`,
        REDIS_URL: 'not-a-url',
      }),
    ).toThrow(ConfigurationError);

    try {
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: `postgresql://softtech:${SECRET}@db.internal:5432/softtech wrong`,
        API_PORT: '0',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).not.toContain(SECRET);
      expect((error as Error).message).toContain('API_PORT');
      expect((error as Error).message).toContain('DATABASE_URL');
    }
  });

  it('requires issuer, audience, and jwks together', () => {
    expect(() => loadEnv({ NODE_ENV: 'test', AUTH_ISSUER: 'https://auth.example.com' })).toThrow(
      /AUTH_ISSUER, AUTH_AUDIENCE, and AUTH_JWKS_URI/,
    );
  });

  it('requires the settings for a selected driver', () => {
    expect(() => loadEnv({ NODE_ENV: 'test', JOBS_DRIVER: 'redis' })).toThrow(
      /REDIS_URL is required/,
    );
    expect(() => loadEnv({ NODE_ENV: 'test', STORAGE_DRIVER: 's3' })).toThrow(/STORAGE_BUCKET/);
    expect(() =>
      loadEnv({ NODE_ENV: 'test', EMAIL_DRIVER: 'smtp', EMAIL_FROM: 'person@example.com' }),
    ).toThrow(/EMAIL_HOST/);
  });

  it('accepts a complete optional integration configuration', () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://softtech:softtech@localhost:5432/softtech',
      REDIS_URL: 'redis://localhost:6379',
      JOBS_DRIVER: 'redis',
      STORAGE_DRIVER: 's3',
      STORAGE_BUCKET: 'files',
      STORAGE_REGION: 'us-east-1',
      STORAGE_SECRET_ACCESS_KEY: SECRET,
      EMAIL_DRIVER: 'smtp',
      EMAIL_FROM: 'noreply@example.com',
      EMAIL_HOST: 'localhost',
      EMAIL_PORT: '1025',
      AUTH_ISSUER: 'https://auth.example.com',
      AUTH_AUDIENCE: 'softtech-api',
      AUTH_JWKS_URI: 'https://auth.example.com/jwks',
    });

    expect(config.jobs.driver).toBe('redis');
    expect(config.storage.bucket).toBe('files');
    expect(config.email.port).toBe(1025);
    expect(config.auth.audience).toBe('softtech-api');
    expect(formatStartupSummary(config)).not.toContain(SECRET);
    expect(formatStartupSummary(config)).not.toContain('postgresql://');
    expect(formatStartupSummary(config)).toContain('database=configured');
    expect(formatStartupSummary(config)).toContain('jobs=redis-not-dispatched');
    expect(formatStartupSummary(config)).toContain('rateLimit=shared');
  });

  it('rejects unimplemented production drivers', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        API_PORT: '3001',
        STORAGE_DRIVER: 's3',
        STORAGE_BUCKET: 'files',
        STORAGE_REGION: 'us-east-1',
      }),
    ).toThrow(/STORAGE_DRIVER=s3 is not implemented/);
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        API_PORT: '3001',
        REDIS_URL: 'redis://localhost:6379',
        JOBS_DRIVER: 'redis',
      }),
    ).toThrow(/outbox delivery is not running/);
  });
});
