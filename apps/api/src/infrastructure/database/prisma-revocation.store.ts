import type {
  CredentialRevocation,
  CredentialRevocationStore,
} from '@/platform/access/revocation-store';

import type { PrismaService } from './prisma.service';

export class PrismaRevocationStore implements CredentialRevocationStore {
  public constructor(private readonly prisma: PrismaService) {}

  public async revoke(entry: CredentialRevocation): Promise<void> {
    await this.prisma.revokedCredential.upsert({
      where: { jti: entry.jti },
      update: { expiresAt: entry.expiresAt },
      create: { jti: entry.jti, expiresAt: entry.expiresAt },
    });
  }

  public async isRevoked(jti: string): Promise<boolean> {
    const record = await this.prisma.revokedCredential.findUnique({ where: { jti } });
    return record !== null && record.expiresAt.getTime() > Date.now();
  }
}
