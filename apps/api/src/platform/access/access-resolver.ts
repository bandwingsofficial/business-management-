import {
  AuthenticationError,
  AuthorizationError,
  InfrastructureError,
  RateLimitError,
} from '@/common/errors/application-error';
import type { AccessContext } from '@/common/http/access-context';

import type { MembershipStore } from './membership-store';
import { permissionsForRole } from './permissions';
import type { RateLimiter } from './rate-limiter';
import type { CredentialRevocationStore } from './revocation-store';
import type { TokenVerifier } from './token-verifier';

export class AccessResolver {
  public constructor(
    private readonly tokens: TokenVerifier,
    private readonly memberships: MembershipStore,
    private readonly revocation: CredentialRevocationStore,
    private readonly limiter: RateLimiter,
    private readonly authLimit: number,
    private readonly windowSeconds: number,
  ) {}

  public async authenticate(input: {
    readonly token: string | undefined;
    readonly organizationId: string | undefined;
    readonly rateLimitKey: string;
  }): Promise<AccessContext> {
    let decision;
    try {
      decision = await this.limiter.consume(input.rateLimitKey, this.authLimit, this.windowSeconds);
    } catch (error) {
      if (error instanceof InfrastructureError) {
        throw error;
      }
      throw new InfrastructureError();
    }
    if (!decision.allowed) {
      throw new RateLimitError(decision.retryAfterSeconds);
    }
    if (input.token === undefined || input.token.length === 0) {
      throw new AuthenticationError();
    }

    const verified = await this.tokens.verify(input.token);
    if (await this.revocation.isRevoked(verified.jti)) {
      throw new AuthenticationError();
    }
    if (input.organizationId === undefined || input.organizationId.length === 0) {
      throw new AuthorizationError('ORGANIZATION_REQUIRED');
    }

    const membership = await this.memberships.findActive(verified.userId, input.organizationId);
    if (!membership) {
      throw new AuthorizationError('MEMBERSHIP_DENIED');
    }

    return {
      principal: { userId: verified.userId, sessionId: verified.jti },
      organizationId: membership.organizationId,
      role: membership.role,
      permissions: permissionsForRole(membership.role),
    };
  }
}
