import { describe, expect, it, vi } from 'vitest'
import { createQueuedOrder, generateClientOrderId, SyncQueue, type KeyValueStore } from './sync-queue'
import type { OrderDraft, PlacedOrder } from './order'

class MemoryStore {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

const DRAFT: OrderDraft = {
  storeSlug: 'brasa-burgers',
  lines: [{ productId: 'xbrasa', quantity: 2 }],
  dineIn: true,
  paymentMethod: 'card',
}

describe('SyncQueue', () => {
  it('generates unique client order ids', () => {
    const id1 = generateClientOrderId()
    const id2 = generateClientOrderId()
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
  })

  it('generates fallback id when crypto.randomUUID is absent', () => {
    const origCrypto = globalThis.crypto
    // @ts-expect-error intentionally altering crypto for test
    delete globalThis.crypto
    const fallbackId = generateClientOrderId()
    expect(fallbackId.startsWith('order-')).toBe(true)
    globalThis.crypto = origCrypto
  })

  it('creates queued order with default and custom values', () => {
    const fixedDate = new Date('2026-10-31T12:00:00Z')
    const order1 = createQueuedOrder(DRAFT, 'custom-id-123', fixedDate)
    expect(order1.clientOrderId).toBe('custom-id-123')
    expect(order1.queuedAt).toBe('2026-10-31T12:00:00.000Z')
    expect(order1.status).toBe('pending')
    expect(order1.retryCount).toBe(0)

    const order2 = createQueuedOrder(DRAFT)
    expect(order2.clientOrderId).toBeTruthy()
  })

  it('enqueues, peeks, lists, and tracks pending count', () => {
    const store = new MemoryStore()
    const queue = new SyncQueue(store)
    const listener = vi.fn()
    const unsubscribe = queue.subscribe(listener)

    expect(queue.getPendingCount()).toBe(0)
    expect(queue.peek()).toBeUndefined()

    const item = queue.enqueue(DRAFT, 'order-1')
    expect(item.clientOrderId).toBe('order-1')
    expect(queue.getPendingCount()).toBe(1)
    expect(queue.peek()?.clientOrderId).toBe('order-1')
    expect(queue.list().length).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    queue.enqueue(DRAFT, 'order-2')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('marks items syncing, synced, and failed', () => {
    const store = new MemoryStore()
    const queue = new SyncQueue(store)

    queue.enqueue(DRAFT, 'order-1')
    queue.markSyncing('order-1')
    const syncingItem = queue.list()[0]
    expect(syncingItem.status).toBe('syncing')
    expect(syncingItem.retryCount).toBe(1)
    expect(syncingItem.lastAttemptAt).toBeDefined()

    // markSyncing on non-existent id leaves items unchanged
    queue.markSyncing('non-existent')

    const placed: PlacedOrder = { id: 'srv-1', number: 42, totalCents: 2000 }
    queue.markSynced('order-1', placed)
    expect(queue.list()[0].status).toBe('synced')
    expect(queue.list()[0].syncedOrder).toEqual(placed)
    expect(queue.listPending().length).toBe(0)
    queue.markSynced('non-existent', placed)

    queue.markFailed('order-1', 'Network timeout')
    expect(queue.list()[0].status).toBe('failed')
    expect(queue.list()[0].errorMessage).toBe('Network timeout')
    expect(queue.listPending().length).toBe(1)
    expect(queue.peek()?.clientOrderId).toBe('order-1')
    queue.markFailed('non-existent', 'error')

    queue.remove('order-1')
    expect(queue.list().length).toBe(0)

    queue.enqueue(DRAFT, 'order-3')
    queue.clear()
    expect(queue.list().length).toBe(0)
  })

  it('handles corrupted JSON or non-array data in storage gracefully', () => {
    const store = new MemoryStore()
    store.setItem('topa.sync_queue.v1', '{ invalid json')
    const queueCorrupt = new SyncQueue(store)
    expect(queueCorrupt.list()).toEqual([])

    store.setItem('topa.sync_queue.v1', '{"not": "an array"}')
    const queueObject = new SyncQueue(store)
    expect(queueObject.list()).toEqual([])
  })

  it('handles write failures on storage gracefully with memory fallback', () => {
    const throwingStore: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const queue = new SyncQueue(throwingStore)
    const enqueued = queue.enqueue(DRAFT, 'mem-order-1')
    expect(enqueued.clientOrderId).toBe('mem-order-1')
    expect(queue.list().length).toBe(1)
  })
})
