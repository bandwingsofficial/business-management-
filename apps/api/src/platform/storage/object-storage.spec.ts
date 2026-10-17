import { describe, expect, it } from 'vitest';

import { NotFoundError, ValidationError } from '@/common/errors/application-error';

import { InMemoryObjectStorage, validateUpload, verifySignature } from './object-storage';

const storage = new InMemoryObjectStorage(
  [
    {
      organizationId: 'org-a',
      objectKey: 'file-a',
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
    },
  ],
  'test-signing-secret',
  60,
);

describe('object storage', () => {
  it('rejects a cross-tenant object and an expired or foreign signature', async () => {
    const access = {
      principal: { userId: 'user-b', sessionId: 'jti' },
      organizationId: 'org-b',
      role: 'member' as const,
      permissions: ['storage.sign'],
    };
    await expect(
      storage.createSignedDownload(access, 'file-a', new Date('2026-01-01T00:00:00.000Z')),
    ).rejects.toBeInstanceOf(NotFoundError);

    const signed = await storage.createSignedDownload(
      { ...access, organizationId: 'org-a' },
      'file-a',
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(
      verifySignature(
        'test-signing-secret',
        signed.url,
        'org-b',
        new Date('2026-01-01T00:00:30.000Z'),
      ),
    ).toBe(false);
    expect(
      verifySignature(
        'test-signing-secret',
        signed.url,
        'org-a',
        new Date('2026-01-01T00:00:30.000Z'),
      ),
    ).toBe(true);
    expect(
      verifySignature(
        'test-signing-secret',
        signed.url,
        'org-a',
        new Date('2026-01-01T00:02:00.000Z'),
      ),
    ).toBe(false);
  });

  it('rejects unsafe file names and types', () => {
    expect(() =>
      validateUpload({ fileName: '../secret.txt', contentType: 'text/plain', sizeBytes: 4 }),
    ).toThrow(ValidationError);
    expect(() =>
      validateUpload({ fileName: 'notes.txt', contentType: 'application/x-sh', sizeBytes: 4 }),
    ).toThrow(ValidationError);
  });
});
