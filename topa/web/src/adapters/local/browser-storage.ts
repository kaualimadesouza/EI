/** The slice of Storage the demo adapters use, so tests can hand in a Map. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

// reading localStorage itself throws in some sandboxed iframes
export function browserStorage(): KeyValueStore | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

/** A JSON value in storage; when storage is missing, full or corrupt, memory keeps the demo going. */
export class StoredValue<T> {
  private readonly storage: KeyValueStore | null
  private readonly key: string
  private memory: T

  constructor(storage: KeyValueStore | null, key: string, initial: T) {
    this.storage = storage
    this.key = key
    this.memory = initial
  }

  read(): T {
    try {
      const raw = this.storage?.getItem(this.key)
      return raw ? (JSON.parse(raw) as T) : this.memory
    } catch {
      return this.memory
    }
  }

  write(value: T): void {
    this.memory = value
    try {
      this.storage?.setItem(this.key, JSON.stringify(value))
    } catch {
      // quota or private mode: memory keeps it for this session
    }
  }
}
