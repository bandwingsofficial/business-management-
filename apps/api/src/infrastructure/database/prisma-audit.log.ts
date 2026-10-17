import type { TenantScope } from '@/common/http/access-context';
import type { AuditDraft, AuditLog, AuditRecord } from '@/platform/audit/audit-log';

import type { PrismaService } from './prisma.service';

export class PrismaAuditLog implements AuditLog {
  public constructor(private readonly prisma: PrismaService) {}

  public async append(draft: AuditDraft): Promise<AuditRecord> {
    const created = await this.prisma.auditEvent.create({
      data: {
        organizationId: draft.organizationId,
        actorId: draft.actorId ?? null,
        action: draft.action,
        resourceType: draft.resourceType,
        resourceId: draft.resourceId,
        requestId: draft.requestId ?? null,
        metadata: draft.metadata ?? {},
      },
    });
    return toRecord(created);
  }

  public async findById(scope: TenantScope, id: string): Promise<AuditRecord | undefined> {
    const record = await this.prisma.auditEvent.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
    return record === null ? undefined : toRecord(record);
  }
}

function toRecord(record: {
  id: string;
  organizationId: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string | null;
  metadata: unknown;
  createdAt: Date;
}): AuditRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ...(record.actorId === null ? {} : { actorId: record.actorId }),
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    ...(record.requestId === null ? {} : { requestId: record.requestId }),
    metadata: asMetadata(record.metadata),
    createdAt: record.createdAt,
  };
}

function asMetadata(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      metadata[key] = entry;
    }
  }
  return metadata;
}
