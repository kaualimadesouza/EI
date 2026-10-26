import { isTauri } from '@tauri-apps/api/core'

import { HttpClient } from './adapters/http/http-client'
import { HttpConnection } from './adapters/http/http-connection'
import { HttpMenu } from './adapters/http/http-menu'
import { HttpOrders } from './adapters/http/http-orders'
import { LocalConnection } from './adapters/local/local-connection'
import { LocalMenu } from './adapters/local/local-menu'
import { LocalOrders } from './adapters/local/local-orders'
import { TauriNfc } from './adapters/tauri/tauri-nfc'
import { UnavailableNfc } from './adapters/unavailable/unavailable-nfc'
import { type NdefReader, WebNfc } from './adapters/web/web-nfc'
import type { Adapters } from './ports/adapters'
import type { NfcPort } from './ports/nfc'

/** What the app runs in, read once at startup. */
export interface Runtime {
  tauri: boolean
  mobile: boolean
  ndefReader: (new () => NdefReader) | undefined
}

export function detectRuntime(): Runtime {
  return {
    tauri: isTauri(),
    mobile: /Android|iPhone|iPad/.test(navigator.userAgent),
    ndefReader: window.NDEFReader,
  }
}

/** The phone app is the Tauri build on a phone; every other runtime shows the kiosk. */
export function isPhoneApp(runtime: Runtime): boolean {
  return runtime.tauri && runtime.mobile
}

// the NFC plugin is registered on mobile only, so the desktop app reads nothing
function nfcFor(runtime: Runtime): NfcPort {
  if (isPhoneApp(runtime)) return new TauriNfc()
  const Reader = runtime.ndefReader
  if (Reader) return new WebNfc(() => new Reader())
  return new UnavailableNfc()
}

/** The only place that picks adapters: an API URL means the local backend, none means demo mode. */
export function createAdapters(apiUrl: string | undefined, runtime: Runtime = detectRuntime()): Adapters {
  const nfc = nfcFor(runtime)
  if (apiUrl) {
    const client = new HttpClient(apiUrl)
    return {
      mode: 'api',
      connection: new HttpConnection(apiUrl),
      menu: new HttpMenu(client),
      orders: new HttpOrders(client),
      nfc,
    }
  }
  const menu = new LocalMenu()
  return { mode: 'demo', connection: new LocalConnection(), menu, orders: new LocalOrders(menu), nfc }
}
