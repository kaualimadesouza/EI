import { describe, expect, it, vi } from 'vitest'

import type { HttpClient } from './http-client'
import { HttpPayment } from './http-payment'

describe('HttpPayment', () => {
  it('creates pix charge via POST /payments/pix', async () => {
    const fakeClient = {
      post: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pix_12345',
          order_id: 'order_abc',
          amount_cents: 2990,
          status: 'PENDING',
          br_code: '000201...',
          br_code_base64: 'data:image/png;base64,mock',
          qr_code_url: 'https://pay.abacatepay.com/bill-12345',
          expires_at: '2026-11-01T15:00:00Z',
        }),
      }),
    } as unknown as HttpClient

    const payment = new HttpPayment(fakeClient)
    const result = await payment.createPixCharge('order_abc', 2990, 'Pedido teste')

    expect(fakeClient.post).toHaveBeenCalledWith('/payments/pix', {
      order_id: 'order_abc',
      description: 'Pedido teste',
    })
    expect(result.id).toBe('pix_12345')
    expect(result.amountCents).toBe(2990)
    expect(result.status).toBe('PENDING')
    expect(result.brCode).toBe('000201...')
    expect(result.brCodeBase64).toBe('data:image/png;base64,mock')
  })

  it('throws when createPixCharge fails', async () => {
    const fakeClient = {
      post: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    } as unknown as HttpClient

    const payment = new HttpPayment(fakeClient)
    await expect(payment.createPixCharge('order_fail')).rejects.toThrow('POST /payments/pix failed with 500')
  })

  it('gets payment status via GET /payments/{id}/status', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'pix_12345',
          order_id: 'order_abc',
          amount_cents: 2990,
          status: 'PAID',
          br_code: '000201...',
        }),
      }),
    } as unknown as HttpClient

    const payment = new HttpPayment(fakeClient)
    const result = await payment.getPaymentStatus('pix_12345')

    expect(fakeClient.get).toHaveBeenCalledWith('/payments/pix_12345/status', undefined, null)
    expect(result.status).toBe('PAID')
  })

  it('throws when getPaymentStatus fails', async () => {
    const fakeClient = {
      get: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    } as unknown as HttpClient

    const payment = new HttpPayment(fakeClient)
    await expect(payment.getPaymentStatus('pix_missing')).rejects.toThrow('GET /payments/pix_missing/status failed with 404')
  })
})
