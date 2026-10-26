import { describe, expect, it } from 'vitest'

import { canMove, nextStatus, previousStatus, STATUS_LABEL } from './status'

describe('order status', () => {
  it('walks received, preparing, ready, delivered', () => {
    expect(nextStatus('received')).toBe('preparing')
    expect(nextStatus('preparing')).toBe('ready')
    expect(nextStatus('ready')).toBe('delivered')
    expect(nextStatus('delivered')).toBeNull()
  })

  it('steps back for an undo, never before received', () => {
    expect(previousStatus('delivered')).toBe('ready')
    expect(previousStatus('received')).toBeNull()
  })

  it('allows only one step in either direction', () => {
    expect(canMove('received', 'preparing')).toBe(true)
    expect(canMove('delivered', 'ready')).toBe(true)
    expect(canMove('received', 'delivered')).toBe(false)
    expect(canMove('ready', 'ready')).toBe(false)
  })

  it('names each status in Portuguese', () => {
    expect(Object.values(STATUS_LABEL)).toEqual(['Recebido', 'Em preparo', 'Pronto', 'Entregue'])
  })
})
