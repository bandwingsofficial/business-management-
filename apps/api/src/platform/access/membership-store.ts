import type { Role } from '@/common/http/access-context';

export interface ActiveMembership {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: Role;
}

export interface MembershipStore {
  findActive(userId: string, organizationId: string): Promise<ActiveMembership | undefined>;
}

export interface MembershipRecord extends ActiveMembership {
  readonly status: 'active' | 'revoked';
}

export class InMemoryMembershipStore implements MembershipStore {
  public constructor(private readonly records: readonly MembershipRecord[]) {}

  public async findActive(
    userId: string,
    organizationId: string,
  ): Promise<ActiveMembership | undefined> {
    const record = this.records.find(
      (item) =>
        item.userId === userId &&
        item.organizationId === organizationId &&
        item.status === 'active',
    );
    if (!record) {
      return undefined;
    }
    return { organizationId: record.organizationId, userId: record.userId, role: record.role };
  }
}
