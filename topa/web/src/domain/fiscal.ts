import type { OrderSummary } from './order'
import type { Store } from './store'

export interface FiscalItemTax {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  totalPriceCents: number
  ncm: string
  cfop: string
  csosn: string
  approxTaxCents: number
}

export interface CustomerFiscalSummary {
  accessKey: string
  formattedAccessKey: string
  series: number
  orderNumber: number
  qrCodeUrl: string
  storeName: string
  storeCnpj: string
  subtotalCents: number
  totalCents: number
  approxTaxCents: number
  items: FiscalItemTax[]
}

export function calculateMod11(key43: string): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9]
  let total = 0
  for (let i = 0; i < key43.length; i++) {
    const digit = parseInt(key43.charAt(key43.length - 1 - i), 10)
    total += digit * weights[i % weights.length]
  }
  const remainder = total % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function formatAccessKey(key44: string): string {
  const parts: string[] = []
  for (let i = 0; i < key44.length; i += 4) {
    parts.push(key44.substring(i, i + 4))
  }
  return parts.join(' ')
}

export function resolveItemTax(productId: string, name: string): { ncm: string; cfop: string; csosn: string; rate: number } {
  const idLower = productId.toLowerCase()
  const nameLower = name.toLowerCase()
  if (['suco', 'refri', 'coca', 'bebida', 'agua'].some((k) => idLower.includes(k) || nameLower.includes(k))) {
    return { ncm: '22021000', cfop: '5405', csosn: '500', rate: 0.25 }
  }
  if (['brigadeiro', 'brownie', 'doce', 'cookie'].some((k) => idLower.includes(k) || nameLower.includes(k))) {
    return { ncm: '17049090', cfop: '5102', csosn: '102', rate: 0.18 }
  }
  return { ncm: '19059090', cfop: '5102', csosn: '102', rate: 0.15 }
}

export function buildNfceQrCodeUrl(accessKey: string, env: number = 2, cscId: string = '000001'): string {
  const base = 'https://www.nfce.fazenda.sp.gov.br/qrcode'
  return `${base}?p=${accessKey}|2|${env}|${cscId}|simulated_digest`
}

export function generateCustomerFiscalSummary(order: OrderSummary, store: Store): CustomerFiscalSummary {
  const cleanCnpj = (store.cnpj || '12345678000195').replace(/\D/g, '').padEnd(14, '0')
  const dateStr = '2610'
  const raw43 = `35${dateStr}${cleanCnpj}65001${String(order.number).padStart(9, '0')}199999999`
  const cdv = calculateMod11(raw43)
  const key = `${raw43}${cdv}`

  let approxTaxTotal = 0
  const items: FiscalItemTax[] = order.items.map((it) => {
    const tax = resolveItemTax(it.productId, it.name)
    const lineTotal = it.quantity * it.unitPriceCents
    const lineTax = Math.round(lineTotal * tax.rate)
    approxTaxTotal += lineTax
    return {
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      totalPriceCents: lineTotal,
      ncm: tax.ncm,
      cfop: tax.cfop,
      csosn: tax.csosn,
      approxTaxCents: lineTax,
    }
  })

  return {
    accessKey: key,
    formattedAccessKey: formatAccessKey(key),
    series: 1,
    orderNumber: order.number,
    qrCodeUrl: buildNfceQrCodeUrl(key),
    storeName: store.name,
    storeCnpj: cleanCnpj,
    subtotalCents: order.totalCents,
    totalCents: order.totalCents,
    approxTaxCents: approxTaxTotal,
    items,
  }
}
