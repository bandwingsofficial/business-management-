import { describe, expect, it } from 'vitest';

import { FailingCacheStore, MemoryCacheStore, TenantCache, tenantCacheKey } from './tenant-cache';

describe('tenant cache', () => {
  it('keeps values inside the organization namespace and expires them', async () => {
    let now = 1_000;
    const cache = new TenantCache(new MemoryCacheStore(() => now));
    await cache.set({ organizationId: 'org-a' }, 'files', 'one', { name: 'a' }, 10);

    expect(await cache.get({ organizationId: 'org-a' }, 'files', 'one')).toEqual({ name: 'a' });
    expect(await cache.get({ organizationId: 'org-b' }, 'files', 'one')).toBeUndefined();
    expect(tenantCacheKey({ organizationId: 'org-a' }, 'files', 'one')).not.toBe(
      tenantCacheKey({ organizationId: 'org-b' }, 'files', 'one'),
    );

    now += 11_000;
    expect(await cache.get({ organizationId: 'org-a' }, 'files', 'one')).toBeUndefined();
  });

  it('invalidates one namespace without touching another tenant', async () => {
    const cache = new TenantCache(new MemoryCacheStore(() => 0));
    await cache.set({ organizationId: 'org-a' }, 'files', 'one', 1, 30);
    await cache.set({ organizationId: 'org-b' }, 'files', 'one', 2, 30);
    await cache.invalidate({ organizationId: 'org-a' }, 'files');

    expect(await cache.get({ organizationId: 'org-a' }, 'files', 'one')).toBeUndefined();
    expect(await cache.get({ organizationId: 'org-b' }, 'files', 'one')).toBe(2);
  });

  it('treats a store outage as a miss and does not return another tenant value', async () => {
    const cache = new TenantCache(new FailingCacheStore());
    expect(await cache.get({ organizationId: 'org-a' }, 'files', 'one')).toBeUndefined();
    expect(cache.failures).toBe(1);
    await cache.set(
      { organizationId: 'org-a' },
      'files',
      'one',
      { token: 'super-secret-password' },
      10,
    );
    expect(cache.failures).toBe(2);
  });
});
