# Testing strategy

The repository uses Vitest. Jest is not installed. API tests are split so a missing database does not hide a unit failure and a unit run does not pretend to be an integration run.

| Script                       | What it runs                                   | External services                                    |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| `pnpm verify:foundation`     | Foundation checkpoint (see below)              | Local PostgreSQL `softtech_test`; Redis **deferred** |
| `pnpm verify:infrastructure` | Strict `env:check` + `test:integration`        | PostgreSQL `softtech_test` and Redis index `15`      |
| `pnpm test:unit`             | API unit specs, web specs, generator specs     | None                                                 |
| `pnpm test:e2e`              | API HTTP specs in `*.e2e.spec.ts`              | None                                                 |
| `pnpm test`                  | Unit and end-to-end suites in every package    | None                                                 |
| `pnpm env:check:checkpoint`  | Env diagnostic; Redis may be **DEFERRED**      | `.env.integration` for PostgreSQL checks             |
| `pnpm env:check`             | Strict infrastructure diagnostic               | PostgreSQL and Redis must be reachable               |
| `pnpm test:integration`      | `platform.integration.spec.ts`                 | Local `softtech_test` Postgres and Redis database 15 |
| `pnpm test:coverage`         | Unit and end-to-end API specs with V8 coverage | None                                                 |

## Foundation checkpoint vs full infrastructure verification

**Foundation checkpoint** (`pnpm verify:foundation`) is the current development gate. It runs formatting, lint, typecheck, unit tests, API E2E tests, architecture rules, builds, security audits, PostgreSQL verification, and Prisma migrate status. Redis is fully configured in `.env.integration`, but live Redis checks are reported as **DEFERRED** when the service is not running. DEFERRED is not PASS and does not claim Redis integration works.

**Full infrastructure verification** (`pnpm verify:infrastructure`) requires Redis. It runs strict `pnpm env:check` (Redis unreachable = **FAIL**) and `pnpm test:integration`, which exercises Redis cache TTL, prefix invalidation, and related platform integration behavior. Docker image builds remain a separate `docker build` or CI `images` job.

Production readiness is **not** granted when only the foundation checkpoint passes.

### Redis deferred work

Redis integration is configured but postponed until a Redis server is available:

- Set `INTEGRATION_REDIS_URL` (for example `redis://127.0.0.1:6380/15` with Docker test compose, or `redis://127.0.0.1:6379/15` for a local install).
- Start Redis, then run `pnpm env:check` (strict) and `pnpm verify:infrastructure` or `pnpm test:integration`.

Unit tests still cover shared rate limiting and job behavior without live Redis; those are not substitutes for `platform.integration.spec.ts`.

`apps/api/vitest.setup.ts` clears database, Redis, and credential variables before unit and end-to-end tests. The integration config uses `vitest.integration.setup.ts` and does not clear `INTEGRATION_DATABASE_URL` or `INTEGRATION_REDIS_URL`. The API never reads `INTEGRATION_*` variables during normal startup.

## Environment files (setup is not verification)

Creating templates and `.env` files does **not** run migrations, start Docker, or prove integration tests pass. It only prepares configuration you can edit safely.

| File                       | Tracked in Git | Purpose                                                                   |
| -------------------------- | -------------- | ------------------------------------------------------------------------- |
| `.env.example`             | Yes            | Dummy defaults for local API development (`pnpm env:setup` → `.env`).     |
| `.env.integration.example` | Yes            | Dummy URLs for disposable integration services only.                      |
| `.env`                     | No             | Your local API configuration.                                             |
| `.env.integration`         | No             | Your local integration-test URLs. Loaded only by `pnpm test:integration`. |

**Application vs integration connections**

- `DATABASE_URL` — PostgreSQL for the running API when you choose to connect it.
- `INTEGRATION_DATABASE_URL` — disposable `softtech_test` database for `pnpm test:integration` only.
- `REDIS_URL` — Redis for the running API when you choose to connect it.
- `INTEGRATION_REDIS_URL` — isolated Redis database index `15` for integration tests only.

The test runner refuses remote hosts, wrong database names, and wrong Redis indexes. Error messages name the problem without printing passwords or full connection strings.

### Windows PowerShell workflow

Run these from the repository root (`Business -management`).

**1. Install and create `.env` without overwriting your file**

```powershell
pnpm install
pnpm env:setup
```

If `.env` already exists, the command leaves it unchanged and tells you to edit it.

**2. Edit local API settings**

Open `.env` in your editor. For a minimal API start without PostgreSQL or Redis, keep `DATABASE_URL` and `REDIS_URL` commented out. Unit tests and `pnpm dev:api` do not need them.

