import { getDb } from '../client'
import { withTenant } from '../context'
import { auditLogs } from '../schema'

export interface AuditInput {
  tenantId: string | null
  actorType: 'user' | 'api_key' | 'system'
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const values = {
    tenantId: input.tenantId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  }

  if (input.tenantId) {
    await withTenant(input.tenantId, (tx) => tx.insert(auditLogs).values(values))
    return
  }

  const db = getDb()
  await db.insert(auditLogs).values(values)
}
