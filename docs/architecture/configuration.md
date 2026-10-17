# Configuration

The API reads environment variables in `apps/api/src/configs/load-env.ts`. Invalid configuration throws `ConfigurationError` before the process listens. Error text names the variable and the rule. It does not include the supplied value.

`apps/api/src/bootstrap/load-local-env.ts` loads `apps/api/.env` and then the repository `.env` for local runs. Variables already set in the process environment win. Package `.env` wins over the repository `.env`. `NODE_ENV=test` skips file loading. Tests pass an explicit object to `loadEnv` or rely on `apps/api/vitest.setup.ts`.

Create `.env` with `pnpm env:setup` at the repository root. That command copies `.env.example` only when `.env` does not already exist. Integration tests use `.env.integration.example` and `pnpm env:setup:integration`; see [testing strategy](../testing/testing-strategy.md). Templates contain dummy values, not production credentials.

## Required

| Variable   | Rule                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| `NODE_ENV` | `development`, `test`, or `production`                                                       |
| `API_PORT` | Required in production. Defaults to `3001` in development and test. Integer from 1 to 65535. |

## Defaults that are not secrets

| Variable              | Default                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `APP_NAME`            | `Softtech Core`                                                                       |
| `API_HOST`            | `0.0.0.0`                                                                             |
| `API_PREFIX`          | `api`                                                                                 |
| `API_DEFAULT_VERSION` | `1`                                                                                   |
| `LOG_LEVEL`           | `info`                                                                                |
| `HELMET_ENABLED`      | `true`                                                                                |
| `CORS_ORIGINS`        | `http://localhost:3000` except in production, where the default is no browser origins |
| `OPENAPI_ENABLED`     | `true` in development, `false` otherwise                                              |
| `STORAGE_DRIVER`      | `none`                                                                                |
| `EMAIL_DRIVER`        | `none`                                                                                |
| `JOBS_DRIVER`         | `none`                                                                                |

The API Docker image sets `API_HOST` and `API_PORT` so the container can bind. It does not bake database or Redis credentials.

## Optional until an adapter is enabled

| Variable                                             | When it is required                                                                                                                                      | Format                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`                                       | Optional at boot. When set, the API connects Prisma on startup.                                                                                          | `postgresql://` or `postgres://`                           |
| `REDIS_URL`                                          | Optional at boot. Required when `JOBS_DRIVER=redis` outside production. Production rejects `JOBS_DRIVER=redis`. When set, the auth rate limit is shared. | `redis://` or `rediss://`                                  |
| `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI`      | Optional. All three are required together. Protected routes reject tokens when unset.                                                                    | Issuer and JWKS must be `http(s)` URLs.                    |
| `STORAGE_BUCKET`, `STORAGE_REGION`                   | Required when `STORAGE_DRIVER=s3` outside production. Production rejects `STORAGE_DRIVER=s3`.                                                            | Non-empty strings.                                         |
| `STORAGE_ENDPOINT`                                   | Optional.                                                                                                                                                | `http(s)` URL.                                             |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Optional. No object-storage SDK is installed.                                                                                                            | Redacted in logs.                                          |
| `EMAIL_FROM`, `EMAIL_HOST`, `EMAIL_PORT`             | Required when `EMAIL_DRIVER=smtp`.                                                                                                                       | Address, host, and port.                                   |
| `EMAIL_PASSWORD`                                     | Optional.                                                                                                                                                | Redacted in logs.                                          |
| `OPENAPI_TITLE`, `OPENAPI_DESCRIPTION`               | Optional.                                                                                                                                                | Fall back to the application name and a fixed description. |

Blank values are treated as unset. A present but malformed `DATABASE_URL` fails startup even though this stage does not connect.

## Logging

Startup logs a summary from `formatStartupSummary`. Connection strings are reported as `configured` or `not-configured`. `redactSecrets` masks object keys named `url` and keys that look like secrets, for any later debug dump. Do not log `process.env`.

## Prisma CLI

`pnpm prisma:generate` runs `apps/api/prisma/generate.mjs`. If `DATABASE_URL` is unset, that script sets a localhost placeholder for the Prisma CLI only. Application code never reads that placeholder. Schema changes ship as SQL in `apps/api/prisma/migrations`. Apply them with `prisma migrate deploy` against an isolated database. Do not use `db push` or `migrate reset` against a shared database.

## Web

`apps/web` has no required environment variables. It does not call the API during build or render.
