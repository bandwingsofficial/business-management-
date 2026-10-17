import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from '@/common/errors/application-error';
import type { AccessContext, TenantScope } from '@/common/http/access-context';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']);
const MAX_BYTES = 10_485_760;

export interface StoredObjectRecord {
  readonly organizationId: string;
  readonly objectKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface SignedObjectUrl {
  readonly objectKey: string;
  readonly url: string;
  readonly expiresAt: string;
}

export interface ObjectStorage {
  createSignedDownload(
    access: AccessContext,
    objectKey: string,
    now?: Date,
  ): Promise<SignedObjectUrl>;
}

export class DisabledObjectStorage implements ObjectStorage {
  public async createSignedDownload(): Promise<SignedObjectUrl> {
    throw new InfrastructureError('STORAGE_UNAVAILABLE');
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  public constructor(
    private readonly records: readonly StoredObjectRecord[],
    private readonly secret: string,
    private readonly ttlSeconds = 60,
  ) {}

  public async createSignedDownload(
    access: AccessContext,
    objectKey: string,
    now = new Date(),
  ): Promise<SignedObjectUrl> {
    const scope: TenantScope = { organizationId: access.organizationId };
    const record = this.records.find(
      (item) => item.objectKey === objectKey && item.organizationId === scope.organizationId,
    );
    if (!record) {
      throw new NotFoundError();
    }
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const url = sign(this.secret, scope.organizationId, record.objectKey, expiresAt);
    return { objectKey: record.objectKey, url, expiresAt: expiresAt.toISOString() };
  }
}

export function validateUpload(input: {
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}): { readonly fileName: string; readonly contentType: string; readonly sizeBytes: number } {
  const fileName = input.fileName.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120);
  if (fileName.length === 0 || fileName.includes('..')) {
    throw new ValidationError([{ path: 'fileName', message: 'fileName is not safe' }]);
  }
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw new ValidationError([{ path: 'contentType', message: 'contentType is not allowed' }]);
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > MAX_BYTES) {
    throw new ValidationError([
      { path: 'sizeBytes', message: 'sizeBytes is outside the allowed range' },
    ]);
  }
  return { fileName, contentType: input.contentType, sizeBytes: input.sizeBytes };
}

export function sign(
  secret: string,
  organizationId: string,
  objectKey: string,
  expiresAt: Date,
): string {
  const payload = `${organizationId}.${objectKey}.${String(expiresAt.getTime())}`;
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `v1.${Buffer.from(payload).toString('base64url')}.${mac}`;
}

export function verifySignature(
  secret: string,
  url: string,
  organizationId: string,
  now = new Date(),
): boolean {
  const parts = url.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || parts[1] === undefined || parts[2] === undefined) {
    return false;
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  const [org, objectKey, expiresRaw] = payload.split('.');
  if (org !== organizationId || objectKey === undefined || expiresRaw === undefined) {
    return false;
  }
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(parts[2]);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
