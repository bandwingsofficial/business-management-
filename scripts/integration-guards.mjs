const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const INTEGRATION_DATABASE_NAME = 'softtech_test';
const INTEGRATION_REDIS_DB = '15';

function describeHost(hostname) {
  return hostname.length > 0 ? hostname : '(empty host)';
}

export function validateIntegrationDatabaseUrl(url) {
  if (url === undefined || url.length === 0) {
    return {
      ok: false,
      code: 'missing',
      message:
        'INTEGRATION_DATABASE_URL is required. Set it in .env.integration to a local softtech_test database. DATABASE_URL is not a substitute.',
    };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      code: 'invalid',
      message: 'INTEGRATION_DATABASE_URL is not a valid URL.',
    };
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return {
      ok: false,
      code: 'invalid',
      message: 'INTEGRATION_DATABASE_URL must use the postgresql:// or postgres:// scheme.',
    };
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    return {
      ok: false,
      code: 'unsafe',
      message: `Refusing INTEGRATION_DATABASE_URL: host ${describeHost(parsed.hostname)} is not allowed. Use localhost or 127.0.0.1.`,
    };
  }

  const databaseName = parsed.pathname.replace(/^\//u, '');
  if (databaseName !== INTEGRATION_DATABASE_NAME) {
    return {
      ok: false,
      code: 'unsafe',
      message: `Refusing INTEGRATION_DATABASE_URL: database must be ${INTEGRATION_DATABASE_NAME}, not ${databaseName.length > 0 ? databaseName : '(empty)'}.`,
    };
  }

  return {
    ok: true,
    code: 'valid',
    message: 'INTEGRATION_DATABASE_URL format and target are allowed.',
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 5432,
    database: databaseName,
  };
}

export function validateIntegrationRedisUrl(url) {
  if (url === undefined || url.length === 0) {
    return {
      ok: false,
      code: 'missing',
      message:
        'INTEGRATION_REDIS_URL is required. Set it in .env.integration to a local Redis URL with database index 15. REDIS_URL is not a substitute.',
    };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      code: 'invalid',
      message: 'INTEGRATION_REDIS_URL is not a valid URL.',
    };
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    return {
      ok: false,
      code: 'invalid',
      message: 'INTEGRATION_REDIS_URL must use the redis:// or rediss:// scheme.',
    };
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    return {
      ok: false,
      code: 'unsafe',
      message: `Refusing INTEGRATION_REDIS_URL: host ${describeHost(parsed.hostname)} is not allowed. Use localhost or 127.0.0.1.`,
    };
  }

  const index = parsed.pathname.replace(/^\//u, '');
  if (index !== INTEGRATION_REDIS_DB) {
    return {
      ok: false,
      code: 'unsafe',
      message: `Refusing INTEGRATION_REDIS_URL: Redis database index must be ${INTEGRATION_REDIS_DB}, not ${index.length > 0 ? index : '(empty)'}.`,
    };
  }

  return {
    ok: true,
    code: 'valid',
    message: 'INTEGRATION_REDIS_URL format and Redis index are allowed.',
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 6379,
    databaseIndex: index,
  };
}
