# Repository audit

Date: 2026-10-17.

## What was already in the workspace

The workspace directory `Business -management` contained no files. There was no `package.json`, lockfile, application, Prisma schema, Docker setup, CI workflow, or documented command. There were no existing failures to preserve and no compatible code to reconcile.

This stage therefore creates the foundation in place. It does not replace a previous monorepo.

The machine toolchain used for the work is Node.js 22.20.0, pnpm 10.28.2, and npm 11.8.0.

## Version decisions

| Choice           | Version   | Reason                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript       | 6.0.3     | Newest release accepted by `typescript-eslint` 8.71.2 (`typescript` peer `<6.1.0`). TypeScript 7.0.2 is current on npm and is not used.                                                                                                                                                                                                    |
| NestJS           | 12.1.3    | Current NestJS runtime. `@nestjs/core` allows Node `>= 20`. The Nest CLI is not installed: `@nestjs/cli` 12 pulls `@nestjs/schematics` 12.0.7, which requires Node `^22.22.3`. This machine is Node 22.20.0. The API builds with `tsc` and `apps/api/scripts/rewrite-aliases.mjs`, and local dev uses `tsx`. `tsc-alias` is not installed. |
| Next.js          | 16.4.2    | Current App Router release, with React 19.3.1.                                                                                                                                                                                                                                                                                             |
| Prisma           | 7.10.1    | Latest stable Prisma 7. Prisma 8.0.0-rc is not used.                                                                                                                                                                                                                                                                                       |
| Zod              | 4.6.7     | Request-body schemas. Environment parsing is handwritten so validation errors never include secret values.                                                                                                                                                                                                                                 |
| ESLint           | 10.13.0   | Flat config, shared from `tooling/eslint`.                                                                                                                                                                                                                                                                                                 |
| Vitest           | 5.0.5     | One test runner for the API, web app, and generator.                                                                                                                                                                                                                                                                                       |
| PostgreSQL image | 17-alpine | Local development only.                                                                                                                                                                                                                                                                                                                    |
| Redis image      | 8-alpine  | Local development only. No Redis client is installed yet.                                                                                                                                                                                                                                                                                  |

No major upgrade is pending inside this repository because there was no previous dependency set.

## Structure that was created

- `apps/web` (`@softtech/web`) — Next.js App Router application with a home page.
- `apps/api` (`@softtech/api`) — NestJS process with bootstrap, validated configuration, health, correlation id, request validation, OpenAPI hook, and a Prisma adapter that is not connected at startup.
- `tooling/typescript` (`@softtech/tsconfig`) — strict shared compiler options.
- `tooling/eslint` (`@softtech/eslint-config`) — API and web presets, import sorting, `no-explicit-any`.
- `tooling/scripts` (`@softtech/scripts`) — feature generator.
- `docker-compose.yml`, `docker/api/Dockerfile`, `docker/web/Dockerfile`.
- `.github/workflows/ci.yml`.

`apps/api/src/modules` exists for future capabilities. It does not contain a business module.

## Packages and apps that were not created

| Proposed path                                    | Decision                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `apps/worker`                                    | No background workload exists. `JOBS_DRIVER` is reserved in configuration. A worker process would be an empty app. |
| `packages/ui`, `design-tokens`                   | The web app is a single page. A component library would have no consumer.                                          |
| `packages/api-client`, `contracts`, `validation` | Only the API validates HTTP input today. A shared package waits for the web app to call the API.                   |
| `packages/config`                                | Configuration is process-specific. The API owns it. The web app has no required environment.                       |
| `packages/testing`                               | Each package runs Vitest directly. There is no shared fixture yet.                                                 |
| Redis, S3, SMTP, and queue SDKs                  | Configuration is validated. Adapters arrive when a feature uses them.                                              |

## Backend boundaries

`AppModule` imports configuration and health only. `DatabaseModule` is implemented and tested as a composition unit, and it is not registered. Starting the API does not open PostgreSQL or Redis.

`configureErrorHandling` registers `PlatformExceptionFilter` when that provider is present and still returns the application. Authentication, tenant scope, audit, cache, and metrics are implemented in the platform layer. See `docs/security/tenant-isolation.md`.

The Prisma schema contains the platform tables and `apps/api/prisma/migrations/20261017120000_platform_foundation`. The API connects only when `DATABASE_URL` is set. This workspace does not apply that migration automatically.

Client generation uses a local placeholder URL only inside `apps/api/prisma/generate.mjs` when `DATABASE_URL` is absent. That value is not an application runtime fallback. `prisma.config.ts` reads `DATABASE_URL` as provided.

## Dependency direction

Enforced by `apps/api/.dependency-cruiser.cjs` and `pnpm check:architecture`. The rules are also executed against a temporary fixture in the API unit tests. See [dependency-rules.md](dependency-rules.md).

## Checks

Commands and results are recorded after they are run. See the verification section below.

## Verification

Executed on this machine after the foundation was written. Docker is not installed, so image builds were not run.

| Check                     | Result                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`            | Passed. 502 packages added. Prisma Client 7.10.1 generated. `@scarf/scarf` build script was ignored; it is not required.                                                                                                               |
| `pnpm lint`               | Passed for the API, web, ESLint preset, and scripts packages.                                                                                                                                                                          |
| `pnpm format:check`       | Passed.                                                                                                                                                                                                                                |
| `pnpm typecheck`          | Passed for `@softtech/api`, `@softtech/web`, and `@softtech/scripts`.                                                                                                                                                                  |
| `pnpm test`               | Passed. API 22 tests, web 1 test, generator 3 tests.                                                                                                                                                                                   |
| `pnpm check:architecture` | Passed. 40 modules, 62 dependencies, no violations. The fixture test also passed.                                                                                                                                                      |
| `pnpm build`              | Passed. API emits `apps/api/dist`. Web build produced the `/` and `/_not-found` routes.                                                                                                                                                |
| API process               | `GET /api/v1/health` returned 200 `{"status":"ok"}` with correlation id `req-123`. OpenAPI was off and `/api/docs-json` returned 404. Startup log reported database and Redis as not configured and did not print a connection string. |
| Web process               | `GET /` returned 200 and the HTML contained `Softtech Core`.                                                                                                                                                                           |
| Docker                    | Not run. The `docker` command is not available on this machine.                                                                                                                                                                        |

No pre-existing failures were present. The failures encountered while writing this foundation were fixed before the results above.
