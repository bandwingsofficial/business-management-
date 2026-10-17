import type {
  AppConfig,
  AppSettings,
  AuthSettings,
  DatabaseSettings,
  EmailSettings,
  HttpSettings,
  JobsSettings,
  LoggingSettings,
  LogLevelName,
  NodeEnv,
  ObservabilitySettings,
  OpenApiSettings,
  RedisSettings,
  SecuritySettings,
  StorageSettings,
} from './app-config';
import type { EnvSource } from './env-source';
import {
  ConfigurationError,
  EnvErrors,
  readBoolean,
  readBoundedInt,
  readHttpUrl,
  readPort,
  readString,
} from './env-source';

const LOG_LEVELS: readonly LogLevelName[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
const POSTGRES_URL = /^postgres(ql)?:\/\/\S+$/;
const REDIS_URL = /^rediss?:\/\/\S+$/;
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+$/;

function isNodeEnv(value: string): value is NodeEnv {
  return value === 'development' || value === 'test' || value === 'production';
}

function isLogLevel(value: string): value is LogLevelName {
  return LOG_LEVELS.some((level) => level === value);
}

function readApp(source: EnvSource, errors: EnvErrors): AppSettings | undefined {
  const rawEnv = readString(source, 'NODE_ENV');
  if (rawEnv === undefined || !isNodeEnv(rawEnv)) {
    errors.add('NODE_ENV must be development, test, or production');
    return undefined;
  }

  return {
    env: rawEnv,
    name: readString(source, 'APP_NAME') ?? 'Softtech Core',
  };
}

function readHttp(source: EnvSource, errors: EnvErrors, env: NodeEnv | undefined): HttpSettings {
  const corsValue = readString(source, 'CORS_ORIGINS');
  const corsOrigins = corsValue
    ? corsValue
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : env === 'production'
      ? []
      : ['http://localhost:3000'];

  if (corsOrigins.some((origin) => !/^https?:\/\/\S+$/.test(origin))) {
    errors.add('CORS_ORIGINS entries must be http(s) URLs');
  }

  const prefix = readString(source, 'API_PREFIX') ?? 'api';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prefix)) {
    errors.add('API_PREFIX must be a lowercase path segment');
  }

  const defaultVersion = readString(source, 'API_DEFAULT_VERSION') ?? '1';
  if (!/^[0-9]+$/.test(defaultVersion)) {
    errors.add('API_DEFAULT_VERSION must be a positive integer');
  }

  return {
    host: readString(source, 'API_HOST') ?? '0.0.0.0',
    port: readPort(source, 'API_PORT', errors, env === 'production' ? undefined : 3001),
    prefix,
    defaultVersion,
    corsOrigins,
    bodyLimitBytes: readBoundedInt(
      source,
      'HTTP_BODY_LIMIT_BYTES',
      errors,
      1_048_576,
      1024,
      10_485_760,
    ),
    timeoutMs: readBoundedInt(source, 'HTTP_TIMEOUT_MS', errors, 30_000, 1000, 120_000),
    trustProxy: readBoolean(source, 'TRUST_PROXY', errors, false),
    rateLimitWindowSeconds: readBoundedInt(
      source,
      'RATE_LIMIT_WINDOW_SECONDS',
      errors,
      60,
      1,
      3600,
    ),
    rateLimitMax: readBoundedInt(source, 'RATE_LIMIT_MAX', errors, 300, 1, 100_000),
    authRateLimitMax: readBoundedInt(source, 'AUTH_RATE_LIMIT_MAX', errors, 20, 1, 1000),
  };
}

function readDatabase(source: EnvSource, errors: EnvErrors): DatabaseSettings {
  const url = readString(source, 'DATABASE_URL');
  if (url !== undefined && !POSTGRES_URL.test(url)) {
    errors.add('DATABASE_URL must be a postgresql connection string');
  }
  return {
    ...(url === undefined ? {} : { url }),
    poolMax: readBoundedInt(source, 'DATABASE_POOL_MAX', errors, 10, 1, 100),
    connectionTimeoutMs: readBoundedInt(
      source,
      'DATABASE_CONNECT_TIMEOUT_MS',
      errors,
      5_000,
      100,
      60_000,
    ),
    idleTimeoutMs: readBoundedInt(
      source,
      'DATABASE_IDLE_TIMEOUT_MS',
      errors,
      10_000,
      1000,
      600_000,
    ),
    queryTimeoutMs: readBoundedInt(source, 'DATABASE_QUERY_TIMEOUT_MS', errors, 5_000, 100, 60_000),
  };
}

