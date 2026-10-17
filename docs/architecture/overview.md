# Architecture overview

Softtech Core is a pnpm workspace with two applications and no business modules.

- `apps/web` is a Next.js App Router client. It renders a static home page and does not call the API during build.
- `apps/api` is a NestJS modular monolith. Platform code owns health, authentication primitives, tenant scope, audit, cache, jobs, storage, and email ports.
- `tooling/typescript` and `tooling/eslint` hold the shared compiler and lint presets.
- `tooling/scripts` holds the module generator.

There is no `packages/` directory and no worker application. Background jobs, when `JOBS_DRIVER=redis`, run inside the API process.

## Request path

HTTP enters through Nest. A global guard verifies a bearer token and an active organization membership before a protected controller runs. Controllers call platform ports. Prisma and Redis stay in infrastructure. The public error body is produced by one exception filter.

Domain and application code for a future module must not import Nest, Prisma, Redis, or a provider SDK. The rules and the automated check are in `docs/architecture/dependency-rules.md`.

## Data

PostgreSQL is the source of truth. Redis is a cache and a job list. The first migration creates platform tables only. Applying it is a separate command from generating the Prisma client.

## Runtime

The API listens on `API_HOST` and `API_PORT`. Liveness is `GET /api/v1/health`. Readiness is `GET /api/v1/ready`. Shutdown hooks disconnect Prisma and Redis when those clients were started.
