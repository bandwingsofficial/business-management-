import type { TenantScope } from '@/common/http/access-context';
import type { JobDispatcher } from '@/platform/jobs/job-dispatcher';
import { type JobEnvelope } from '@/platform/jobs/job-dispatcher';

import type { RedisService } from './redis.service';

const QUEUE_KEY = 'softtech:jobs';

export function encodeJob<T>(job: JobEnvelope<T>): string {
  return JSON.stringify({
    name: job.name,
    organizationId: job.scope.organizationId,
    idempotencyKey: job.idempotencyKey,
    payload: job.payload,
    ...(job.traceId === undefined ? {} : { traceId: job.traceId }),
  });
}

export function decodeJob<T>(raw: string): JobEnvelope<T> | undefined {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const record = parsed as {
    name?: unknown;
    organizationId?: unknown;
    idempotencyKey?: unknown;
    payload?: unknown;
    traceId?: unknown;
  };
  if (
    typeof record.name !== 'string' ||
    typeof record.organizationId !== 'string' ||
    typeof record.idempotencyKey !== 'string'
  ) {
    return undefined;
  }
  const scope: TenantScope = { organizationId: record.organizationId };
  return {
    name: record.name,
    scope,
    idempotencyKey: record.idempotencyKey,
    payload: record.payload as T,
    ...(typeof record.traceId === 'string' ? { traceId: record.traceId } : {}),
  };
}

export class RedisJobQueue<T> {
  private running = false;

  public constructor(
    private readonly redis: RedisService,
    private readonly dispatcher: JobDispatcher<T>,
  ) {}

  public async publish(job: JobEnvelope<T>): Promise<void> {
    await this.redis.client.lpush(QUEUE_KEY, encodeJob(job));
  }

  public async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      const result = await this.redis.client.brpop(QUEUE_KEY, 1);
      const raw = result?.[1];
      if (raw === undefined) {
        continue;
      }
      const job = decodeJob<T>(raw);
      if (job) {
        await this.dispatcher.handle(job);
      }
    }
  }

  public stop(): void {
    this.running = false;
  }
}
