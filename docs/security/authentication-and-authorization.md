# Authentication and authorization

Softtech verifies access tokens issued by an external identity provider. It does not store passwords and does not issue refresh tokens. Password hashing is intentionally absent. Cookie sessions are not used, so CSRF protection is not applied. A future cookie session would need a CSRF control before it is enabled.

## Token verification

When `AUTH_ISSUER`, `AUTH_AUDIENCE`, and `AUTH_JWKS_URI` are all set, `JwksTokenVerifier` checks the signature, issuer, audience, expiry, `sub`, and `jti` with `jose`. If any of those settings is missing, the API still starts, and protected routes use `RejectingTokenVerifier`, which always fails closed with `401 AUTHENTICATION_REQUIRED`. Tests inject `StaticTokenVerifier`. There is no anonymous production bypass.

`RevokedCredential` stores a `jti` until its expiry. Revocation is local to Softtech. It does not revoke the token at the identity provider. Production uses the database revocation table. If that database is not configured, production authentication fails closed with `503 INFRASTRUCTURE_UNAVAILABLE` instead of trusting an in-memory list. Development and test may use the in-memory list. That list is not shared across processes and disappears on restart.

Authentication attempts are counted per client address before the token is verified. The limit is `AUTH_RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_SECONDS`. When `REDIS_URL` is set, the counter is a shared Redis key. Without Redis, the counter is process memory, so production must run a single API replica until a shared limiter is configured. If the limiter throws, including a Redis failure, the request fails with `503 INFRASTRUCTURE_UNAVAILABLE` and no principal is created. Liveness and readiness are public and are not counted.

The client address is the socket address unless `TRUST_PROXY=true`. That setting trusts exactly one proxy hop.

## Authorization

Roles are `owner`, `admin`, and `member`. Permissions are evaluated in application code:

| Permission          | owner | admin | member |
| ------------------- | ----- | ----- | ------ |
| `organization.read` | yes   | yes   | yes    |
| `membership.read`   | yes   | yes   | no     |
| `audit.read`        | yes   | yes   | no     |
| `storage.sign`      | yes   | yes   | yes    |
| `credential.revoke` | yes   | yes   | no     |

`AuthGuard` is global. `@Public()` marks liveness, readiness, and the metrics route. Metrics then requires `METRICS_TOKEN` with a constant-time compare, or returns 404 when the token is unset. `@RequirePermission()` checks the permission set derived from the role. Authorization failures use the same public message for membership and permission denials so the API does not enumerate accounts.

OpenAPI documents the bearer scheme. The browser still has to send a real token. Hidden UI controls are not a security boundary.
