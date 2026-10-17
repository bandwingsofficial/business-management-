import type { Role } from '@/common/http/access-context';

export const PERMISSIONS = [
  'organization.read',
  'membership.read',
  'audit.read',
  'storage.sign',
  'credential.revoke',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    'organization.read',
    'membership.read',
    'audit.read',
    'storage.sign',
    'credential.revoke',
  ],
  member: ['organization.read', 'storage.sign'],
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(permissions: readonly string[], required: Permission): boolean {
  return permissions.includes(required);
}
