import type { OrderDraft, OrderSummary, PlacedOrder } from '../../domain/order'
import { generateClientOrderId, SyncQueue } from '../../domain/sync-queue'
import { OrderRejectedError, type OrdersPort } from '../../ports/orders'
import { browserStorage } from '../local/browser-storage'

export interface ResilientOrdersOptions {
  underlying: OrdersPort
  queue?: SyncQueue
  isOnline?: () => boolean
  onSyncComplete?: (results: { clientOrderId: string; order: PlacedOrder }[]) => void
}

/** Wraps orders port to provide offline resilience and automatic sync. */
export class OfflineResilientOrders implements OrdersPort {
  readonly queue: SyncQueue
  readonly underlying: OrdersPort
  private readonly isOnline: () => boolean
  private readonly onSyncComplete?: (results: { clientOrderId: string; order: PlacedOrder }[]) => void
  private syncing = false

  constructor(options: ResilientOrdersOptions) {
    this.underlying = options.underlying
    this.queue = options.queue ?? new SyncQueue(browserStorage())
    this.isOnline = options.isOnline ?? (() => navigator.onLine)
    this.onSyncComplete = options.onSyncComplete
  }

  async place(draft: OrderDraft, clientOrderId?: string): Promise<PlacedOrder> {
    const id = clientOrderId ?? generateClientOrderId()
    if (!this.isOnline()) {
      return this.enqueueOptimistic(draft, id)
    }
    try {
      return await this.underlying.place(draft, id)
    } catch (error) {
      if (error instanceof OrderRejectedError) {
        throw error
      }
      return this.enqueueOptimistic(draft, id)
    }
  }

  private enqueueOptimistic(draft: OrderDraft, clientOrderId: string): PlacedOrder {
    this.queue.enqueue(draft, clientOrderId)
    return {
      id: clientOrderId,
      number: 0,
      totalCents: 0,
      clientOrderId,
    }
  }

  async syncPending(): Promise<PlacedOrder[]> {
    if (this.syncing) return []
    this.syncing = true
    const syncedOrders: PlacedOrder[] = []
    const completionPayload: { clientOrderId: string; order: PlacedOrder }[] = []
    try {
      const pending = this.queue.listPending()
      for (const item of pending) {
        this.queue.markSyncing(item.clientOrderId)
        try {
          const placed = await this.underlying.place(item.draft, item.clientOrderId)
          this.queue.markSynced(item.clientOrderId, placed)
          this.queue.remove(item.clientOrderId)
          syncedOrders.push(placed)
          completionPayload.push({ clientOrderId: item.clientOrderId, order: placed })
        } catch (error) {
          if (error instanceof OrderRejectedError) {
            this.queue.markFailed(item.clientOrderId, error.message)
          } else {
            this.queue.markFailed(item.clientOrderId, error instanceof Error ? error.message : 'Falha de rede')
            break
          }
        }
      }
      if (completionPayload.length > 0) {
        this.onSyncComplete?.(completionPayload)
      }
      return syncedOrders
    } finally {
      this.syncing = false
    }
  }

  startAutoSync(windowTarget?: {
    addEventListener: (type: string, listener: () => void) => void
    removeEventListener: (type: string, listener: () => void) => void
  }): () => void {
    const target = windowTarget ?? window
    const handleOnline = () => {
      void this.syncPending()
    }
    target.addEventListener('online', handleOnline)
    return () => {
      target.removeEventListener('online', handleOnline)
    }
  }

  list(businessDate: string, storeSlug: string): Promise<OrderSummary[]> {
    return this.underlying.list(businessDate, storeSlug)
  }

  setStatus(orderId: string, status: OrderSummary['status']): Promise<OrderSummary> {
    return this.underlying.setStatus(orderId, status)
  }

  statusOf(orderId: string): Promise<OrderSummary['status']> {
    return this.underlying.statusOf(orderId)
  }

  listCustomerOrders(): Promise<OrderSummary[]> {
    return this.underlying.listCustomerOrders()
  }
}
