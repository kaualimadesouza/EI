import type { PaymentPort, PixChargeInfo } from '../../ports/payment'

export class LocalPayment implements PaymentPort {
  private readonly charges = new Map<string, PixChargeInfo>()

  async createPixCharge(
    orderId: string,
    amountCents = 2500,
    description?: string,
  ): Promise<PixChargeInfo> {
    void description
    const existing = Array.from(this.charges.values()).find((c) => c.orderId === orderId)
    if (existing) {
      return existing
    }

    const id = `pix_demo_${orderId.slice(0, 8)}`
    const charge: PixChargeInfo = {
      id,
      orderId,
      amountCents,
      status: 'PENDING',
      brCode: `00020126580014br.gov.bcb.pix0136${orderId}520400005303986540${(amountCents / 100).toFixed(2)}5802BR5904TOPA6009SAO_PAULO62070503***6304`,
      brCodeBase64: null,
      qrCodeUrl: `https://pay.abacatepay.com/bill-demo-${id}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
    this.charges.set(id, charge)
    return charge
  }

  async getPaymentStatus(paymentId: string): Promise<PixChargeInfo> {
    const charge = this.charges.get(paymentId)
    if (charge) {
      return charge
    }
    return {
      id: paymentId,
      orderId: 'demo-order',
      amountCents: 2500,
      status: 'PENDING',
      brCode: '00020126580014br.gov.bcb.pix0136demo52040000530398654025.005802BR5904TOPA6009SAO_PAULO62070503***6304',
      brCodeBase64: null,
      qrCodeUrl: null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
  }

  markAsPaid(paymentId: string): void {
    const charge = this.charges.get(paymentId)
    if (charge) {
      this.charges.set(paymentId, { ...charge, status: 'PAID' })
    }
  }
}
