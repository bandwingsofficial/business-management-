import type { CacheStore } from '@/platform/cache/tenant-cache';

import type { RedisService } from './redis.service';

export class RedisCacheStore implements CacheStore {
  public constructor(private readonly redis: RedisService) {}

  public async get(key: string): Promise<string | undefined> {
    const value = await this.redis.client.get(key);
    return value ?? undefined;
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.client.set(key, value, 'EX', ttlSeconds);
  }

  public async deleteByPrefix(prefix: string): Promise<void> {
    const stream = this.redis.client.scanStream({ match: `${prefix}*`, count: 100 });
    const keys: string[] = [];
    for await (const batch of stream) {
      keys.push(...(batch as string[]));
    }
    if (keys.length > 0) {
      await this.redis.client.del(...keys);
    }
  }
}
