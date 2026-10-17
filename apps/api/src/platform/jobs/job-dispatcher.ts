import type { TenantScope } from '@/common/http/access-context';

export class PermanentJobError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export class RetryableJobError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RetryableJobError';
  }
}

export interface JobEnvelope<T> {
  readonly name: string;
  readonly scope: TenantScope;
  readonly idempotencyKey: string;
  readonly payload: T;
  readonly traceId?: string;
}

export interface JobOutcome {
  readonly status: 'processed' | 'duplicate' | 'failed';
  readonly attempts: number;
}

export type JobHandler<T> = (job: JobEnvelope<T>) => Promise<void>;

export class JobDispatcher<T> {
  private readonly completed = new Set<string>();
  public retries = 0;
  public failures = 0;

  public constructor(
    private readonly handler: JobHandler<T>,
    private readonly maxAttempts: number,
    private readonly wait: (ms: number) => Promise<void> = delay,
  ) {}

  public async handle(job: JobEnvelope<T>): Promise<JobOutcome> {
    if (this.completed.has(job.idempotencyKey)) {
      return { status: 'duplicate', attempts: 0 };
    }
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        await this.handler(job);
        this.completed.add(job.idempotencyKey);
        return { status: 'processed', attempts: attempt };
      } catch (error) {
        const permanent = error instanceof PermanentJobError || attempt === this.maxAttempts;
        if (permanent) {
          this.failures += 1;
          return { status: 'failed', attempts: attempt };
        }
        this.retries += 1;
        await this.wait(25 * attempt);
      }
    }
    this.failures += 1;
    return { status: 'failed', attempts: this.maxAttempts };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface OutboxMessage<T> {
  readonly id: string;
  readonly scope: TenantScope;
  readonly type: string;
  readonly idempotencyKey: string;
  readonly payload: T;
  readonly traceId?: string;
}

export interface OutboxTransaction<T> {
  append(message: OutboxMessage<T>): void;
}

export class InMemoryOutbox<T> {
  private readonly messages: OutboxMessage<T>[] = [];

  public async transaction<R>(work: (tx: OutboxTransaction<T>) => Promise<R>): Promise<R> {
    const staged: OutboxMessage<T>[] = [];
    const result = await work({
      append(message: OutboxMessage<T>): void {
        staged.push(message);
      },
    });
    this.messages.push(...staged);
    return result;
  }

  public unpublished(): readonly OutboxMessage<T>[] {
    return this.messages;
  }
}
