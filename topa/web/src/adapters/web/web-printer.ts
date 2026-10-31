import { decodeEscPos } from '../../domain/escpos'
import type { PrinterPort } from '../../ports/printer'

export class WebPrinterAdapter implements PrinterPort {
  isSupported(): boolean {
    return typeof window !== 'undefined'
  }

  async print(data: Uint8Array): Promise<void> {
    const lines = decodeEscPos(data)
    const formatted = lines.map((l) => l.text).join('\n')
    // Outputs decoded ticket into browser log for dev and local demo
    console.info('ESC/POS Print Output:\n' + formatted)
  }
}
