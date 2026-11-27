import type { MembershipView } from '@iskina/db'
import type { SessionContext } from '@/lib/auth/session'

export function businessMembership(
  session: SessionContext,
  businessId: string,
  roles: readonly MembershipView['role'][] = ['owner', 'manager'],
): MembershipView | null {
  return (
    session.memberships.find(
      (membership) => membership.businessId === businessId && roles.includes(membership.role),
    ) ?? null
  )
}
