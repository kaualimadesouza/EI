export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'

export interface PixChargeInfo {
  id: string
  orderId: string
  amountCents: number
  status: PaymentStatus
  brCode: string
  brCodeBase64?: string | null
  qrCodeUrl?: string | null
  expiresAt?: string | null
}

export interface PaymentPort {
  createPixCharge(orderId: string, amountCents?: number, description?: string): Promise<PixChargeInfo>
  getPaymentStatus(paymentId: string): Promise<PixChargeInfo>
}
