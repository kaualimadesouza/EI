import type { PaymentPort, PixChargeInfo } from '../../ports/payment'
import type { HttpClient } from './http-client'

interface PixPaymentResponseJson {
  id: string
  order_id: string
  amount_cents: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
  br_code: string
  br_code_base64?: string | null
  qr_code_url?: string | null
  expires_at?: string | null
}

export class HttpPayment implements PaymentPort {
  private readonly client: HttpClient

  constructor(client: HttpClient) {
    this.client = client
  }

  async createPixCharge(orderId: string, amountCents?: number, description?: string): Promise<PixChargeInfo> {
    void amountCents
    const response = await this.client.post('/payments/pix', {
      order_id: orderId,
      description,
    })
    if (!response.ok) {
      throw new Error(`POST /payments/pix failed with ${response.status}`)
    }
    const data = (await response.json()) as PixPaymentResponseJson
    return {
      id: data.id,
      orderId: data.order_id,
      amountCents: data.amount_cents,
      status: data.status,
      brCode: data.br_code,
      brCodeBase64: data.br_code_base64,
      qrCodeUrl: data.qr_code_url,
      expiresAt: data.expires_at,
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PixChargeInfo> {
    const response = await this.client.get(`/payments/${paymentId}/status`, undefined, null)
    if (!response.ok) {
      throw new Error(`GET /payments/${paymentId}/status failed with ${response.status}`)
    }
    const data = (await response.json()) as PixPaymentResponseJson
    return {
      id: data.id,
      orderId: data.order_id,
      amountCents: data.amount_cents,
      status: data.status,
      brCode: data.br_code,
      brCodeBase64: data.br_code_base64,
      qrCodeUrl: data.qr_code_url,
      expiresAt: data.expires_at,
    }
  }
}
