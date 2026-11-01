import { describe, expect, it } from 'vitest'

import { LocalPayment } from './local-payment'

describe('LocalPayment', () => {
  it('creates and caches pix charge in memory', async () => {
    const payment = new LocalPayment()
    const charge1 = await payment.createPixCharge('order_1', 3500)

    expect(charge1.id).toBe('pix_demo_order_1')
    expect(charge1.amountCents).toBe(3500)
    expect(charge1.status).toBe('PENDING')
    expect(charge1.brCode).toContain('order_1')

    const charge2 = await payment.createPixCharge('order_1', 3500)
    expect(charge2.id).toBe(charge1.id)
  })

  it('retrieves existing charge status and updates when marked as paid', async () => {
    const payment = new LocalPayment()
    const charge = await payment.createPixCharge('order_2', 1500)

    const status1 = await payment.getPaymentStatus(charge.id)
    expect(status1.status).toBe('PENDING')

    payment.markAsPaid(charge.id)
    const status2 = await payment.getPaymentStatus(charge.id)
    expect(status2.status).toBe('PAID')
  })

  it('returns fallback charge for unknown payment id', async () => {
    const payment = new LocalPayment()
    const fallback = await payment.getPaymentStatus('unknown_id')
    expect(fallback.id).toBe('unknown_id')
    expect(fallback.status).toBe('PENDING')
  })

  it('ignores markAsPaid on unknown payment id', () => {
    const payment = new LocalPayment()
    expect(() => payment.markAsPaid('non_existent')).not.toThrow()
  })
})
