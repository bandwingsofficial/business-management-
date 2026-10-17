import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { AuthorizationError, NotFoundError } from '@/common/errors/application-error';
import type { AccessContext } from '@/common/http/access-context';
import { requestContext } from '@/common/http/request-context';
import { ValidateRequest } from '@/common/validation/validate-request.decorator';

import type { CredentialRevocationStore } from '../access/revocation-store';
import { AUDIT_LOG, OBJECT_STORAGE, REVOCATION_STORE } from '../access/tokens';
import type { AuditLog } from '../audit/audit-log';
import type { ObjectStorage } from '../storage/object-storage';
import { validateUpload } from '../storage/object-storage';
import { RequirePermission } from './auth.guard';

const uploadSchema = z
  .strictObject({
    fileName: z.string().min(1).max(120),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

@ApiTags('platform')
@ApiBearerAuth()
@Controller({ version: '1' })
export class PlatformController {
  public constructor(
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(REVOCATION_STORE) private readonly revocation: CredentialRevocationStore,
  ) {}

  @Get('auth/context')
  @RequirePermission('organization.read')
  public context(): { organizationId: string; role: string } {
    const access = requiredAccess();
    return { organizationId: access.organizationId, role: access.role };
  }

  @Post('auth/revoke')
  @RequirePermission('credential.revoke')
  public async revoke(): Promise<{ revoked: true }> {
    const access = requiredAccess();
    await this.revocation.revoke({
      jti: access.principal.sessionId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await this.audit.append({
      organizationId: access.organizationId,
      actorId: access.principal.userId,
      action: 'credential.revoked',
      resourceType: 'credential',
      resourceId: access.principal.sessionId,
      requestId: requestContext.current()?.requestId,
      metadata: {},
    });
    return { revoked: true };
  }

  @Get('audit/:id')
  @RequirePermission('audit.read')
  public async auditRecord(@Param('id') id: string): Promise<{ id: string; action: string }> {
    const access = requiredAccess();
    const record = await this.audit.findById({ organizationId: access.organizationId }, id);
    if (!record) {
      throw new NotFoundError();
    }
    return { id: record.id, action: record.action };
  }

  @Post('storage/downloads')
  @RequirePermission('storage.sign')
  @ValidateRequest(uploadSchema)
  public async signDownload(
    @Body() body: { fileName: string; contentType: string; sizeBytes: number },
    @Headers('x-object-key') objectKey: string | undefined,
  ): Promise<{ objectKey: string; url: string; expiresAt: string }> {
    const access = requiredAccess();
    validateUpload(body);
    if (objectKey === undefined || objectKey.length === 0) {
      throw new NotFoundError();
    }
    const signed = await this.storage.createSignedDownload(access, objectKey);
    await this.audit.append({
      organizationId: access.organizationId,
      actorId: access.principal.userId,
      action: 'storage.sign',
      resourceType: 'object',
      resourceId: objectKey,
      requestId: requestContext.current()?.requestId,
      metadata: { contentType: body.contentType },
    });
    return signed;
  }
}

function requiredAccess(): AccessContext {
  const access = requestContext.current()?.access;
  if (!access) {
    throw new AuthorizationError('ORGANIZATION_REQUIRED');
  }
  return access;
}
