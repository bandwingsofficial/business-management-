import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { RedisSettings } from '@/configs/app-config';

import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RedisService => {
        const redis = config.getOrThrow<RedisSettings>('redis');
        if (redis.url === undefined) {
          throw new Error('RedisService requires REDIS_URL');
        }
        return new RedisService({ ...redis, url: redis.url });
      },
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
