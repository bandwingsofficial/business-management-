# Softtech Core

Commercial multi-tenant business management platform. This repository is the modular-monolith foundation: a Next.js web app, a NestJS API, shared TypeScript and ESLint config, and the architectural rules later modules must follow.

Business modules such as CRM, projects, and finance are not part of this stage.

## Prerequisites

- Node.js 22
- pnpm 10.28.2 (`corepack enable` uses the `packageManager` field)
- Docker, when you want local PostgreSQL and Redis

## Setup

```bash
pnpm install
pnpm env:setup
```

`pnpm env:setup` copies `.env.example` to `.env` only when `.env` does not exist. It does not overwrite your file or start any services.

Unit tests and `pnpm dev:api` do not need PostgreSQL, Redis, or third-party credentials. Edit `.env` after setup so local values match your machine. See [configuration](docs/architecture/configuration.md) and [testing strategy](docs/testing/testing-strategy.md) for integration-test templates.

## Commands

| Command                                          | What it does                                               |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `pnpm dev:web`                                   | Next.js app on port 3000                                   |
| `pnpm dev:api`                                   | NestJS API on port 3001                                    |
| `pnpm lint`                                      | ESLint in every workspace package                          |
| `pnpm format:check`                              | Prettier check                                             |
| `pnpm typecheck`                                 | TypeScript in every package                                |
| `pnpm test`                                      | Unit and API end-to-end tests                              |
| `pnpm test:unit`                                 | Unit tests                                                 |
| `pnpm test:e2e`                                  | API HTTP tests                                             |
| `pnpm env:setup`                                 | Create `.env` from `.env.example` if missing               |
| `pnpm env:setup:integration`                     | Create `.env.integration` from template if missing         |
| `pnpm env:check`                                 | Strict infrastructure diagnostic (Redis must be reachable) |
| `pnpm env:check:checkpoint`                      | Env diagnostic; Redis may show DEFERRED                    |
| `pnpm verify:foundation`                         | Foundation checkpoint without live Redis                   |
| `pnpm verify:infrastructure`                     | Full integration path (Postgres + Redis + tests)           |
| `pnpm db:migrate:status` / `db:migrate:deploy`   | Prisma against verified `softtech_test` from integration   |
| `pnpm test:integration`                          | Migration and Redis tests. Needs the test compose stack.   |
| `pnpm test:coverage`                             | API coverage for unit and end-to-end tests                 |
| `pnpm audit:deps`                                | Review high dependency advisories                          |
| `pnpm scan:secrets`                              | Scan tracked files for key material                        |
| `pnpm build`                                     | API and web production builds                              |
| `pnpm check:architecture`                        | Dependency boundary check for the API                      |
| `pnpm prisma:generate`                           | Generate the Prisma client                                 |
| `pnpm generate:module -- --name <kebab-name>`    | Scaffold a future API module                               |
| `docker compose -f docker-compose.dev.yml up -d` | Local PostgreSQL 17 and Redis 8 on localhost               |

Generated modules land in `apps/api/src/modules/<name>`. Add `--command <action>` or `--query <action>` when the module needs a use case. The generator does not register the module in `AppModule`.

## Layout

- `apps/web` — Next.js App Router client
- `apps/api` — NestJS modular monolith
- `tooling/typescript` — shared `tsconfig`
- `tooling/eslint` — shared ESLint presets
- `tooling/scripts` — module generator
- `docker` — API and web images
- `docs/architecture` — audit, dependency rules, feature template, configuration

`packages/ui`, `api-client`, `contracts`, and a worker app are intentionally absent until a second consumer or a real background workload exists.

## Further reading

- [Repository audit](docs/architecture/repository-audit.md)
- [Dependency rules](docs/architecture/dependency-rules.md)
- [Feature template](docs/architecture/feature-template.md)
- [Configuration](docs/architecture/configuration.md)
- [Overview](docs/architecture/overview.md)
- [Testing](docs/testing/testing-strategy.md)
- [Local development](docs/operations/local-development.md)
- [Docker and release](docs/deployment/docker-and-release.md)
