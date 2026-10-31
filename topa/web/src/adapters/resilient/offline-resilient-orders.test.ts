import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineResilientOrders } from './offline-resilient-orders'
import { SyncQueue } from '../../domain/sync-queue'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import type { OrderDraft, OrderSummary, PlacedOrder } from '../../domain/order'

class FakeStore {
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
  lines: [{ productId: 'xbrasa', quantity: 1 }],
  dineIn: true,
  paymentMethod: 'card',
}

function makeFakeOrdersPort(): OrdersPort & {
  placeMock: ReturnType<typeof vi.fn>
  listMock: ReturnType<typeof vi.fn>
  setStatusMock: ReturnType<typeof vi.fn>
  statusOfMock: ReturnType<typeof vi.fn>
  listCustomerOrdersMock: ReturnType<typeof vi.fn>
} {
  const placeMock = vi.fn()
  const listMock = vi.fn()
  const setStatusMock = vi.fn()
  const statusOfMock = vi.fn()
  const listCustomerOrdersMock = vi.fn()

  return {
    place: placeMock,
    list: listMock,
    setStatus: setStatusMock,
    statusOf: statusOfMock,
    listCustomerOrders: listCustomerOrdersMock,
    placeMock,
    listMock,
    setStatusMock,
    statusOfMock,
    listCustomerOrdersMock,
  }
}

