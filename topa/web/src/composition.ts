import { isTauri } from '@tauri-apps/api/core'

import { HttpClient } from './adapters/http/http-client'
import { HttpConnection } from './adapters/http/http-connection'
import { HttpMenu } from './adapters/http/http-menu'
import { HttpOrders } from './adapters/http/http-orders'
import { browserStorage, StoredValue } from './adapters/local/browser-storage'
import { LocalConnection } from './adapters/local/local-connection'
import { LocalMenu } from './adapters/local/local-menu'
import { LocalOrders } from './adapters/local/local-orders'
import { TauriNfc } from './adapters/tauri/tauri-nfc'
import { type TagBridge, TauriTag } from './adapters/tauri/tauri-tag'
import { NoTag } from './adapters/unavailable/no-tag'
import { UnavailableNfc } from './adapters/unavailable/unavailable-nfc'
import { type NdefReader, WebNfc } from './adapters/web/web-nfc'
import type { Adapters } from './ports/adapters'
import type { NfcPort } from './ports/nfc'

/** What the app runs in, read once at startup. */
export interface Runtime {
  tauri: boolean
  mobile: boolean
  /** Someone turned this device into a totem from the phone app. */
  totem: boolean
  ndefReader: (new () => NdefReader) | undefined
  tagBridge: TagBridge | undefined
}

const totemFlag = () => new StoredValue(browserStorage(), 'topa.totem', false)

export function detectRuntime(): Runtime {
  return {
    tauri: isTauri(),
    mobile: /Android|iPhone|iPad/.test(navigator.userAgent),
    totem: totemFlag().read(),
    ndefReader: window.NDEFReader,
    tagBridge: window.TopaTag,
  }
}

/** From the next start on, this device runs the kiosk (true) or the phone app (false). */
export function setTotem(totem: boolean): void {
  totemFlag().write(totem)
}

/** The phone app is the Tauri build on a phone not marked as totem; every other runtime shows the kiosk. */
export function isPhoneApp(runtime: Runtime): boolean {
  return runtime.tauri && runtime.mobile && !runtime.totem
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
  const tag = runtime.tagBridge ? new TauriTag(runtime.tagBridge) : new NoTag()
  if (apiUrl) {
    const client = new HttpClient(apiUrl)
    return {
      mode: 'api',
      connection: new HttpConnection(apiUrl),
      menu: new HttpMenu(client),
      orders: new HttpOrders(client),
      nfc,
      tag,
    }
  }
  const menu = new LocalMenu()
  return { mode: 'demo', connection: new LocalConnection(), menu, orders: new LocalOrders(menu), nfc, tag }
}
