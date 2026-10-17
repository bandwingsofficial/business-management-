# Environment configuration

Run `pnpm env:setup` to create `.env` from `.env.example` when `.env` is missing. Run `pnpm env:setup:integration` for `.env.integration` from `.env.integration.example`. Do not commit `.env` or `.env.integration`.

Verification workflows:

- `pnpm env:check:checkpoint` or `pnpm verify:foundation` — foundation checkpoint while Redis is not running. Redis port checks show **DEFERRED**, not PASS.
- `pnpm env:check` — strict infrastructure diagnostic. Unreachable Redis is **FAIL**.
- `pnpm verify:infrastructure` — runs strict `env:check` and `pnpm test:integration`. Required before claiming full infrastructure verification.

Passwords and full connection URLs are never printed. Tests clear database, Redis, auth, storage, and email variables in `apps/api/vitest.setup.ts` and do not need cloud credentials.

**Do not confuse application and integration URLs.** `DATABASE_URL` and `REDIS_URL` configure the running API. `INTEGRATION_DATABASE_URL` and `INTEGRATION_REDIS_URL` configure disposable test services only. The integration runner never substitutes one for the other.

## Always

`NODE_ENV` is required. Production also requires `API_PORT`. See `docs/architecture/configuration.md` for the full variable table.

## HTTP

`HTTP_BODY_LIMIT_BYTES` defaults to 1 MiB and must be between 1 KiB and 10 MiB. `HTTP_TIMEOUT_MS` defaults to 30 seconds. `TRUST_PROXY` defaults to false. Set it only behind one reverse proxy. `AUTH_RATE_LIMIT_MAX` defaults to 20 per `RATE_LIMIT_WINDOW_SECONDS`. With `REDIS_URL`, that limit is shared. Without it, each API process has its own counter. Do not run more than one API replica unless Redis is configured.

## Data stores

Leave `DATABASE_URL` and `REDIS_URL` unset to boot the API without those processes. Integration tests use different variables, `INTEGRATION_DATABASE_URL` and `INTEGRATION_REDIS_URL`, and only accept a local database named `softtech_test` and Redis index 15. Readiness then reports `not_configured` and stays successful. When a URL is set, the process connects at startup and readiness reports `up` or `down`. A down dependency returns 503. The body names the dependency and the status. It does not include the host or password.

Pool and Redis timeout variables have bounded defaults. Redis retries stop after `REDIS_MAX_RETRIES`.

## Authentication

Set `AUTH_ISSUER`, `AUTH_AUDIENCE`, and `AUTH_JWKS_URI` together, or leave all three unset. Unset means protected routes return 401.

## Optional providers

| Variable                      | Effect when set                                                                                        | Effect when unset                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Exports traces to `{endpoint}/v1/traces`                                                               | Tracing stays off                                    |
| `SENTRY_DSN`                  | Initializes Sentry and reports unexpected 500s                                                         | Errors are logged only                               |
| `RELEASE`                     | Sent as the Sentry release when Sentry is on                                                           | Omitted                                              |
| `METRICS_TOKEN`               | Protects `GET /api/v1/metrics`                                                                         | The route returns 404                                |
| `EMAIL_DRIVER=smtp`           | Sends through nodemailer                                                                               | `DisabledEmailSender` throws `EMAIL_UNAVAILABLE`     |
| `STORAGE_DRIVER=s3`           | Rejected in production. Development still parses the shape, and runtime storage refuses the operation. | `DisabledObjectStorage` throws `STORAGE_UNAVAILABLE` |
| `JOBS_DRIVER=redis`           | Rejected in production. Development requires `REDIS_URL` and does not start a dispatcher.              | No Redis job loop starts                             |

`STORAGE_DRIVER=s3` is not an S3 integration. No object-storage SDK is installed. Production startup fails if that driver is selected. `JOBS_DRIVER=redis` does not publish outbox rows. Production startup fails if it is selected. Outbox rows that a future caller inserts are committed only with the database transaction. Nothing in this foundation polls them or publishes them to Redis. Delivery is at-least-once only after a dispatcher exists, and it is not exactly-once.