function readRedis(source: EnvSource, errors: EnvErrors): RedisSettings {
  const url = readString(source, 'REDIS_URL');
  if (url !== undefined && !REDIS_URL.test(url)) {
    errors.add('REDIS_URL must be a redis connection string');
  }
  return {
    ...(url === undefined ? {} : { url }),
    connectTimeoutMs: readBoundedInt(
      source,
      'REDIS_CONNECT_TIMEOUT_MS',
      errors,
      2_000,
      100,
      30_000,
    ),
    commandTimeoutMs: readBoundedInt(source, 'REDIS_COMMAND_TIMEOUT_MS', errors, 1_000, 50, 30_000),
    maxRetries: readBoundedInt(source, 'REDIS_MAX_RETRIES', errors, 2, 0, 10),
  };
}

function readAuth(source: EnvSource, errors: EnvErrors): AuthSettings {
  const issuer = readHttpUrl(source, 'AUTH_ISSUER', errors);
  const audience = readString(source, 'AUTH_AUDIENCE');
  const jwksUri = readHttpUrl(source, 'AUTH_JWKS_URI', errors);
  const present = [issuer, audience, jwksUri].filter((value) => value !== undefined).length;
  if (present > 0 && present < 3) {
    errors.add('AUTH_ISSUER, AUTH_AUDIENCE, and AUTH_JWKS_URI must be set together');
  }
  return {
    ...(issuer === undefined ? {} : { issuer }),
    ...(audience === undefined ? {} : { audience }),
    ...(jwksUri === undefined ? {} : { jwksUri }),
  };
}

function readSecurity(source: EnvSource, errors: EnvErrors): SecuritySettings {
  return {
    helmetEnabled: readBoolean(source, 'HELMET_ENABLED', errors, true),
  };
}

function readLogging(source: EnvSource, errors: EnvErrors): LoggingSettings {
  const value = readString(source, 'LOG_LEVEL') ?? 'info';
  if (!isLogLevel(value)) {
    errors.add('LOG_LEVEL must be fatal, error, warn, info, debug, or trace');
    return { level: 'info' };
  }
  return { level: value };
}

function readStorage(source: EnvSource, errors: EnvErrors): StorageSettings {
  const driver = readString(source, 'STORAGE_DRIVER') ?? 'none';
  if (driver !== 'none' && driver !== 's3') {
    errors.add('STORAGE_DRIVER must be none or s3');
    return { driver: 'none' };
  }

  const bucket = readString(source, 'STORAGE_BUCKET');
  const region = readString(source, 'STORAGE_REGION');
  const endpoint = readHttpUrl(source, 'STORAGE_ENDPOINT', errors);
  const accessKeyId = readString(source, 'STORAGE_ACCESS_KEY_ID');
  const secretAccessKey = readString(source, 'STORAGE_SECRET_ACCESS_KEY');

  if (driver === 's3') {
    if ((readString(source, 'NODE_ENV') ?? 'development') === 'production') {
      errors.add('STORAGE_DRIVER=s3 is not implemented and cannot be selected in production');
    }
    if (bucket === undefined) {
      errors.add('STORAGE_BUCKET is required when STORAGE_DRIVER is s3');
    }
    if (region === undefined) {
      errors.add('STORAGE_REGION is required when STORAGE_DRIVER is s3');
    }
  }

  return {
    driver,
    ...(bucket === undefined ? {} : { bucket }),
    ...(region === undefined ? {} : { region }),
    ...(endpoint === undefined ? {} : { endpoint }),
    ...(accessKeyId === undefined ? {} : { accessKeyId }),
    ...(secretAccessKey === undefined ? {} : { secretAccessKey }),
  };
}

