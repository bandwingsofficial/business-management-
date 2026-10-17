# Threat model

This document describes the foundation that exists now. It is not a claim that future business modules are covered.

## Assets

- Organization membership and the tenant boundary.
- Access tokens, revocation identifiers, and the metrics token.
- Audit history.
- Private file metadata and signed download URLs.
- Database and Redis credentials.

## Actors

- An authenticated member of an organization.
- A caller with a valid token and a forged organization header.
- A caller without a token, or with a revoked token.
- A background job carrying a tenant scope.
- An operator reading logs, metrics, and health.

## Boundaries

The browser is untrusted. `x-organization-id` is untrusted until membership is loaded. Request bodies are validated with strict Zod schemas and unknown fields are rejected. The public error body is `statusCode`, `code`, `message`, `requestId`, and `details`. It does not include Prisma, Redis, stack, or token text.

Logs redact keys that look like secrets, authorization, cookies, DSNs, and any field named `url`. Query logging is off. Request bodies are not logged. User and organization ids are not metric labels.

## Decisions

| Threat                     | Control                                                                                                                           | Residual risk                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant read or write | Membership check, tenant-scoped queries, 404 for foreign resource ids                                                             | Future modules must repeat the checks. Row-level security is not enabled.                                               |
| Forged organization header | Header is accepted only after an active membership lookup                                                                         | A buggy new repository could ignore the scope.                                                                          |
| Stolen access token        | Short expiry is the identity provider's job. Softtech can revoke the `jti` in Postgres. Production without Postgres fails closed. | Development revocation is process memory. Softtech cannot revoke the provider session.                                  |
| Auth endpoint flooding     | Shared Redis limit when `REDIS_URL` is set. Fail closed if the limiter throws, including a Redis error.                           | Without Redis the limit is per process. Run one API replica in that configuration.                                      |
| Cache leak                 | Tenant-prefixed keys. A cache failure is a miss, never an allow.                                                                  | Authorization decisions are not cached.                                                                                 |
| Signed URL leak            | URL is minted only after the object matches the caller organization. TTL is 60 seconds in the test adapter.                       | Production rejects `STORAGE_DRIVER=s3`. No object-storage SDK is installed.                                             |
| Nested brace expansion     | `tsc-alias` was removed. The remaining `braces@3.0.3` path is the Next.js ESLint plugin.                                          | No patched braces release exists. The advisory is development-only and reviewed in `security/reviewed-advisories.json`. |
| Secret in logs or errors   | Redaction and generic 500 text                                                                                                    | A new log call can still pass a raw secret in the message string.                                                       |
| Audit tampering            | Application code only appends and reads. Ordinary flows have no update or delete.                                                 | The database owner can still change rows. The log is not tamper-proof.                                                  |
| Metrics disclosure         | Endpoint is 404 until `METRICS_TOKEN` is set                                                                                      | The token is a bearer secret and must be stored as one.                                                                 |

Authentication errors stay generic. The API does not say whether a subject or organization exists.
