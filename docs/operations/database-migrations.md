# Database migrations

Prisma migrations are the production schema-change path. The first migration is `apps/api/prisma/migrations/20261017120000_platform_foundation`. It creates platform tables only. It does not drop or rewrite an earlier migration because none existed.

## Production rollout

1. Read the SQL in `apps/api/prisma/migrations` and confirm it is additive or follows expand-and-contract.
2. Apply it first to an empty or restored copy of the schema. `pnpm test:integration` does this against `softtech_test` when that database is running. It uses `prisma migrate deploy`.
3. Take a backup of the target database before the production apply. This repository does not take that backup. See `docs/operations/backup-and-recovery.md`.
4. Keep the previous application version able to run against the expanded schema. Do not drop a column that an old instance still reads.
5. An authorized operator runs `pnpm --filter @softtech/api exec prisma migrate deploy` with `DATABASE_URL` set to the target. CI does not point this command at production.
6. Start the new application version.
7. Check `GET /api/v1/health` and `GET /api/v1/ready`.
8. If the change is wrong, add a forward migration or restore the backup. Prisma has no down migration for this history.

Do not use `prisma db push` as the normal production workflow. Do not run `migrate reset` against a shared or production database. `docker compose -f docker-compose.test.yml up -d` starts the isolated database used for validation. This workspace does not apply the migration to a shared database automatically.

## Rollback

Prisma does not generate a down migration. Rolling back a release that added columns or tables requires a forward migration that reverses the change, or a restore from backup. Do not delete a migration that has already been applied to a shared database.

## Expand and contract

A breaking change ships in two releases. First add the new column or table and deploy code that writes both shapes. Then backfill. Then switch readers. Only a later migration may drop the old shape. The platform migration is additive and does not need that sequence.

## Transactions

`UnitOfWork` defaults to `ReadCommitted`. Pass `Serializable` only for an operation that must reject concurrent writes rather than wait. Membership changes that must not overwrite a revoke should update with `status: 'active'` in the predicate instead of read-modify-write. The outbox row is inserted in the same database transaction as the state change. That transaction does not publish to Redis. No dispatcher is running, so a committed row is not delivered. Production rejects `JOBS_DRIVER=redis` until a dispatcher exists.

## Client

One `PrismaService` exists per process. It builds a `pg` pool from the configured limits, connects on module init, and disconnects and ends the pool on shutdown. Query text and parameters are not logged.
