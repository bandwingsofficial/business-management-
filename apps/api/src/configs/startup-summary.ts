import type { AppConfig } from './app-config';

export function formatStartupSummary(config: AppConfig): string {
  return [
    `env=${config.app.env}`,
    `name=${config.app.name}`,
    `host=${config.http.host}`,
    `port=${String(config.http.port)}`,
    `prefix=${config.http.prefix}`,
    `openapi=${String(config.openapi.enabled)}`,
    `database=${config.database.url === undefined ? 'not-configured' : 'configured'}`,
    `redis=${config.redis.url === undefined ? 'not-configured' : 'configured'}`,
    `rateLimit=${config.redis.url === undefined ? 'process-local' : 'shared'}`,
    `storage=${config.storage.driver}`,
    `email=${config.email.driver}`,
    `jobs=${config.jobs.driver === 'redis' ? 'redis-not-dispatched' : config.jobs.driver}`,
    `auth=${config.auth.jwksUri === undefined ? 'not-configured' : 'jwks'}`,
    `sentry=${config.observability.sentryDsn === undefined ? 'not-configured' : 'configured'}`,
    `otlp=${config.observability.otlpEndpoint === undefined ? 'not-configured' : 'configured'}`,
    `metrics=${config.observability.metricsToken === undefined ? 'disabled' : 'protected'}`,
  ].join(' ');
}
