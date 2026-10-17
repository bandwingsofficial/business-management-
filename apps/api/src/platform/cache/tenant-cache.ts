import type { TenantScope } from '@/common/http/access-context';

export interface CacheStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}

export function tenantCacheKey(scope: TenantScope, namespace: string, key: string): string {
  return `tenant:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(namespace)}:${encodeURIComponent(key)}`;
}

interface Entry {
  value: string;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, Entry>();

  public constructor(private readonly now: () => number = Date.now) {}

  public async get(key: string): Promise<string | undefined> {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  public async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }
}

export class FailingCacheStore implements CacheStore {
  public async get(): Promise<string | undefined> {
    throw new Error('redis unavailable');
  }

  public async set(): Promise<void> {
    throw new Error('redis unavailable');
  }

  public async deleteByPrefix(): Promise<void> {
    throw new Error('redis unavailable');
  }
}

interface CachedValue {
  readonly v: 1;
  readonly value: unknown;
}

export class TenantCache {
  private readonly flights = new Map<string, Promise<unknown>>();
  public hits = 0;
  public misses = 0;
  public failures = 0;

  public constructor(private readonly store: CacheStore) {}

  public async get<T>(scope: TenantScope, namespace: string, key: string): Promise<T | undefined> {
    try {
      const raw = await this.store.get(tenantCacheKey(scope, namespace, key));
      if (raw === undefined) {
        this.misses += 1;
        return undefined;
      }
      this.hits += 1;
      return decode<T>(raw);
    } catch {
      this.failures += 1;
      this.misses += 1;
      return undefined;
    }
  }

  public async set(
    scope: TenantScope,
    namespace: string,
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.store.set(
        tenantCacheKey(scope, namespace, key),
        JSON.stringify({ v: 1, value } satisfies CachedValue),
        ttlSeconds,
      );
    } catch {
      this.failures += 1;
    }
  }

  public async invalidate(scope: TenantScope, namespace: string): Promise<void> {
    try {
      await this.store.deleteByPrefix(
        `tenant:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(namespace)}:`,
      );
    } catch {
      this.failures += 1;
    }
  }

  public async getOrLoad<T>(
    scope: TenantScope,
    namespace: string,
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(scope, namespace, key);
    if (cached !== undefined) {
      return cached;
    }
    const flightKey = tenantCacheKey(scope, namespace, key);
    const existing = this.flights.get(flightKey);
    if (existing) {
      return existing as Promise<T>;
    }
    const flight = load()
      .then(async (value) => {
        await this.set(scope, namespace, key, value, ttlSeconds);
        return value;
      })
      .finally(() => {
        this.flights.delete(flightKey);
      });
    this.flights.set(flightKey, flight);
    return flight;
  }
}

function decode<T>(raw: string): T | undefined {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('v' in parsed) ||
    parsed.v !== 1 ||
    !('value' in parsed)
  ) {
    return undefined;
  }
  return parsed.value as T;
}
