import { and, eq, isNull } from 'drizzle-orm'
import { withTenant } from '../context'
import { type DeviceToken, deviceTokens } from '../schema'

export interface RegisterDeviceInput {
  tenantId: string
  businessId: string
  userId: string
  platform: 'android' | 'ios' | 'web'
  token: string
}

/** One token belongs to one device; re-registering refreshes it. */
export async function registerDevice(input: RegisterDeviceInput): Promise<DeviceToken> {
  return withTenant(input.tenantId, async (tx) => {
    const rows = await tx
      .insert(deviceTokens)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        userId: input.userId,
        platform: input.platform,
        token: input.token,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          tenantId: input.tenantId,
          businessId: input.businessId,
          userId: input.userId,
          platform: input.platform,
          lastSeenAt: new Date(),
          revokedAt: null,
        },
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('device registration returned no row')
    return row
  })
}

export async function listActiveDevices(
  tenantId: string,
  businessId: string,
): Promise<DeviceToken[]> {
  return withTenant(tenantId, (tx) =>
    tx
      .select()
      .from(deviceTokens)
      .where(
        and(
          eq(deviceTokens.tenantId, tenantId),
          eq(deviceTokens.businessId, businessId),
          isNull(deviceTokens.revokedAt),
        ),
      ),
  )
}

export async function revokeDevice(
  tenantId: string,
  businessId: string,
  id: string,
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .update(deviceTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(deviceTokens.id, id),
          eq(deviceTokens.tenantId, tenantId),
          eq(deviceTokens.businessId, businessId),
        ),
      )
      .returning({ id: deviceTokens.id })
    return rows.length > 0
  })
}
