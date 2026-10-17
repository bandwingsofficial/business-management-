# Query and cache guidelines

PostgreSQL is the source of truth. Redis is a cache and a job queue. A Redis failure must not grant access and must not be treated as a committed business write.

## Queries

- Tenant-owned reads and writes include the trusted organization id in the query.
- Uniqueness that is tenant-owned is unique on `(organizationId, business key)`, as `stored_objects` and `memberships` already are.
- Do not load an unbounded table to filter in memory.
- Keep the default isolation level at Read Committed. Use Serializable only when a lost update cannot be expressed as a conditional update.
- Leave Prisma query logging off. If it is enabled later, log duration and a redacted statement, never parameter values.

## Cache

`TenantCache` stores a JSON envelope `{ "v": 1, "value": ... }` under a tenant-prefixed key. Every entry has a TTL. `invalidate` deletes one tenant namespace by prefix. Concurrent loads of the same key share one in-flight promise.

A store error increments a failure count and behaves as a miss. Do not cache authorization decisions. Do not serve a cached object unless its key was built from the trusted tenant scope.

The in-memory store is used when Redis is not configured, including unit tests. It is per process. Production cache sharing requires `REDIS_URL`.

## Jobs

`JobDispatcher` retries retryable errors with a short backoff and stops on `PermanentJobError` or the attempt limit. A completed idempotency key is not processed again in that process. No process starts `RedisJobQueue`, and production rejects `JOBS_DRIVER=redis`. The transactional outbox commits only with the database transaction. This foundation does not poll those rows or publish them to Redis, so a committed outbox row is not a delivered job.
