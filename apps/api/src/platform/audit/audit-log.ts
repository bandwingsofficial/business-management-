import type { TenantScope } from '@/common/http/access-context';

export interface AuditRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly actorId?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly requestId?: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly createdAt: Date;
}

export interface AuditDraft {
  readonly organizationId: string;
  readonly actorId?: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly requestId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface AuditLog {
  append(draft: AuditDraft): Promise<AuditRecord>;
  findById(scope: TenantScope, id: string): Promise<AuditRecord | undefined>;
}

export class InMemoryAuditLog implements AuditLog {
  private readonly records: AuditRecord[] = [];

  public async append(draft: AuditDraft): Promise<AuditRecord> {
    const record: AuditRecord = {
      id: `audit-${String(this.records.length + 1)}`,
      organizationId: draft.organizationId,
      ...(draft.actorId === undefined ? {} : { actorId: draft.actorId }),
      action: draft.action,
      resourceType: draft.resourceType,
      resourceId: draft.resourceId,
      ...(draft.requestId === undefined ? {} : { requestId: draft.requestId }),
      metadata: draft.metadata ?? {},
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }

  public async findById(scope: TenantScope, id: string): Promise<AuditRecord | undefined> {
    return this.records.find(
      (record) => record.id === id && record.organizationId === scope.organizationId,
    );
  }
}
