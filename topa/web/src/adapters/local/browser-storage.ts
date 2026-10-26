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
  private storage: KeyValueStore | null
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
      if (!raw) return this.memory
      const parsed: unknown = JSON.parse(raw)
      if (
        parsed === null ||
        typeof parsed !== typeof this.memory ||
        Array.isArray(parsed) !== Array.isArray(this.memory)
      ) {
        this.storage = null
        return this.memory
      }
      this.memory = parsed as T
      return this.memory
    } catch {
      this.storage = null
      return this.memory
    }
  }

  write(value: T): void {
    this.memory = value
    try {
      this.storage?.setItem(this.key, JSON.stringify(value))
    } catch {
      // once a write fails, storage lags behind memory for the rest of the session
      this.storage = null
    }
  }
}
