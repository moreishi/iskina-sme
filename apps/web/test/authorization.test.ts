import type { MembershipView } from '@iskina/db'
import { describe, expect, it } from 'vitest'
import { businessMembership } from '../src/lib/auth/business'
import { ownerMembership, type SessionContext } from '../src/lib/auth/session'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

function membership(overrides: Partial<MembershipView>): MembershipView {
  return {
    tenantId: A,
    tenantName: 'Tenant A',
    tenantSlug: 'tenant-a',
    businessId: null,
    businessName: null,
    businessSlug: null,
    vertical: null,
    role: 'owner',
    ...overrides,
  }
}

const session: SessionContext = {
  user: { id: 'user-1', phone: '+639170000001', name: null, email: null },
  memberships: [
    membership({ tenantId: A, businessId: 'biz-a', businessName: 'A', businessSlug: 'a' }),
    membership({
      tenantId: B,
      businessId: 'biz-b',
      businessName: 'B',
      businessSlug: 'b',
      role: 'manager',
    }),
  ],
}

describe('owner membership resolution', () => {
  it('defaults to the first owned tenant', () => {
    expect(ownerMembership(session)?.tenantId).toBe(A)
  })

  it('refuses a tenant where the user is only a manager', () => {
    expect(ownerMembership(session, B)).toBeNull()
  })

  it('refuses an arbitrary tenant id', () => {
    expect(ownerMembership(session, '33333333-3333-4333-8333-333333333333')).toBeNull()
  })

  it('refuses staff-only sessions', () => {
    const staff: SessionContext = {
      user: session.user,
      memberships: [membership({ role: 'staff' })],
    }
    expect(ownerMembership(staff)).toBeNull()
  })
})

describe('business membership', () => {
  it('allows the owner and manager of the business', () => {
    expect(businessMembership(session, 'biz-a')?.role).toBe('owner')
    expect(businessMembership(session, 'biz-b', ['owner', 'manager'])?.role).toBe('manager')
  })

  it('refuses staff when an edit role is required', () => {
    const staff: SessionContext = {
      user: session.user,
      memberships: [membership({ businessId: 'biz-a', role: 'staff' })],
    }
    expect(businessMembership(staff, 'biz-a')).toBeNull()
    expect(businessMembership(staff, 'biz-a', ['owner', 'manager', 'staff'])?.role).toBe('staff')
  })

  it('refuses a business the user does not belong to', () => {
    expect(businessMembership(session, 'biz-c')).toBeNull()
  })
})
