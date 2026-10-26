import { describe, expect, it } from 'vitest'

import { browserStorage, StoredValue } from './browser-storage'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

describe('StoredValue', () => {
  it('starts from the initial value and keeps what was written as JSON', () => {
    const storage = new MemoryStorage()
    const value = new StoredValue<string[]>(storage, 'k', [])

    expect(value.read()).toEqual([])
    value.write(['coxinha'])

    expect(storage.data.get('k')).toBe('["coxinha"]')
    expect(new StoredValue<string[]>(storage, 'k', []).read()).toEqual(['coxinha'])
  })

  it('keeps working from memory when storage is missing', () => {
    const value = new StoredValue<number>(null, 'k', 0)

    value.write(3)

    expect(value.read()).toBe(3)
  })

  it('keeps working from memory when storage throws or holds garbage', () => {
    const broken = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('quota')
      },
    }
    const value = new StoredValue<number>(broken, 'k', 0)

    value.write(5)

    expect(value.read()).toBe(5)
  })
})

describe('browserStorage', () => {
  it('is the page localStorage', () => {
    expect(browserStorage()).toBe(localStorage)
  })

  it('is null when reading localStorage itself throws, as in a sandboxed iframe', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
    try {
      expect(browserStorage()).toBeNull()
    } finally {
      Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
