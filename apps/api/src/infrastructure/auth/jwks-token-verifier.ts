import { createRemoteJWKSet, jwtVerify } from 'jose';

import { AuthenticationError } from '@/common/errors/application-error';
import type { TokenVerifier, VerifiedAccessToken } from '@/platform/access/token-verifier';

export class JwksTokenVerifier implements TokenVerifier {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>;

  public constructor(
    private readonly issuer: string,
    private readonly audience: string,
    jwksUri: string,
  ) {
    this.keys = createRemoteJWKSet(new URL(jwksUri));
  }

  public async verify(token: string): Promise<VerifiedAccessToken> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        throw new AuthenticationError();
      }
      return { userId: payload.sub, jti: payload.jti, expiresAt: new Date(payload.exp * 1000) };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError();
    }
  }
}
