const isolatedKeys = [
  'DATABASE_URL',
  'REDIS_URL',
  'AUTH_ISSUER',
  'AUTH_AUDIENCE',
  'AUTH_JWKS_URI',
  'STORAGE_BUCKET',
  'STORAGE_REGION',
  'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'EMAIL_FROM',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_PASSWORD',
  'CORS_ORIGINS',
  'OPENAPI_ENABLED',
  'API_PORT',
  'API_HOST',
  'API_PREFIX',
] as const;

for (const key of isolatedKeys) {
  delete process.env[key];
}

process.env['NODE_ENV'] = 'test';
process.env['STORAGE_DRIVER'] = 'none';
process.env['EMAIL_DRIVER'] = 'none';
process.env['JOBS_DRIVER'] = 'none';
process.env['LOG_LEVEL'] = 'fatal';
