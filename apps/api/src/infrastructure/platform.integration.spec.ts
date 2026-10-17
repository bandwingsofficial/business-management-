import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { translateDatabaseError } from '@/common/errors/translate-database-error';
import { TenantCache } from '@/platform/cache/tenant-cache';
import { assertIsolatedDatabase, assertIsolatedRedis } from '@/testing/fixtures';

import { PrismaClient } from '../generated/prisma/client';
import { type OutboxWriter, PrismaOutbox } from './database/prisma-outbox';
import type { RedisService } from './redis/redis.service';
import { RedisCacheStore } from './redis/redis-cache.store';

const require = createRequire(path.join(process.cwd(), 'package.json'));

describe('platform integration', () => {
  const databaseUrl = assertIsolatedDatabase(process.env['INTEGRATION_DATABASE_URL']);
  const redisUrl = assertIsolatedRedis(process.env['INTEGRATION_REDIS_URL']);
  const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5000 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  beforeAll(async () => {
    const prismaPackage = path.dirname(require.resolve('prisma/package.json'));
    const applied = spawnSync(
      process.execPath,
      [path.join(prismaPackage, 'build', 'index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
      },
    );
    if (applied.status !== 0) {
      throw new Error(
        `Migration deploy failed.\n${redact(applied.stderr || applied.stdout || '')}`,
      );
    }
    await prisma.$connect();
    await redis.connect();
    await truncate();
  }, 60000);

  afterAll(async () => {
    await truncate();
    await redis.quit();
    await prisma.$disconnect();
    await pool.end();
  });

  it('applies the platform migration and hides another tenant audit row', async () => {
    const organizationA = await prisma.organization.create({ data: { name: 'org-a' } });
    const organizationB = await prisma.organization.create({ data: { name: 'org-b' } });
    const event = await prisma.auditEvent.create({
      data: {
        organizationId: organizationA.id,
        action: 'storage.sign',
        resourceType: 'object',
        resourceId: 'file-a',
        metadata: {},
      },
    });

    const hidden = await prisma.auditEvent.findFirst({
      where: { id: event.id, organizationId: organizationB.id },
    });
    const visible = await prisma.auditEvent.findFirst({
      where: { id: event.id, organizationId: organizationA.id },
    });

    expect(hidden).toBeNull();
    expect(visible?.organizationId).toBe(organizationA.id);
  });

  it('maps a tenant-scoped unique violation and rolls back a failed transaction', async () => {
    const organization = await prisma.organization.create({ data: { name: 'org-unique' } });
    const user = await prisma.userAccount.create({
      data: { id: 'user-unique', subject: 'subject-unique' },
    });
    await prisma.membership.create({
      data: { organizationId: organization.id, userId: user.id, role: 'member', status: 'active' },
    });

    let conflict: unknown;
    try {
      await prisma.membership.create({
        data: { organizationId: organization.id, userId: user.id, role: 'admin', status: 'active' },
      });
    } catch (error) {
      conflict = error;
    }
    expect(translateDatabaseError(conflict)?.code).toBe('RESOURCE_CONFLICT');

    const outbox = new PrismaOutbox({
      $transaction: (work) => prisma.$transaction((tx) => work(tx as unknown as OutboxWriter)),
    });
    await expect(
      outbox.commit(
        { organizationId: organization.id },
        { type: 'export', idempotencyKey: 'rollback-key', payload: { ok: false } },
        async () => {
          throw new Error('rolled back');
        },
      ),
    ).rejects.toThrow('rolled back');
    expect(
      await prisma.outboxMessage.findFirst({ where: { idempotencyKey: 'rollback-key' } }),
    ).toBeNull();

    await outbox.commit(
      { organizationId: organization.id },
      { type: 'export', idempotencyKey: 'committed-key', payload: { ok: true } },
      async () => 'saved',
    );
    const saved = await prisma.outboxMessage.findFirst({
      where: { idempotencyKey: 'committed-key' },
    });
    expect(saved?.organizationId).toBe(organization.id);
  });

  it('expires and invalidates tenant cache keys in redis', async () => {
    const cache = new TenantCache(new RedisCacheStore({ client: redis } as RedisService));
    await cache.set({ organizationId: 'org-a' }, 'files', 'one', { name: 'a' }, 1);
    await cache.set({ organizationId: 'org-b' }, 'files', 'one', { name: 'b' }, 30);
    expect(await cache.get({ organizationId: 'org-b' }, 'files', 'one')).toEqual({ name: 'b' });
    expect(await cache.get({ organizationId: 'org-a' }, 'files', 'one')).toEqual({ name: 'a' });

    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });
    expect(await cache.get({ organizationId: 'org-a' }, 'files', 'one')).toBeUndefined();

    await cache.invalidate({ organizationId: 'org-b' }, 'files');
    expect(await cache.get({ organizationId: 'org-b' }, 'files', 'one')).toBeUndefined();
  });

  async function truncate(): Promise<void> {
    await prisma.outboxMessage.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.storedObject.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.revokedCredential.deleteMany();
    await prisma.userAccount.deleteMany();
    await prisma.organization.deleteMany();
    await redis.flushdb();
  }
});

function redact(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/rediss?:\/\/\S+/gi, '[redacted]');
}
