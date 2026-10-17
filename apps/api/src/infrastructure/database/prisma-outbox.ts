import type { TenantScope } from '@/common/http/access-context';

export interface OutboxWriter {
  outboxMessage: {
    create(input: {
      data: {
        organizationId: string;
        type: string;
        idempotencyKey: string;
        payload: unknown;
        traceId: string | null;
      };
    }): Promise<unknown>;
  };
}

export interface OutboxDatabase {
  $transaction<T>(work: (tx: OutboxWriter) => Promise<T>): Promise<T>;
}

export class PrismaOutbox {
  public constructor(private readonly database: OutboxDatabase) {}

  public async commit<T>(
    scope: TenantScope,
    message: { type: string; idempotencyKey: string; payload: unknown; traceId?: string },
    work: (tx: OutboxWriter) => Promise<T>,
  ): Promise<T> {
    return this.database.$transaction(async (tx) => {
      const result = await work(tx);
      await tx.outboxMessage.create({
        data: {
          organizationId: scope.organizationId,
          type: message.type,
          idempotencyKey: message.idempotencyKey,
          payload: message.payload,
          traceId: message.traceId ?? null,
        },
      });
      return result;
    });
  }
}
