import type { ApiKeyScope } from './api-key'

export const MEMBERSHIP_ROLES = ['owner', 'manager', 'staff'] as const
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number]

export function isMembershipRole(value: string): value is MembershipRole {
  return (MEMBERSHIP_ROLES as readonly string[]).includes(value)
}

/** Owners manage the tenant; managers run the store; staff process orders. */
export function canManageApiKeys(role: MembershipRole): boolean {
  return role === 'owner'
}

export function canManageBusiness(role: MembershipRole): boolean {
  return role === 'owner' || role === 'manager'
}

export function canProcessOrders(role: MembershipRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'staff'
}

/** A channel key may only be granted scopes the tenant owner could use. */
export function allowedScopesForRole(role: MembershipRole): readonly ApiKeyScope[] {
  if (role === 'owner') {
    return [
      'storefront:read',
      'catalog:read',
      'themes:read',
      'orders:read',
      'orders:write',
      'analytics:read',
    ]
  }
  if (role === 'manager') {
    return ['storefront:read', 'catalog:read', 'themes:read', 'orders:read', 'orders:write']
  }
  return ['storefront:read', 'orders:read']
}
