# Tenant isolation

Softtech Core treats organization membership as the tenant boundary. Platform code distinguishes records that are global from records that belong to one organization.

## Record ownership

Platform-owned records have no organization column and are not readable through tenant APIs:

- `user_accounts` identifies an external subject.
- `revoked_credentials` stores a token identifier and expiry.

Tenant-owned records always include `organizationId`:

- `organizations`
- `memberships`
- `audit_events`
- `stored_objects`
- `outbox_messages`

Future business tables must follow the tenant-owned shape unless a written design says the record is platform-owned.

## Trusted context

A bearer access token is verified before any organization header is accepted. The organization id comes from `x-organization-id` and is used only after `MembershipStore.findActive` returns an active membership for that user and organization. A missing membership, a revoked membership, and an unknown organization all return `403 MEMBERSHIP_DENIED`. The response does not say whether the organization exists.

Cross-tenant resource lookups return `404 RESOURCE_NOT_FOUND`. Audit reads and signed storage URLs query with the trusted organization id from the membership, not with an id taken from the body.

Cache keys are `tenant:{organizationId}:{namespace}:{key}` with each segment encoded. A read uses the caller scope, so a hit cannot return another tenant's value. Job payloads carry the same trusted scope. A handler that sees the wrong organization fails the job instead of reading the other tenant's row.

PostgreSQL row-level security is not enabled. Prisma uses a connection pool, and session variables set outside a transaction are not safe on the next checkout. `SET LOCAL` would require every query to run inside a transaction, which this foundation does not force. The compensating controls are the explicit tenant argument on tenant-owned operations, membership checks, tenant-prefixed cache keys, and tests. A later design can add row-level security inside explicit transactions if the pool is proven to clear it.

## What these tests do not prove

The foundation tests cover the platform audit and storage paths, the access resolver, cache keys, and job payloads. `platform.integration.spec.ts` repeats the audit scope check against PostgreSQL when `pnpm test:integration` has an isolated database. They do not prove that a future leads, projects, or finance endpoint is isolated. Every new tenant-owned module must require a `TenantScope` on repository methods and must test another organization's record id, a forged organization header, a revoked membership, a job with the wrong scope, and a cross-tenant cache or storage key.
