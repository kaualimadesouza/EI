import { describe, expect, it } from 'vitest'

import { LocalPrinterAdapter } from './local-printer'

describe('LocalPrinterAdapter', () => {
  it('supports printing, queues spool, and clears', async () => {
    const adapter = new LocalPrinterAdapter()
    expect(adapter.isSupported()).toBe(true)
    expect(adapter.spool).toHaveLength(0)

    const payload = new Uint8Array([1, 2, 3])
    await adapter.print(payload)
    expect(adapter.spool).toHaveLength(1)
    expect(adapter.spool[0]).toEqual(payload)

    adapter.clear()
    expect(adapter.spool).toHaveLength(0)
  })
})