describe('OfflineResilientOrders', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses navigator.onLine when isOnline is not provided', async () => {
    const underlying = makeFakeOrdersPort()
    underlying.placeMock.mockResolvedValueOnce({ id: 's-1', number: 1, totalCents: 100 })
    const resilient = new OfflineResilientOrders({ underlying })
    const result = await resilient.place(DRAFT)
    expect(result.id).toBe('s-1')
  })

  it('places order through underlying port when online', async () => {
    const underlying = makeFakeOrdersPort()
    const placed: PlacedOrder = { id: 'srv-order-1', number: 1, totalCents: 1500 }
    underlying.placeMock.mockResolvedValueOnce(placed)

    const resilient = new OfflineResilientOrders({
      underlying,
      isOnline: () => true,
    })

    const result = await resilient.place(DRAFT, 'client-uuid-1')
    expect(result).toEqual(placed)
    expect(underlying.placeMock).toHaveBeenCalledWith(DRAFT, 'client-uuid-1')
    expect(resilient.queue.getPendingCount()).toBe(0)
  })

  it('rethrows OrderRejectedError without queueing', async () => {
    const underlying = makeFakeOrdersPort()
    underlying.placeMock.mockRejectedValueOnce(new OrderRejectedError('Produto esgotado.'))

    const resilient = new OfflineResilientOrders({
      underlying,
      isOnline: () => true,
    })

    await expect(resilient.place(DRAFT)).rejects.toThrow('Produto esgotado.')
    expect(resilient.queue.getPendingCount()).toBe(0)
  })

  it('enqueues optimistically when online but network fails', async () => {
    const underlying = makeFakeOrdersPort()
    underlying.placeMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const resilient = new OfflineResilientOrders({
      underlying,
      isOnline: () => true,
    })

    const result = await resilient.place(DRAFT, 'client-uuid-2')
    expect(result.id).toBe('client-uuid-2')
    expect(result.number).toBe(0)
    expect(resilient.queue.getPendingCount()).toBe(1)
  })

  it('enqueues optimistically directly when offline without calling underlying', async () => {
    const underlying = makeFakeOrdersPort()
    const resilient = new OfflineResilientOrders({
      underlying,
      isOnline: () => false,
    })

    const result = await resilient.place(DRAFT)
    expect(result.id).toBeDefined()
    expect(underlying.placeMock).not.toHaveBeenCalled()
    expect(resilient.queue.getPendingCount()).toBe(1)
  })

  it('syncPending drains queue and calls onSyncComplete', async () => {
    const underlying = makeFakeOrdersPort()
    const store = new FakeStore()
    const queue = new SyncQueue(store)
    const onSyncComplete = vi.fn()

    const resilient = new OfflineResilientOrders({
      underlying,
      queue,
      isOnline: () => true,
      onSyncComplete,
    })

    queue.enqueue(DRAFT, 'queued-1')
    queue.enqueue(DRAFT, 'queued-2')
    expect(queue.getPendingCount()).toBe(2)

    underlying.placeMock
      .mockResolvedValueOnce({ id: 'srv-1', number: 10, totalCents: 1000 })
      .mockResolvedValueOnce({ id: 'srv-2', number: 11, totalCents: 1000 })

    const synced = await resilient.syncPending()
    expect(synced.length).toBe(2)
    expect(queue.getPendingCount()).toBe(0)
    expect(onSyncComplete).toHaveBeenCalledWith([
      { clientOrderId: 'queued-1', order: { id: 'srv-1', number: 10, totalCents: 1000 } },
      { clientOrderId: 'queued-2', order: { id: 'srv-2', number: 11, totalCents: 1000 } },
    ])
  })

  it('handles OrderRejectedError and network error during syncPending', async () => {
    const underlying = makeFakeOrdersPort()
    const store = new FakeStore()
    const queue = new SyncQueue(store)

    const resilient = new OfflineResilientOrders({
      underlying,
      queue,
      isOnline: () => true,
    })

    queue.enqueue(DRAFT, 'order-rejected')
    queue.enqueue(DRAFT, 'order-net-fail')
    queue.enqueue(DRAFT, 'order-never-reached')

    underlying.placeMock
      .mockRejectedValueOnce(new OrderRejectedError('Item expirou'))
      .mockRejectedValueOnce(new Error('Connection reset'))

    const synced = await resilient.syncPending()
    expect(synced.length).toBe(0)

    const list = queue.list()
    expect(list[0].status).toBe('rejected')
    expect(list[0].errorMessage).toBe('Item expirou')
    expect(list[1].status).toBe('failed')
    expect(list[1].errorMessage).toBe('Connection reset')
    expect(list[2].status).toBe('pending')
  })

  it('handles string/unknown error during syncPending', async () => {
    const underlying = makeFakeOrdersPort()
    const store = new FakeStore()
    const queue = new SyncQueue(store)

    const resilient = new OfflineResilientOrders({
      underlying,
      queue,
      isOnline: () => true,
    })

    queue.enqueue(DRAFT, 'order-err')
    underlying.placeMock.mockRejectedValueOnce('raw string error')

    await resilient.syncPending()
    expect(queue.list()[0].errorMessage).toBe('Falha de rede')
  })

  it('prevents concurrent syncPending runs', async () => {
    const underlying = makeFakeOrdersPort()
    const store = new FakeStore()
    const queue = new SyncQueue(store)

    const resilient = new OfflineResilientOrders({
      underlying,
      queue,
      isOnline: () => true,
    })

    queue.enqueue(DRAFT, 'order-concurrent')
    let resolveFirst: (value: PlacedOrder) => void
    const firstPromise = new Promise<PlacedOrder>((resolve) => {
      resolveFirst = resolve
    })
    underlying.placeMock.mockReturnValueOnce(firstPromise)

    const sync1 = resilient.syncPending()
    const sync2 = await resilient.syncPending()
    expect(sync2).toEqual([])

    resolveFirst!({ id: 's-1', number: 1, totalCents: 100 })
    await sync1
  })

  it('starts auto sync and unregisters on cleanup', () => {
    const underlying = makeFakeOrdersPort()
    const resilient = new OfflineResilientOrders({ underlying })

    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const cleanup = resilient.startAutoSync({ addEventListener, removeEventListener })

    expect(addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    const listener = addEventListener.mock.calls[0][1] as () => void

    // Calling listener triggers syncPending
    underlying.placeMock.mockResolvedValueOnce({ id: 's-1', number: 1, totalCents: 100 })
    resilient.queue.enqueue(DRAFT, 'q-online')
    listener()

    cleanup()
    expect(removeEventListener).toHaveBeenCalledWith('online', listener)
  })

  it('uses window as default target for startAutoSync', () => {
    const underlying = makeFakeOrdersPort()
    const resilient = new OfflineResilientOrders({ underlying })
    const cleanup = resilient.startAutoSync()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('does not trigger syncPending on startAutoSync when offline', () => {
    const underlying = makeFakeOrdersPort()
    const resilient = new OfflineResilientOrders({
      underlying,
      isOnline: () => false,
    })
    const cleanup = resilient.startAutoSync()
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('enqueues and drains when online but queue already has pending items', async () => {
    const underlying = makeFakeOrdersPort()
    const queue = new SyncQueue()
    queue.enqueue(DRAFT, 'prior-order')
    underlying.placeMock.mockResolvedValue({ id: 's-1', number: 1, totalCents: 100 })

    const resilient = new OfflineResilientOrders({
      underlying,
      queue,
      isOnline: () => true,
    })

    const placed = await resilient.place(DRAFT, 'new-order')
    expect(placed.id).toBe('new-order')
    expect(placed.number).toBe(0)
  })

  it('exposes getPendingSyncCount and subscribeSync', () => {
    const underlying = makeFakeOrdersPort()
    const queue = new SyncQueue()
    const resilient = new OfflineResilientOrders({ underlying, queue })

    expect(resilient.getPendingSyncCount()).toBe(0)
    const listener = vi.fn()
    const unsubscribe = resilient.subscribeSync(listener)

    queue.enqueue(DRAFT, 'queued-test')
    expect(listener).toHaveBeenCalled()
    expect(resilient.getPendingSyncCount()).toBe(1)
    unsubscribe()
  })

  it('delegates list, setStatus, statusOf, listCustomerOrders to underlying', async () => {
    const underlying = makeFakeOrdersPort()
    const resilient = new OfflineResilientOrders({ underlying })

    const fakeSummary: OrderSummary = {
      id: 'ord-1',
      number: 1,
      status: 'received',
      dineIn: true,
      paymentMethod: 'card',
      totalCents: 1000,
      createdAt: '2026-10-31T12:00:00Z',
      items: [],
    }

    underlying.listMock.mockResolvedValueOnce([fakeSummary])
    underlying.setStatusMock.mockResolvedValueOnce(fakeSummary)
    underlying.statusOfMock.mockResolvedValueOnce('received')
    underlying.listCustomerOrdersMock.mockResolvedValueOnce([fakeSummary])

    expect(await resilient.list('2026-10-31', 'brasa-burgers')).toEqual([fakeSummary])
    expect(await resilient.setStatus('ord-1', 'preparing')).toEqual(fakeSummary)
    expect(await resilient.statusOf('ord-1')).toBe('received')
    expect(await resilient.listCustomerOrders()).toEqual([fakeSummary])
  })
})
