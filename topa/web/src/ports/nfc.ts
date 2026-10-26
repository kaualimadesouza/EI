/** A tag that held a URL record. */
export interface TagUrl {
  kind: 'url'
  url: string
}

/**
 * Why a scan gave no URL: the phone has no NFC, NFC is turned off, nothing was read (cancelled
 * or the read failed), or the tag holds no URL record.
 */
export interface ScanFailure {
  kind: 'no-nfc' | 'nfc-off' | 'nothing-read' | 'no-url'
}

/** Reads one NFC tag. Aborting the signal ends the scan as `nothing-read`. */
export interface NfcPort {
  scan(signal: AbortSignal): Promise<TagUrl | ScanFailure>
}
