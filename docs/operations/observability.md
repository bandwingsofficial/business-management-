# Observability

## Logs

`StructuredLogger` writes JSON when `NODE_ENV=production` and a single readable line otherwise. Each record has a timestamp, severity, service name, environment, and message. Request id, trace id, and span id are added when the request context has them. HTTP completion records include method, route template, status, and duration. The level comes from `LOG_LEVEL`.

The correlation middleware stores `x-request-id` and a valid `traceparent`. Invalid request ids are replaced. Bodies are not logged. Prisma parameters are not logged because query logging is disabled.

## Error tracking

Sentry starts only when `SENTRY_DSN` is set. The client is `@sentry/node`. Events include the environment and `RELEASE` when present. The filter reports unexpected 500 responses once and skips `NOT_READY`. `beforeSend` removes `authorization` and `cookie` headers. Expected 4xx responses are not reported. With no DSN, the reporter is a no-op and local startup still works.

## Tracing

OpenTelemetry starts only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The exporter posts to `{endpoint}/v1/traces`. Instrumentations are HTTP, PostgreSQL through `pg`, and ioredis. Job payloads can carry `traceId`. The SDK starts during bootstrap, so imports that already happened are not instrumented. Leave the variable unset locally. A collector such as the OpenTelemetry Collector can listen on `http://localhost:4318`.

Spans must not carry tokens, raw SQL parameters, or tenant ids as attributes. The current auto-instrumentation does not add those attributes in application code.

## Metrics

`GET /api/v1/metrics` returns Prometheus text. Counters use method, route, and status. They do not use user or organization ids. Process resident memory is included. The route is public to the JWT guard and then closed by `METRICS_TOKEN`. Without that token the route is 404.

## Health

`GET /api/v1/health` is liveness. It does not touch the database or Redis.

`GET /api/v1/ready` checks configured dependencies with a one-second bound. `not_configured` does not fail readiness. `down` returns 503 `NOT_READY`.

## Alerts that are not configured

No monitoring product is connected by this repository. The following alerts should be created when an operator chooses a backend. Creating this list does not enable them.

- HTTP 5xx ratio above the operator's threshold.
- Readiness failures and process restarts.
- Database health `down` and connection errors.
- Redis command failures and cache failure logs.
- Queue retries and permanent job failures, once business handlers exist.
- Repeated `429` responses on authentication.
- p95 latency of `/api/v1/health` and authenticated routes, measured in that system, not from the local 30-request check.
