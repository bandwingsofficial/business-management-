export const ROLES = ['owner', 'admin', 'member'] as const;

export type Role = (typeof ROLES)[number];

export interface Principal {
  readonly userId: string;
  readonly sessionId: string;
}

export interface AccessContext {
  readonly principal: Principal;
  readonly organizationId: string;
  readonly role: Role;
  readonly permissions: readonly string[];
}

export interface TenantScope {
  readonly organizationId: string;
}

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}