function readEmail(source: EnvSource, errors: EnvErrors): EmailSettings {
  const driver = readString(source, 'EMAIL_DRIVER') ?? 'none';
  if (driver !== 'none' && driver !== 'smtp') {
    errors.add('EMAIL_DRIVER must be none or smtp');
    return { driver: 'none' };
  }

  const from = readString(source, 'EMAIL_FROM');
  const host = readString(source, 'EMAIL_HOST');
  const port = readString(source, 'EMAIL_PORT');
  const password = readString(source, 'EMAIL_PASSWORD');

  if (from !== undefined && !EMAIL_ADDRESS.test(from)) {
    errors.add('EMAIL_FROM must be an email address');
  }

  let parsedPort: number | undefined;
  if (port !== undefined) {
    parsedPort = readPort(source, 'EMAIL_PORT', errors, undefined);
  }

  if (driver === 'smtp') {
    if (from === undefined) {
      errors.add('EMAIL_FROM is required when EMAIL_DRIVER is smtp');
    }
    if (host === undefined) {
      errors.add('EMAIL_HOST is required when EMAIL_DRIVER is smtp');
    }
    if (port === undefined) {
      errors.add('EMAIL_PORT is required when EMAIL_DRIVER is smtp');
    }
  }

  return {
    driver,
    ...(from === undefined ? {} : { from }),
    ...(host === undefined ? {} : { host }),
    ...(parsedPort === undefined ? {} : { port: parsedPort }),
    ...(password === undefined ? {} : { password }),
  };
}

function readJobs(
  source: EnvSource,
  errors: EnvErrors,
  redisUrl: string | undefined,
): JobsSettings {
  const driver = readString(source, 'JOBS_DRIVER') ?? 'none';
  if (driver !== 'none' && driver !== 'redis') {
    errors.add('JOBS_DRIVER must be none or redis');
    return { driver: 'none' };
  }
  if (driver === 'redis' && (readString(source, 'NODE_ENV') ?? 'development') === 'production') {
    errors.add(
      'JOBS_DRIVER=redis cannot be selected in production because outbox delivery is not running',
    );
  }
  if (driver === 'redis' && redisUrl === undefined) {
    errors.add('REDIS_URL is required when JOBS_DRIVER is redis');
  }
  return { driver };
}

function readObservability(source: EnvSource, errors: EnvErrors): ObservabilitySettings {
  const otlpEndpoint = readHttpUrl(source, 'OTEL_EXPORTER_OTLP_ENDPOINT', errors);
  const sentryDsn = readHttpUrl(source, 'SENTRY_DSN', errors);
  const release = readString(source, 'RELEASE');
  const metricsToken = readString(source, 'METRICS_TOKEN');
  if (metricsToken !== undefined && metricsToken.length < 16) {
    errors.add('METRICS_TOKEN must be at least 16 characters when set');
  }
  return {
    ...(otlpEndpoint === undefined ? {} : { otlpEndpoint }),
    ...(sentryDsn === undefined ? {} : { sentryDsn }),
    ...(release === undefined ? {} : { release }),
    ...(metricsToken === undefined ? {} : { metricsToken }),
  };
}

function readOpenApi(
  source: EnvSource,
  errors: EnvErrors,
  app: AppSettings | undefined,
): OpenApiSettings {
  return {
    enabled: readBoolean(source, 'OPENAPI_ENABLED', errors, app?.env === 'development'),
    title: readString(source, 'OPENAPI_TITLE') ?? app?.name ?? 'Softtech Core',
    description: readString(source, 'OPENAPI_DESCRIPTION') ?? 'Softtech Core HTTP API',
  };
}

export function loadEnv(source: EnvSource = process.env): AppConfig {
  const errors = new EnvErrors();
  const app = readApp(source, errors);
  const redis = readRedis(source, errors);
  const config = {
    app,
    http: readHttp(source, errors, app?.env),
    database: readDatabase(source, errors),
    redis,
    auth: readAuth(source, errors),
    security: readSecurity(source, errors),
    logging: readLogging(source, errors),
    storage: readStorage(source, errors),
    email: readEmail(source, errors),
    jobs: readJobs(source, errors, redis.url),
    openapi: readOpenApi(source, errors, app),
    observability: readObservability(source, errors),
  };

  if (!config.app || errors.list().length > 0) {
    throw new ConfigurationError(errors.list());
  }

  return {
    app: config.app,
    http: config.http,
    database: config.database,
    redis: config.redis,
    auth: config.auth,
    security: config.security,
    logging: config.logging,
    storage: config.storage,
    email: config.email,
    jobs: config.jobs,
    openapi: config.openapi,
    observability: config.observability,
  };
}
