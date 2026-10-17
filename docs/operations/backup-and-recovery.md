# Backup and recovery

No backup job is configured in this repository. Nothing here copies a database, stores an encrypted archive, or restores one. The product owner has to choose the recovery point objective and the recovery time objective before a backup vendor or schedule is treated as real.

## What must be decided

| Decision                   | Current state   |
| -------------------------- | --------------- |
| Recovery point objective   | Not defined     |
| Recovery time objective    | Not defined     |
| Retention period           | Not defined     |
| Encryption of backup media | Not implemented |
| Who can restore            | Not assigned    |
| Restore test cadence       | Not performed   |

## Intended contents

A future backup needs the PostgreSQL data directory or a logical dump of the application database, plus any object-storage bucket that later holds private files. Redis is a cache and a queue. It is not the source of truth and is not a backup target.

Access to backups should be limited to the same operators who can administer the database. Backup credentials must not be committed or printed in CI logs.

## Restore testing

A restore test uses an isolated database, loads a backup, runs `prisma migrate deploy` only if the backup is from an earlier schema, and checks `GET /api/v1/ready`. This repository has not executed that test.

## Relation to migrations

Prisma does not generate a down migration. A bad schema change is recovered by a forward migration or by restoring a backup taken before the change. Taking the backup is an operational step outside this repository. See `docs/operations/database-migrations.md`.