**3. Create integration-test configuration**

```powershell
pnpm env:setup:integration
```

This copies `.env.integration.example` to `.env.integration` only when `.env.integration` does not exist. Edit `.env.integration` with your local credentials. Use URL-encoded passwords when special characters appear in the password (for example `@` as `%40`). Never commit `.env.integration`.

Example for pgAdmin / native PostgreSQL on port `5432`:

```text
INTEGRATION_DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/softtech_test
```

**4. Check configuration (inspect only — no migrations)**

```powershell
pnpm env:check:checkpoint
```

During foundation work, use the checkpoint diagnostic. Redis shows **DEFERRED** when it is configured but not running. Use strict `pnpm env:check` before full infrastructure verification.

Reports use **PASS**, **FAIL**, **DEFERRED**, and **NOT RUN**. Passwords and full connection strings are never printed.

**5. PostgreSQL: verify and migrate (modifies `softtech_test` only when deploy runs)**

These commands read `INTEGRATION_DATABASE_URL` from `.env.integration`, validate host/database name, and map it to `DATABASE_URL` only inside the Prisma child process:

```powershell
pnpm db:verify-postgres
pnpm db:migrate:status
pnpm db:migrate:deploy
```

`db:migrate:deploy` applies pending SQL to the verified disposable database. Do not run it against any database other than `softtech_test` on localhost.

**6. Redis (required for integration tests)**

PostgreSQL and pgAdmin do not provide Redis. Integration tests require a local Redis with database index `15`.

- **With Docker Desktop:** `docker compose -f docker-compose.test.yml up -d` then use `INTEGRATION_REDIS_URL=redis://127.0.0.1:6380/15` (default in the template).
- **Without Docker:** install a local Redis-compatible server (for example Memurai) and use `INTEGRATION_REDIS_URL=redis://127.0.0.1:6379/15`.

Run `pnpm env:check` again. The Redis port must show **reachable** before integration tests can pass.

**7. Run integration tests (modifies test data inside `softtech_test` and Redis db 15)**

```powershell
pnpm test:integration
```

Loads only `INTEGRATION_*` keys from `.env.integration`, validates targets, checks TCP ports, then runs the API integration suite. It does not substitute `DATABASE_URL` or `REDIS_URL` from `.env`.

**8. Build Docker images (when Docker is installed)**

```powershell
docker build -f docker/api/Dockerfile -t softtech-api:local .
docker build -f docker/web/Dockerfile -t softtech-web:local .
```

Pass runtime environment variables when you start containers. Do not bake secrets into images.

**9. Stop test services**

```powershell
docker compose -f docker-compose.test.yml down
```

Add `-v` only when you intend to delete the test volume `postgres_test_data`.

### Troubleshooting

| Symptom                                | Likely cause                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `INTEGRATION_DATABASE_URL is required` | Test services not started or `.env.integration` missing. Run step 4 and/or step 3.    |
| `host … is not allowed`                | URL targets a remote or non-local host. Use `127.0.0.1` or `localhost`.               |
| `database must be softtech_test`       | Wrong database name in the URL path.                                                  |
| `Redis database index must be 15`      | URL path must be `/15`.                                                               |
| Connection refused on `5433` or `6380` | `docker compose -f docker-compose.test.yml up -d` not running or still starting.      |
| Redis not reachable at `6380`          | Start Docker test Redis, or install local Redis and use port `6379` with index `/15`. |
| PostgreSQL login failed                | URL-encode the password; confirm user `postgres` and database `softtech_test`.        |
| `docker` not recognized                | Install Docker Desktop for test Redis, or use a local Redis on port `6379`.           |

## What the suites cover

Unit tests cover configuration parsing, pagination bounds, error translation, redaction, cache keys, job retry and idempotency, authorization decisions, storage signatures, and the dependency-cruiser fixture.

End-to-end tests boot the Nest application in process and call the existing routes: health, readiness, validation, the error contract, correlation ids, missing credentials, forged organizations, revoked membership, permission denial, cross-tenant audit and storage, metrics hiding, OpenAPI when enabled, and a 30-request liveness timing check.

Integration tests deploy the platform migration to the named test database, check a cross-tenant audit read, a unique membership conflict, transaction rollback of an outbox row, and Redis expiration and prefix invalidation. They truncate only after the host and database-name guards pass. They never call `migrate reset`.

## Coverage

