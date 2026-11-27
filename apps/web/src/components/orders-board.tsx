'use client'

import { useCallback, useEffect, useState } from 'react'

type Status =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'

interface Line {
  id: string
  name: string
  quantity: number
  unitPriceCentavos: number
  lineTotalCentavos: number
}

interface BoardOrder {
  id: string
  number: string
  status: Status
  kind: 'delivery' | 'booking'
  contactName: string | null
  contactPhone: string
  totalCentavos: number
  address: string | null
  scheduledAt: string | null
  placedAt: string
  cashReceivedAt: string | null
  lines: Line[]
}

interface BoardResponse {
  orders?: { order: BoardOrder; lines: Line[] }[]
  error?: { message?: string }
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const NEXT_ACTIONS: Partial<Record<Status, { to: Status; label: string }[]>> = {
  PLACED: [
    { to: 'ACCEPTED', label: 'Accept' },
    { to: 'REJECTED', label: 'Reject' },
  ],
  PREPARING: [{ to: 'READY', label: 'Mark ready' }],
  READY: [{ to: 'OUT_FOR_DELIVERY', label: 'Out for delivery' }],
  OUT_FOR_DELIVERY: [{ to: 'DELIVERED', label: 'Delivered' }],
  DELIVERED: [{ to: 'COMPLETED', label: 'Complete' }],
  SCHEDULED: [{ to: 'IN_PROGRESS', label: 'Start service' }],
  IN_PROGRESS: [{ to: 'COMPLETED', label: 'Complete' }],
}

function actionsFor(order: BoardOrder): { to: Status; label: string }[] {
  if (order.status === 'ACCEPTED') {
    return order.kind === 'booking'
      ? [{ to: 'SCHEDULED', label: 'Schedule' }]
      : [{ to: 'PREPARING', label: 'Start preparing' }]
  }
  return NEXT_ACTIONS[order.status] ?? []
}

const ACTIVE: Status[] = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'SCHEDULED',
  'IN_PROGRESS',
]

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

export function OrdersBoard({
  businessId,
  initial,
}: {
  businessId: string
  initial: BoardOrder[]
}) {
  const [orders, setOrders] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'completed' | 'all'>('active')

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/merchant/orders?businessId=${encodeURIComponent(businessId)}`,
      )
      const data = (await response.json()) as BoardResponse
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not load orders')
        return
      }
      setOrders(
        (data.orders ?? []).map((row) => ({
          ...row.order,
          lines: row.lines,
        })),
      )
      setError(null)
    } catch {
      setError('Could not reach the server')
    }
  }, [businessId])

  useEffect(() => {
    const timer = setInterval(() => void load(), 5000)
    return () => clearInterval(timer)
  }, [load])

  async function transition(order: BoardOrder, to: Status) {
    setBusyId(order.id)
    setError(null)
    try {
      const response = await fetch(`/api/v1/merchant/orders/${order.id}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessId, to }),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } }
        setError(data.error?.message ?? 'Could not move the order')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function cashReceived(order: BoardOrder) {
    setBusyId(order.id)
    try {
      const response = await fetch(`/api/v1/merchant/orders/${order.id}/cash-received`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } }
        setError(data.error?.message ?? 'Could not confirm cash')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const visible = orders
    .filter((order) =>
      tab === 'all'
        ? true
        : tab === 'active'
          ? ACTIVE.includes(order.status)
          : !ACTIVE.includes(order.status),
    )
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-[var(--outline)] p-1">
          {(['active', 'completed', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${
                tab === value
                  ? 'bg-[var(--primary)] font-semibold text-[var(--on-primary)]'
                  : 'text-[var(--muted-text)]'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted-text)]">Live board · refreshes every 5s</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--outline)] p-8 text-center text-sm text-[var(--muted-text)]">
          No {tab === 'all' ? '' : tab} orders yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-[var(--muted-text)]">{order.number}</p>
                  <h3 className="mt-1 text-lg font-bold">
                    {peso.format(order.totalCentavos / 100)}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted-text)]">
                    {order.contactName ?? 'Customer'} · {order.contactPhone}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold tracking-wide">
                  {order.status.replaceAll('_', ' ')}
                </span>
              </div>

              <ul className="mt-3 space-y-1 text-sm">
                {order.lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3">
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                    <span className="font-mono text-xs text-[var(--muted-text)]">
                      {peso.format(line.lineTotalCentavos / 100)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-text)]">
                <span>Placed {formatTime(order.placedAt)}</span>
                {order.scheduledAt ? <span>Scheduled {formatTime(order.scheduledAt)}</span> : null}
                {order.address ? <span>{order.address}</span> : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {actionsFor(order).map((action) => (
                  <button
                    key={action.to}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => void transition(order, action.to)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${
                      action.to === 'REJECTED'
                        ? 'border border-[var(--danger)] text-[var(--danger)]'
                        : 'bg-[var(--primary)] text-[var(--on-primary)]'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
                {order.status === 'DELIVERED' || order.status === 'COMPLETED' ? (
                  order.cashReceivedAt ? (
                    <span className="rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[var(--success)]">
                      Cash received
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void cashReceived(order)}
                      className="rounded-lg border border-[var(--outline)] px-3 py-1.5 text-sm font-semibold"
                    >
                      Confirm cash
                    </button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
