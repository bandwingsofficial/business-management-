import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { InfrastructureError } from '@/common/errors/application-error';
import type { DatabaseSettings } from '@/configs/app-config';

import { PrismaClient } from '../../generated/prisma/client';
import { resolveIsolation, type UnitOfWork, type UnitOfWorkOptions } from './unit-of-work';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, UnitOfWork
{
  private readonly pool: Pool;

  public constructor(settings: DatabaseSettings & { readonly url: string }) {
    const pool = new Pool({
      connectionString: settings.url,
      max: settings.poolMax,
      connectionTimeoutMillis: settings.connectionTimeoutMs,
      idleTimeoutMillis: settings.idleTimeoutMs,
      statement_timeout: settings.queryTimeoutMs,
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }

  public async run<T>(work: () => Promise<T>, options?: UnitOfWorkOptions): Promise<T> {
    return this.$transaction(work, {
      isolationLevel: resolveIsolation(options),
      timeout: options?.timeoutMs,
    });
  }

  public async readiness(timeoutMs: number): Promise<'up' | 'down'> {
    try {
      await Promise.race([this.$queryRaw`SELECT 1`, rejectAfter(timeoutMs)]);
      return 'up';
    } catch {
      return 'down';
    }
  }
}

function rejectAfter(timeoutMs: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new InfrastructureError());
    }, timeoutMs);
  });
}
