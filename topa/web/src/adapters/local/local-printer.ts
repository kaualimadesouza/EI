import type { PrinterPort } from '../../ports/printer'

export class LocalPrinterAdapter implements PrinterPort {
  readonly spool: Uint8Array[] = []

  isSupported(): boolean {
    return true
  }

  async print(data: Uint8Array): Promise<void> {
    this.spool.push(data)
  }

  clear(): void {
    this.spool.length = 0
  }
}
