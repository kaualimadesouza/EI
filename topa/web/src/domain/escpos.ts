import type { OrderSummary } from './order'

export interface EscPosLine {
  text: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  doubleSize: boolean
  isCut: boolean
}

const CMD_INIT = [0x1b, 0x40]
const CMD_ALIGN_LEFT = [0x1b, 0x61, 0x00]
const CMD_ALIGN_CENTER = [0x1b, 0x61, 0x01]
const CMD_ALIGN_RIGHT = [0x1b, 0x61, 0x02]
const CMD_BOLD_ON = [0x1b, 0x45, 0x01]
const CMD_BOLD_OFF = [0x1b, 0x45, 0x00]
const CMD_DOUBLE_ON = [0x1d, 0x21, 0x11]
const CMD_DOUBLE_OFF = [0x1d, 0x21, 0x00]
const CMD_CUT = [0x1d, 0x56, 0x42, 0x00]

function encodeText(text: string): number[] {
  const encoder = new TextEncoder()
  return Array.from(encoder.encode(text))
}

export function buildKitchenEscPos(order: OrderSummary, storeName: string): Uint8Array {
  const bytes: number[] = []
  bytes.push(...CMD_INIT)
  bytes.push(...CMD_ALIGN_CENTER)
  bytes.push(...CMD_DOUBLE_ON, ...CMD_BOLD_ON)
  bytes.push(...encodeText(`PEDIDO #${order.number}\n`))
  bytes.push(...CMD_DOUBLE_OFF, ...CMD_BOLD_OFF)
  bytes.push(...encodeText(`COZINHA: ${storeName.toUpperCase()}\n`))
  bytes.push(...encodeText(`TIPO: ${order.dineIn ? 'NO LOCAL' : 'PARA LEVAR'}\n`))
  bytes.push(...encodeText('--------------------------------\n'))
  bytes.push(...CMD_ALIGN_LEFT)
  for (const item of order.items) {
    bytes.push(...CMD_BOLD_ON)
    bytes.push(...encodeText(`${item.quantity}x  ${item.name}\n`))
    bytes.push(...CMD_BOLD_OFF)
  }
  bytes.push(...encodeText('--------------------------------\n'))
  bytes.push(0x1b, 0x64, 0x03)
  bytes.push(...CMD_CUT)
  return new Uint8Array(bytes)
}

export function buildCustomerEscPos(order: OrderSummary, storeName: string, fiscalKey?: string): Uint8Array {
  const bytes: number[] = []
  bytes.push(...CMD_INIT)
  bytes.push(...CMD_ALIGN_CENTER)
  bytes.push(...CMD_BOLD_ON)
  bytes.push(...encodeText(`${storeName.toUpperCase()}\n`))
  bytes.push(...CMD_BOLD_OFF)
  bytes.push(...encodeText('DOCUMENTO AUXILIAR DA NFC-e\n'))
  bytes.push(...encodeText(`PEDIDO #${order.number} (${order.dineIn ? 'NO LOCAL' : 'PARA LEVAR'})\n`))
  bytes.push(...encodeText('--------------------------------\n'))
  bytes.push(...CMD_ALIGN_LEFT)
  bytes.push(...encodeText('QTD  ITEM                 VALOR\n'))
  for (const item of order.items) {
    const itemTotal = (item.quantity * item.unitPriceCents) / 100
    const shortName = item.name.slice(0, 18).padEnd(18, ' ')
    bytes.push(...encodeText(`${String(item.quantity).padStart(2, ' ')}x  ${shortName} ${itemTotal.toFixed(2)}\n`))
  }
  bytes.push(...encodeText('--------------------------------\n'))
  bytes.push(...CMD_ALIGN_RIGHT)
  bytes.push(...CMD_BOLD_ON)
  const total = (order.totalCents / 100).toFixed(2)
  bytes.push(...encodeText(`TOTAL: R$ ${total}\n`))
  bytes.push(...CMD_BOLD_OFF)
  if (fiscalKey) {
    bytes.push(...CMD_ALIGN_CENTER)
    bytes.push(...encodeText('--------------------------------\n'))
    bytes.push(...encodeText('CHAVE DE ACESSO\n'))
    bytes.push(...encodeText(`${fiscalKey}\n`))
  }
  bytes.push(0x1b, 0x64, 0x03)
  bytes.push(...CMD_CUT)
  return new Uint8Array(bytes)
}

export function decodeEscPos(bytes: Uint8Array): EscPosLine[] {
  const lines: EscPosLine[] = []
  let align: 'left' | 'center' | 'right' = 'left'
  let bold = false
  let doubleSize = false
  let buffer: number[] = []

  const flush = () => {
    if (buffer.length > 0) {
      const decoder = new TextDecoder()
      const text = decoder.decode(new Uint8Array(buffer)).replace(/\r/g, '')
      if (text.length > 0) {
        lines.push({ text, align, bold, doubleSize, isCut: false })
      }
      buffer = []
    }
  }

  let i = 0
  while (i < bytes.length) {
    if (bytes[i] === 0x1b && bytes[i + 1] === 0x40) {
      flush()
      align = 'left'
      bold = false
      doubleSize = false
      i += 2
    } else if (bytes[i] === 0x1b && bytes[i + 1] === 0x61) {
      flush()
      if (bytes[i + 2] === 0x01) align = 'center'
      else if (bytes[i + 2] === 0x02) align = 'right'
      else align = 'left'
      i += 3
    } else if (bytes[i] === 0x1b && bytes[i + 1] === 0x45) {
      flush()
      bold = bytes[i + 2] === 0x01
      i += 3
    } else if (bytes[i] === 0x1d && bytes[i + 1] === 0x21) {
      flush()
      doubleSize = bytes[i + 2] === 0x11
      i += 3
    } else if (bytes[i] === 0x1d && bytes[i + 1] === 0x56) {
      flush()
      lines.push({ text: '=== CORTE DE PAPEL ===', align: 'center', bold: false, doubleSize: false, isCut: true })
      i += 4
    } else if (bytes[i] === 0x1b && bytes[i + 1] === 0x64) {
      flush()
      i += 3
    } else if (bytes[i] === 0x0a) {
      flush()
      i += 1
    } else {
      buffer.push(bytes[i])
      i += 1
    }
  }
  flush()
  return lines
}
