import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { loadLocalEnv } from '@/bootstrap/load-local-env';
import { CorrelationIdMiddleware } from '@/common/http/correlation-id.middleware';
import { AppConfigModule } from '@/configs/config.module';
import { loadEnv } from '@/configs/load-env';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { PlatformModule } from '@/platform/platform.module';

loadLocalEnv();
const runtime = loadEnv();

@Module({
  imports: [
    AppConfigModule,
    PlatformModule,
    ...(runtime.database.url === undefined ? [] : [DatabaseModule]),
    ...(runtime.redis.url === undefined ? [] : [RedisModule]),
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}');
  }
}
