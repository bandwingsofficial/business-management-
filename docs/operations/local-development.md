# Local development

## Start the applications

```bash
pnpm install
pnpm env:setup
pnpm dev:web
pnpm dev:api
```

The web app uses port 3000. The API uses port 3001 when `API_PORT` is unset and `NODE_ENV` is development. Unit tests and the API process start without PostgreSQL or Redis.

## Start local data services

Docker is required for these commands. They publish PostgreSQL and Redis on the loopback interface only.

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs
docker compose -f docker-compose.dev.yml stop
```

`docker compose up -d` uses `docker-compose.yml`, which defines the same development services and the same `postgres_data` volume.

Stop and keep the development volume:

```bash
docker compose -f docker-compose.dev.yml down
```

Remove the development volume only when you intend to discard local data:

```bash
docker compose -f docker-compose.dev.yml down -v
```

That command affects the development volume named by `docker-compose.dev.yml`. It does not target a remote database.

## Isolated test services

```bash
docker compose -f docker-compose.test.yml up -d
```

The test database is `softtech_test` on `127.0.0.1:5433`. Test Redis is `127.0.0.1:6380`, database index 15. The volume is `postgres_test_data`, which is separate from development data.

```bash
docker compose -f docker-compose.test.yml down
docker compose -f docker-compose.test.yml down -v
```

`down -v` removes the test volume. It does not remove `postgres_data`.

Create integration configuration once:

```bash
pnpm env:setup:integration
```

That copies `.env.integration.example` to `.env.integration` when the file is missing. `pnpm test:integration` loads only `INTEGRATION_*` variables from `.env.integration`. It does not read `DATABASE_URL` or `REDIS_URL` from your API `.env`.

Example values (dummy local placeholders):

```text
INTEGRATION_DATABASE_URL=postgresql://softtech:softtech@127.0.0.1:5433/softtech_test
INTEGRATION_REDIS_URL=redis://127.0.0.1:6380/15
```

The suite refuses remote hosts, any database name other than `softtech_test`, and any Redis index other than `15`. It does not run `migrate reset`. See [testing strategy](../testing/testing-strategy.md) for a PowerShell walkthrough.
