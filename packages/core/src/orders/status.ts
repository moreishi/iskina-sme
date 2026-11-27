import type { Vertical } from '@iskina/contracts'

export const ORDER_STATUSES = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type OrderActor = 'customer' | 'merchant' | 'rider' | 'system'
export type OrderKind = 'delivery' | 'booking'

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
]

const DELIVERY_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  SCHEDULED: [],
  IN_PROGRESS: [],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
}

const BOOKING_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  PREPARING: [],
  READY: [],
  OUT_FOR_DELIVERY: [],
  DELIVERED: [],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
}

export function orderKindFor(vertical: Vertical): OrderKind {
  return vertical === 'aircon' ? 'booking' : 'delivery'
}

export function transitionsFor(vertical: Vertical): Record<OrderStatus, readonly OrderStatus[]> {
  return orderKindFor(vertical) === 'booking' ? BOOKING_TRANSITIONS : DELIVERY_TRANSITIONS
}

const MERCHANT_TARGETS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  PLACED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'SCHEDULED'],
  PREPARING: ['READY'],
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  SCHEDULED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
}

const CUSTOMER_TARGETS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  PLACED: ['CANCELLED'],
  ACCEPTED: ['CANCELLED'],
  SCHEDULED: ['CANCELLED'],
}

const RIDER_TARGETS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  OUT_FOR_DELIVERY: ['DELIVERED'],
}

/**
 * Data-driven guard. The API refuses anything this returns false for — the
 * database never receives an unlisted transition.
 */
export function canTransition(input: {
  vertical: Vertical
  from: OrderStatus
  to: OrderStatus
  actor: OrderActor
}): boolean {
  const allowed = transitionsFor(input.vertical)[input.from]
  if (!allowed.includes(input.to)) return false

  if (input.actor === 'system') return input.to === 'EXPIRED'
  if (input.actor === 'merchant') {
    return (MERCHANT_TARGETS[input.from] ?? []).includes(input.to)
  }
  if (input.actor === 'customer') {
    return (CUSTOMER_TARGETS[input.from] ?? []).includes(input.to)
  }
  return (RIDER_TARGETS[input.from] ?? []).includes(input.to)
}

export function nextStatuses(vertical: Vertical, from: OrderStatus): readonly OrderStatus[] {
  return transitionsFor(vertical)[from]
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
