import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { RedisSettings } from '@/configs/app-config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public readonly client: Redis;

  public constructor(settings: RedisSettings & { readonly url: string }) {
    this.client = new Redis(settings.url, {
      connectTimeout: settings.connectTimeoutMs,
      commandTimeout: settings.commandTimeoutMs,
      maxRetriesPerRequest: settings.maxRetries,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: (attempt: number) => (attempt > settings.maxRetries ? null : attempt * 200),
    });
    this.client.on('error', () => {
      return;
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  public async readiness(timeoutMs: number): Promise<'up' | 'down'> {
    try {
      await Promise.race([
        this.client.ping(),
        new Promise((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error('timeout'));
          }, timeoutMs);
        }),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
