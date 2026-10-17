import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { InfrastructureError } from '@/common/errors/application-error';

import { rewriteSource } from '../../../scripts/rewrite-aliases.mjs';
import { AccessResolver } from './access-resolver';
import { InMemoryMembershipStore } from './membership-store';
import {
  createRateLimiter,
  FailingRateLimiter,
  MemoryRateLimiter,
  RedisRateLimiter,
} from './rate-limiter';
import {
  createRevocationStore,
  InMemoryRevocationStore,
  UnavailableRevocationStore,
} from './revocation-store';
import { StaticTokenVerifier } from './token-verifier';

describe('revocation store selection', () => {
  it('keeps the in-memory list for development and tests', () => {
    expect(createRevocationStore('development')).toBeInstanceOf(InMemoryRevocationStore);
    expect(createRevocationStore('test')).toBeInstanceOf(InMemoryRevocationStore);
  });

  it('fails closed in production when no durable store is available', async () => {
    const store = createRevocationStore('production');
    expect(store).toBeInstanceOf(UnavailableRevocationStore);
    await expect(store.isRevoked('session-1')).rejects.toBeInstanceOf(InfrastructureError);
    await expect(
      store.revoke({ jti: 'session-1', expiresAt: new Date(Date.now() + 60_000) }),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });

  it('does not authenticate a valid token when revocation cannot be checked', async () => {
    const resolver = new AccessResolver(
      new StaticTokenVerifier(
        new Map([
          [
            'token',
            { userId: 'user-1', jti: 'session-1', expiresAt: new Date('2099-01-01T00:00:00.000Z') },
          ],
        ]),
      ),
      new InMemoryMembershipStore([
        { userId: 'user-1', organizationId: 'org-1', role: 'owner', status: 'active' },
      ]),
      new UnavailableRevocationStore(),
      new MemoryRateLimiter(),
      20,
      60,
    );

    await expect(
      resolver.authenticate({
        token: 'token',
        organizationId: 'org-1',
        rateLimitKey: 'auth:test',
      }),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });
});

describe('rate limiter', () => {
  it('uses process memory when Redis is absent and Redis when a client is present', () => {
    expect(createRateLimiter()).toBeInstanceOf(MemoryRateLimiter);
    expect(createRateLimiter({ eval: async () => [1, 60] })).toBeInstanceOf(RedisRateLimiter);
  });

  it('shares a fixed window through Redis and fails closed when Redis fails', async () => {
    const limiter = new RedisRateLimiter({
      eval: async () => [3, 12],
    });
    await expect(limiter.consume('auth:10.0.0.1', 2, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 12,
    });

    const failing = new RedisRateLimiter({
      eval: async () => {
        throw new Error('connection refused');
      },
    });
    await expect(failing.consume('auth:10.0.0.1', 2, 60)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
    await expect(new FailingRateLimiter().consume('auth:10.0.0.1', 2, 60)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
  });

  it('rejects a Redis reply that is not a count and ttl pair', async () => {
    const limiter = new RedisRateLimiter({ eval: async () => 'ok' });
    await expect(limiter.consume('auth:10.0.0.1', 2, 60)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
  });
});

describe('compiled path aliases', () => {
  it('rewrites alias imports to relative javascript files', () => {
    const dist = path.join('app', 'dist');
    const from = path.join(dist, 'platform', 'access', 'rate-limiter.js');
    const source = 'const local = require("@/common/errors/application-error");\n';
    const rewritten = rewriteSource(source, from, dist);
    expect(rewritten).toBe('const local = require("../../common/errors/application-error.js");\n');
    expect(rewritten).not.toContain('@/');
  });
});
