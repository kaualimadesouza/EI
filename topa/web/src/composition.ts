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
import { UnavailableBuzzer } from './adapters/unavailable/unavailable-buzzer'
import { UnavailableNfc } from './adapters/unavailable/unavailable-nfc'
import { UnavailableTag } from './adapters/unavailable/unavailable-tag'
import { WebBuzzer } from './adapters/web/web-buzzer'
import { type NdefReader, WebNfc } from './adapters/web/web-nfc'
import type { Adapters } from './ports/adapters'
import type { NfcPort } from './ports/nfc'

/** What the app runs in, read once at startup. */
export interface Runtime {
  tauri: boolean
  mobile: boolean
  /** Staff turned this Android device into a totem (see `roleSwitch`). */
  totem: boolean
  ndefReader: (new () => NdefReader) | undefined
  tagBridge: TagBridge | undefined
  /** The Vibration API, where the device has one (not on iPhones). */
  vibrate: ((pattern: number[]) => boolean) | undefined
}

const totemFlag = () => new StoredValue(browserStorage(), 'topa.totem', false)

export function detectRuntime(): Runtime {
  return {
    tauri: isTauri(),
    mobile: /Android|iPhone|iPad/.test(navigator.userAgent),
    totem: totemFlag().read(),
    ndefReader: window.NDEFReader,
    tagBridge: window.TopaTag,
    vibrate: 'vibrate' in navigator ? (pattern) => navigator.vibrate(pattern) : undefined,
  }
}

/** The staff gesture on the Android app: flip phone and totem across a reload. Nothing to flip elsewhere. */
export function roleSwitch(runtime: Runtime, reload: () => void): (() => void) | undefined {
  if (!(runtime.tauri && runtime.mobile)) return undefined
  return () => {
    totemFlag().write(!runtime.totem)
    // a reload skips React cleanups, while the published URL lives on in the Android process
    runtime.tagBridge?.withdraw()
    reload()
  }
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
  const tag = runtime.tagBridge ? new TauriTag(runtime.tagBridge) : new UnavailableTag()
  const buzzer = runtime.vibrate ? new WebBuzzer(runtime.vibrate) : new UnavailableBuzzer()
  if (apiUrl) {
    const client = new HttpClient(apiUrl)
    return {
      mode: 'api',
      connection: new HttpConnection(apiUrl),
      menu: new HttpMenu(client),
      orders: new HttpOrders(client),
      nfc,
      tag,
      buzzer,
    }
  }
  const menu = new LocalMenu()
  return { mode: 'demo', connection: new LocalConnection(), menu, orders: new LocalOrders(menu), nfc, tag, buzzer }
}
