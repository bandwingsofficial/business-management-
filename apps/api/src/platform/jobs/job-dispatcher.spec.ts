import { describe, expect, it } from 'vitest';

import { type OutboxDatabase, PrismaOutbox } from '@/infrastructure/database/prisma-outbox';
import { decodeJob, encodeJob } from '@/infrastructure/redis/redis-job-queue';

import {
  InMemoryOutbox,
  JobDispatcher,
  PermanentJobError,
  RetryableJobError,
} from './job-dispatcher';

describe('job dispatcher', () => {
  it('retries a retryable failure and ignores a duplicate key', async () => {
    let calls = 0;
    const dispatcher = new JobDispatcher<{ objectKey: string }>(
      async (job) => {
        calls += 1;
        if (job.scope.organizationId !== 'org-a') {
          throw new PermanentJobError('wrong tenant');
        }
        if (calls === 1) {
          throw new RetryableJobError('again');
        }
      },
      3,
      async () => {
        return;
      },
    );

    const job = {
      name: 'export',
      scope: { organizationId: 'org-a' },
      idempotencyKey: 'export-1',
      payload: { objectKey: 'file-a' },
      traceId: 'abc',
    };
    expect((await dispatcher.handle(job)).status).toBe('processed');
    expect((await dispatcher.handle(job)).status).toBe('duplicate');
    expect(dispatcher.retries).toBe(1);
  });

  it('stops a permanent failure and a job whose tenant does not own the resource', async () => {
    const dispatcher = new JobDispatcher<string>(
      async (job) => {
        if (job.scope.organizationId !== 'org-a' || job.payload !== 'file-a') {
          throw new PermanentJobError('not owned');
        }
      },
      3,
      async () => {
        return;
      },
    );

    const outcome = await dispatcher.handle({
      name: 'export',
      scope: { organizationId: 'org-b' },
      idempotencyKey: 'export-2',
      payload: 'file-a',
    });
    expect(outcome).toEqual({ status: 'failed', attempts: 1 });
    expect(dispatcher.retries).toBe(0);
  });

  it('keeps tenant and trace context in the redis payload', () => {
    const encoded = encodeJob({
      name: 'export',
      scope: { organizationId: 'org-a' },
      idempotencyKey: 'export-3',
      payload: { file: 'a.pdf' },
      traceId: 'trace-1',
    });
    expect(encoded).not.toContain('super-secret-password');
    expect(decodeJob(encoded)).toMatchObject({
      scope: { organizationId: 'org-a' },
      traceId: 'trace-1',
    });
  });
});

describe('transactional outbox', () => {
  it('discards the staged message when the transaction work fails', async () => {
    const rows: unknown[] = [];
    const database: OutboxDatabase = {
      async $transaction(work) {
        const staged: unknown[] = [];
        const result = await work({
          outboxMessage: {
            async create(input) {
              staged.push(input.data);
            },
          },
        });
        rows.push(...staged);
        return result;
      },
    };
    const outbox = new PrismaOutbox(database);

    await expect(
      outbox.commit(
        { organizationId: 'org-a' },
        { type: 'export', idempotencyKey: '1', payload: {} },
        async () => {
          throw new Error('rolled back');
        },
      ),
    ).rejects.toThrow('rolled back');
    expect(rows).toHaveLength(0);

    await outbox.commit(
      { organizationId: 'org-a' },
      { type: 'export', idempotencyKey: '1', payload: { ok: true } },
      async () => {
        return 'saved';
      },
    );
    expect(rows).toHaveLength(1);
  });

  it('publishes in-memory outbox rows only after the transaction function resolves', async () => {
    const outbox = new InMemoryOutbox<{ id: string }>();
    await expect(
      outbox.transaction(async () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(outbox.unpublished()).toHaveLength(0);
  });
});