`pnpm test:coverage` writes `apps/api/coverage`. Generated Prisma code and spec files are excluded from the measured set. Application and platform source stay included. A measured run on this workspace reported statements 71.2% (648/910), branches 69.19% (438/633), functions 67.46% (168/249), and lines 71.14% (641/901). The thresholds in `apps/api/vitest.coverage.config.mts` are 68, 65, 64, and 68. They sit just under that measurement so a drop fails the command. They are not a claim that every future module is tested. Bootstrap, the JWKS client, SMTP, and the telemetry startup path stay outside the unit process because they need a live listener or a configured provider.

## Tenant tests required for the next module

Every tenant-owned endpoint added later must test:

- a missing credential
- a forged organization id
- a missing permission
- another organization's record id
- a cache key or file from another organization
- a background job whose scope does not own the resource

The current platform tests do not extend to endpoints that do not exist yet.

## Commands that are not separate tools

There is no Playwright suite and no k6 suite. The liveness timing check is an in-process bound of 1000 ms for 30 sequential requests. It is not a production capacity result.

## Infrastructure verification

This section records attempts to run PostgreSQL migration, Redis integration, Docker images, and full CI on a machine where application checks already pass.

### Safeguards in code

`validateIntegrationDatabaseUrl` accepts only `localhost`, `127.0.0.1`, or `::1` with database name `softtech_test`. `validateIntegrationRedisUrl` accepts only those hosts with Redis database index `15`. The integration suite runs `prisma migrate deploy` with `DATABASE_URL` set to the integration URL only inside the child process. It truncates platform tables and calls `FLUSHDB` on the configured Redis index after those guards pass. It never runs `migrate reset`.

Local test services are defined in `docker-compose.test.yml`: PostgreSQL `softtech_test` on `127.0.0.1:5433`, Redis on `127.0.0.1:6380` with database index `15` in the URL (`redis://127.0.0.1:6380/15`). CI uses the same database name and Redis index on the default service ports (`5432` and `6379`).

### What the integration suite exercises

When services are available, `platform.integration.spec.ts` checks:

- `migrate deploy` against a fresh `softtech_test` database.
- Cross-tenant audit isolation at the database layer.
- Membership unique constraint mapping to `RESOURCE_CONFLICT`.
- Outbox row rollback when the enclosing transaction function throws, and commit when it succeeds.
- Redis cache TTL expiration and tenant-scoped prefix invalidation.

It does not start `RedisJobQueue` or poll `outbox_messages` for publication. Shared auth rate limiting through Redis is covered in unit tests (`access-controls.spec.ts`), not in this integration file. Job retry and idempotency are covered in `job-dispatcher.spec.ts`.

### Local run (when Docker is installed)

```bash
docker compose -f docker-compose.test.yml up -d
# wait until postgres and redis healthchecks pass
export INTEGRATION_DATABASE_URL=postgresql://softtech:softtech@127.0.0.1:5433/softtech_test
export INTEGRATION_REDIS_URL=redis://127.0.0.1:6380/15
pnpm test:integration
docker compose -f docker-compose.test.yml down
```

On Windows PowerShell, set `$env:INTEGRATION_DATABASE_URL` and `$env:INTEGRATION_REDIS_URL` instead of `export`.

Do not point integration variables at the process on port `5432` unless you have verified that instance is a disposable `softtech_test` database dedicated to tests.

### Verification attempt on 2026-10-17 (Prompt 5)

| Step                    | Result             | Evidence                                                                                                                                                                                                                                                                 |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git status              | Not applicable     | `git status` returned `fatal: not a git repository`. Existing files were not reset or committed.                                                                                                                                                                         |
| Docker CLI              | Blocked            | `docker` is not on PATH. WSL is present but has no installed distribution.                                                                                                                                                                                               |
| Test Postgres/Redis     | Not started        | Ports `5433` and `6380` were closed. Port `5432` was open; its identity was not verified, so it was not used.                                                                                                                                                            |
| `pnpm test:integration` | Failed closed      | Suite aborted before tests: `INTEGRATION_DATABASE_URL is required`.                                                                                                                                                                                                      |
| Migration SQL vs schema | Static review only | One migration creates `organizations`, `user_accounts`, `memberships`, `audit_events`, `revoked_credentials`, `outbox_messages`, and `stored_objects` with the expected uniques, indexes, and `ON DELETE RESTRICT` foreign keys. Live `migrate deploy` was not executed. |
| Docker image build      | Not run            | Requires the Docker CLI.                                                                                                                                                                                                                                                 |
| Full CI                 | Not run            | No git remote, `gh` CLI, or Cursor Origin namespace available from this workspace. `.github/workflows/ci.yml` defines `verify`, `integration`, and `images` jobs for when the repository is pushed to GitHub.                                                            |

Until Docker or CI runs the integration and image jobs, PostgreSQL migration behavior, Redis integration behavior, and container runtime behavior remain unverified on this machine.
