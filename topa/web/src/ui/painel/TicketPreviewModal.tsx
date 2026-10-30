import { useMemo, useState } from 'react'

import { buildCustomerEscPos, buildKitchenEscPos, decodeEscPos } from '../../domain/escpos'
import { generateCustomerFiscalSummary } from '../../domain/fiscal'
import type { OrderSummary } from '../../domain/order'
import type { PrinterPort } from '../../ports/printer'

interface TicketPreviewModalProps {
  order: OrderSummary | null
  storeName: string
  storeCnpj?: string
  printer: PrinterPort
  isOpen: boolean
  onClose: () => void
}

export function TicketPreviewModal({
  order,
  storeName,
  storeCnpj = '12345678000195',
  printer,
  isOpen,
  onClose,
}: TicketPreviewModalProps) {
  const [tab, setTab] = useState<'kitchen' | 'customer'>('kitchen')
  const [printed, setPrinted] = useState(false)

  const { bytes, lines } = useMemo(() => {
    if (!order) return { bytes: new Uint8Array(), lines: [] }
    if (tab === 'kitchen') {
      const b = buildKitchenEscPos(order, storeName)
      return { bytes: b, lines: decodeEscPos(b) }
    }
    const fiscal = generateCustomerFiscalSummary(order, { slug: 'store', name: storeName, cnpj: storeCnpj })
    const b = buildCustomerEscPos(order, storeName, fiscal.formattedAccessKey)
    return { bytes: b, lines: decodeEscPos(b) }
  }, [order, storeName, storeCnpj, tab])

  if (!isOpen || !order) return null

  const handlePrint = async () => {
    await printer.print(bytes)
    setPrinted(true)
    setTimeout(() => setPrinted(false), 2500)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualização de impressão ESC-POS"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-[420px] flex-col rounded-[24px] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[17px] font-semibold">Impressão térmica (ESC/POS)</h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ground-2 hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="flex border-b border-line bg-ground-2 p-1">
          <button
            type="button"
            onClick={() => setTab('kitchen')}
            className={`flex-1 rounded-[10px] py-1.5 text-[14px] font-medium transition ${
              tab === 'kitchen' ? 'bg-white shadow-sm font-semibold text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            Comanda cozinha
          </button>
          <button
            type="button"
            onClick={() => setTab('customer')}
            className={`flex-1 rounded-[10px] py-1.5 text-[14px] font-medium transition ${
              tab === 'customer' ? 'bg-white shadow-sm font-semibold text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            Cupom NFC-e
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-[12px] border border-line/60 bg-[#fdfdfc] p-4 font-mono text-[12px] leading-relaxed shadow-inner">
            {lines.map((line, idx) => {
              if (line.isCut) {
                return (
                  <div key={idx} className="my-2 border-b-2 border-dashed border-gray-400 text-center text-[10px] text-gray-500">
                    {line.text}
                  </div>
                )
              }
              const alignClass =
                line.align === 'center' ? 'text-center' : line.align === 'right' ? 'text-right' : 'text-left'
              const boldClass = line.bold ? 'font-bold text-black' : 'text-gray-800'
              const sizeClass = line.doubleSize ? 'text-[14px] font-bold' : ''
              return (
                <div key={idx} className={`${alignClass} ${boldClass} ${sizeClass} whitespace-pre-wrap break-words`}>
                  {line.text}
                </div>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <span className="text-[13px] text-teal font-medium">
            {printed ? 'Impresso com sucesso!' : 'Emulador ESC/POS'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-[12px] border border-line px-4 text-[14px] font-medium hover:bg-ground-2"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 rounded-[12px] bg-teal px-5 text-[14px] font-semibold text-white hover:bg-teal-dark"
            >
              Imprimir
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
