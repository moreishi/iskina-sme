import { describe, expect, it } from 'vitest'
import {
  canTransition,
  isTerminal,
  nextStatuses,
  orderKindFor,
  transitionsFor,
} from '../src/orders/status'

describe('order kind', () => {
  it('maps aircon to booking and the rest to delivery', () => {
    expect(orderKindFor('food')).toBe('delivery')
    expect(orderKindFor('lpg')).toBe('delivery')
    expect(orderKindFor('aircon')).toBe('booking')
  })
})

describe('delivery state machine', () => {
  it('walks the happy path', () => {
    expect(
      canTransition({ vertical: 'food', from: 'PLACED', to: 'ACCEPTED', actor: 'merchant' }),
    ).toBe(true)
    expect(
      canTransition({
        vertical: 'food',
        from: 'READY',
        to: 'OUT_FOR_DELIVERY',
        actor: 'merchant',
      }),
    ).toBe(true)
    expect(
      canTransition({
        vertical: 'food',
        from: 'OUT_FOR_DELIVERY',
        to: 'DELIVERED',
        actor: 'rider',
      }),
    ).toBe(true)
    expect(
      canTransition({
        vertical: 'food',
        from: 'DELIVERED',
        to: 'COMPLETED',
        actor: 'merchant',
      }),
    ).toBe(true)
  })

  it('refuses skipping steps', () => {
    expect(
      canTransition({ vertical: 'food', from: 'PLACED', to: 'READY', actor: 'merchant' }),
    ).toBe(false)
    expect(
      canTransition({
        vertical: 'food',
        from: 'ACCEPTED',
        to: 'OUT_FOR_DELIVERY',
        actor: 'merchant',
      }),
    ).toBe(false)
  })

  it('lets a customer cancel only before work starts', () => {
    expect(
      canTransition({ vertical: 'food', from: 'PLACED', to: 'CANCELLED', actor: 'customer' }),
    ).toBe(true)
    expect(
      canTransition({ vertical: 'food', from: 'ACCEPTED', to: 'CANCELLED', actor: 'customer' }),
    ).toBe(true)
    expect(
      canTransition({
        vertical: 'food',
        from: 'PREPARING',
        to: 'CANCELLED',
        actor: 'customer',
      }),
    ).toBe(false)
  })

  it('expires only through the system actor', () => {
    expect(
      canTransition({ vertical: 'food', from: 'PLACED', to: 'EXPIRED', actor: 'system' }),
    ).toBe(true)
    expect(
      canTransition({ vertical: 'food', from: 'PLACED', to: 'EXPIRED', actor: 'merchant' }),
    ).toBe(false)
  })

  it('never leaves a terminal state', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] as const) {
      expect(isTerminal(status)).toBe(true)
      expect(nextStatuses('food', status)).toEqual([])
    }
  })
})

describe('booking state machine', () => {
  it('schedules and completes an aircon booking', () => {
    expect(
      canTransition({
        vertical: 'aircon',
        from: 'ACCEPTED',
        to: 'SCHEDULED',
        actor: 'merchant',
      }),
    ).toBe(true)
    expect(
      canTransition({
        vertical: 'aircon',
        from: 'SCHEDULED',
        to: 'IN_PROGRESS',
        actor: 'merchant',
      }),
    ).toBe(true)
    expect(
      canTransition({
        vertical: 'aircon',
        from: 'IN_PROGRESS',
        to: 'COMPLETED',
        actor: 'merchant',
      }),
    ).toBe(true)
  })

  it('cannot take a booking through delivery statuses', () => {
    expect(transitionsFor('aircon').ACCEPTED).toEqual(['SCHEDULED', 'CANCELLED'])
    expect(
      canTransition({
        vertical: 'aircon',
        from: 'ACCEPTED',
        to: 'PREPARING',
        actor: 'merchant',
      }),
    ).toBe(false)
  })
})
