import { isRole } from '@/common/http/access-context';
import type { ActiveMembership, MembershipStore } from '@/platform/access/membership-store';

import type { PrismaService } from './prisma.service';

export class PrismaMembershipStore implements MembershipStore {
  public constructor(private readonly prisma: PrismaService) {}

  public async findActive(
    userId: string,
    organizationId: string,
  ): Promise<ActiveMembership | undefined> {
    const record = await this.prisma.membership.findFirst({
      where: { userId, organizationId, status: 'active' },
      select: { userId: true, organizationId: true, role: true },
    });
    if (!record || !isRole(record.role)) {
      return undefined;
    }
    return { userId: record.userId, organizationId: record.organizationId, role: record.role };
  }
}
