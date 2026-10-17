import { Module } from '@nestjs/common';

import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';

import { HealthController } from './health.controller';
import { type DependencyProbe, ReadinessService, StaticProbe } from './readiness';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: ReadinessService,
      inject: [
        { token: PrismaService, optional: true },
        { token: RedisService, optional: true },
      ],
      useFactory: (prisma?: PrismaService, redis?: RedisService): ReadinessService => {
        const probes: DependencyProbe[] = [
          prisma === undefined
            ? new StaticProbe('database', 'not_configured')
            : { name: 'database', check: (timeoutMs) => prisma.readiness(timeoutMs) },
          redis === undefined
            ? new StaticProbe('redis', 'not_configured')
            : { name: 'redis', check: (timeoutMs) => redis.readiness(timeoutMs) },
        ];
        return new ReadinessService(probes);
      },
    },
  ],
})
export class HealthModule {}
