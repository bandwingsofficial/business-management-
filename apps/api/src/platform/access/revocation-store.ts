import { InfrastructureError } from '@/common/errors/application-error';

export interface CredentialRevocation {
  readonly jti: string;
  readonly expiresAt: Date;
}

export interface CredentialRevocationStore {
  revoke(entry: CredentialRevocation): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}

export function createRevocationStore(env: string): CredentialRevocationStore {
  if (env === 'production') {
    return new UnavailableRevocationStore();
  }
  return new InMemoryRevocationStore();
}

export class UnavailableRevocationStore implements CredentialRevocationStore {
  public async revoke(): Promise<void> {
    throw new InfrastructureError();
  }

  public async isRevoked(): Promise<boolean> {
    throw new InfrastructureError();
  }
}

export class InMemoryRevocationStore implements CredentialRevocationStore {
  private readonly revoked = new Map<string, Date>();

  public async revoke(entry: CredentialRevocation): Promise<void> {
    this.revoked.set(entry.jti, entry.expiresAt);
  }

  public async isRevoked(jti: string): Promise<boolean> {
    const expiresAt = this.revoked.get(jti);
    if (expiresAt === undefined) {
      return false;
    }
    if (expiresAt.getTime() <= Date.now()) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }
}
