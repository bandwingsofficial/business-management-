import { AuthenticationError } from '@/common/errors/application-error';

export interface VerifiedAccessToken {
  readonly userId: string;
  readonly jti: string;
  readonly expiresAt: Date;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedAccessToken>;
}

export class RejectingTokenVerifier implements TokenVerifier {
  public async verify(_token: string): Promise<VerifiedAccessToken> {
    throw new AuthenticationError();
  }
}

export class StaticTokenVerifier implements TokenVerifier {
  public constructor(private readonly tokens: ReadonlyMap<string, VerifiedAccessToken>) {}

  public async verify(token: string): Promise<VerifiedAccessToken> {
    const verified = this.tokens.get(token);
    if (!verified || verified.expiresAt.getTime() <= Date.now()) {
      throw new AuthenticationError();
    }
    return verified;
  }
}
