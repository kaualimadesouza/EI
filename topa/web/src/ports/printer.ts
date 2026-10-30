export interface PrinterPort {
  isSupported(): boolean
  print(data: Uint8Array): Promise<void>
}
