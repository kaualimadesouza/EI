import type { OrderDraft, PlacedOrder } from './order'

export type QueuedOrderStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface QueuedOrder {
  clientOrderId: string
  draft: OrderDraft
  queuedAt: string
  status: QueuedOrderStatus
  retryCount: number
  lastAttemptAt?: string
  errorMessage?: string
  syncedOrder?: PlacedOrder
}

export function generateClientOrderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'order-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
}

export function createQueuedOrder(
  draft: OrderDraft,
  clientOrderId: string = generateClientOrderId(),
  now: Date = new Date(),
): QueuedOrder {
  return {
    clientOrderId,
    draft,
    queuedAt: now.toISOString(),
    status: 'pending',
    retryCount: 0,
  }
}

/** Local persistent queue for edge resiliency during connection loss. */
export class SyncQueue {
  private memory: QueuedOrder[] = []
  private storage: KeyValueStore | null
  private readonly key: string
  private readonly listeners: Set<() => void> = new Set()

  constructor(storage: KeyValueStore | null = null, key = 'topa.sync_queue.v1') {
    this.storage = storage
    this.key = key
    this.readFromStorage()
  }

  private readFromStorage(): QueuedOrder[] {
    try {
      const raw = this.storage?.getItem(this.key)
      if (!raw) return this.memory
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        this.memory = parsed as QueuedOrder[]
      }
    } catch {
      this.storage = null
    }
    return this.memory
  }

  private writeToStorage(items: QueuedOrder[]): void {
    this.memory = items
    try {
      this.storage?.setItem(this.key, JSON.stringify(items))
    } catch {
      this.storage = null
    }
  }

  enqueue(draft: OrderDraft, clientOrderId?: string): QueuedOrder {
    const order = createQueuedOrder(draft, clientOrderId)
    const current = this.readFromStorage()
    this.writeToStorage([...current, order])
    this.notify()
    return order
  }

  list(): QueuedOrder[] {
    return this.readFromStorage()
  }

  listPending(): QueuedOrder[] {
    return this.readFromStorage().filter((item) => item.status === 'pending' || item.status === 'failed')
  }

  peek(): QueuedOrder | undefined {
    return this.listPending()[0]
  }

  markSyncing(clientOrderId: string): void {
    const current = this.readFromStorage()
    const updated = current.map((item) =>
      item.clientOrderId === clientOrderId
        ? {
            ...item,
            status: 'syncing' as const,
            retryCount: item.retryCount + 1,
            lastAttemptAt: new Date().toISOString(),
          }
        : item,
    )
    this.writeToStorage(updated)
    this.notify()
  }

  markSynced(clientOrderId: string, order: PlacedOrder): void {
    const current = this.readFromStorage()
    const updated = current.map((item) =>
      item.clientOrderId === clientOrderId
        ? {
            ...item,
            status: 'synced' as const,
            syncedOrder: order,
          }
        : item,
    )
    this.writeToStorage(updated)
    this.notify()
  }

  markFailed(clientOrderId: string, errorMessage: string): void {
    const current = this.readFromStorage()
    const updated = current.map((item) =>
      item.clientOrderId === clientOrderId
        ? {
            ...item,
            status: 'failed' as const,
            errorMessage,
          }
        : item,
    )
    this.writeToStorage(updated)
    this.notify()
  }

  remove(clientOrderId: string): void {
    const current = this.readFromStorage()
    this.writeToStorage(current.filter((item) => item.clientOrderId !== clientOrderId))
    this.notify()
  }

  clear(): void {
    this.writeToStorage([])
    this.notify()
  }

  getPendingCount(): number {
    return this.listPending().length
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
