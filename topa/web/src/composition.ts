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
import { UnavailableWakeLock } from './adapters/unavailable/unavailable-wake-lock'
import { WebBuzzer } from './adapters/web/web-buzzer'
import { type NdefReader, WebNfc } from './adapters/web/web-nfc'
import { WebWakeLock } from './adapters/web/web-wake-lock'
import type { Adapters } from './ports/adapters'
import type { NfcPort } from './ports/nfc'

export type AppFlavor = 'cliente' | 'loja'
export type StoreRole = 'totem' | 'painel'

export interface TopaNativeBridge {
  getFlavor(): string
}

declare global {
  interface Window {
    TopaTag?: TagBridge
    TopaNative?: TopaNativeBridge
  }
}

/** What the app runs in, read once at startup. */
export interface Runtime {
  tauri: boolean
  mobile: boolean
  flavor: AppFlavor
  storeRole: StoreRole
  /** Backward compatible flag: true when showing totem, false on phone or painel. */
  totem: boolean
  ndefReader: (new () => NdefReader) | undefined
  tagBridge: TagBridge | undefined
  /** The Vibration API, where the device has one (not on iPhones). */
  vibrate: ((pattern: number[]) => boolean) | undefined
  /** The Screen Wake Lock API, where the browser has one. */
  wakeLock: { request(type: 'screen'): Promise<Pick<WakeLockSentinel, 'release'>> } | undefined
}

const storeRoleStorage = () => new StoredValue<StoreRole>(browserStorage(), 'topa.store_role', 'totem')
const totemFlag = () => new StoredValue(browserStorage(), 'topa.totem', false)

export function detectFlavor(): AppFlavor {
  const native = window.TopaNative?.getFlavor()
  if (native === 'loja' || native === 'cliente') return native
  if (import.meta.env.VITE_APP_FLAVOR === 'loja') return 'loja'
  return 'cliente'
}

export function detectRuntime(): Runtime {
  const flavor = detectFlavor()
  const storeRole = storeRoleStorage().read()
  return {
    tauri: isTauri(),
    mobile: /Android|iPhone|iPad/.test(navigator.userAgent),
    flavor,
    storeRole,
    totem: totemFlag().read(),
    ndefReader: window.NDEFReader,
    tagBridge: window.TopaTag,
    vibrate: 'vibrate' in navigator ? (pattern) => navigator.vibrate(pattern) : undefined,
    wakeLock: 'wakeLock' in navigator ? navigator.wakeLock : undefined,
  }
}

/** The gesture on the store app: flip between totem and painel. Customer app has no switch. */
export function roleSwitch(runtime: Runtime, reload: () => void): (() => void) | undefined {
  if (!(runtime.tauri && runtime.flavor === 'loja')) return undefined
  return () => {
    storeRoleStorage().write(runtime.storeRole === 'totem' ? 'painel' : 'totem')
    // a reload skips React cleanups, while the published URL lives on in the Android process
    runtime.tagBridge?.withdraw()
    reload()
  }
}

/** The customer phone app is the Tauri customer build on a phone; store app shows totem or painel. */
export function isPhoneApp(runtime: Runtime): boolean {
  return runtime.tauri && runtime.mobile && runtime.flavor === 'cliente'
}

// the NFC plugin is registered on mobile only, so the desktop app reads nothing
function nfcFor(runtime: Runtime): NfcPort {
  if (isPhoneApp(runtime)) return new TauriNfc()
  const Reader = runtime.ndefReader
  if (Reader) return new WebNfc(() => new Reader())
  return new UnavailableNfc()
}

/** The only place that picks adapters: an API URL means the API, none (or empty) means demo mode. */
export function createAdapters(apiUrl: string | undefined, runtime: Runtime = detectRuntime()): Adapters {
  const nfc = nfcFor(runtime)
  const tag = runtime.tagBridge ? new TauriTag(runtime.tagBridge) : new UnavailableTag()
  const buzzer = runtime.vibrate ? new WebBuzzer(runtime.vibrate) : new UnavailableBuzzer()
  const wakeLock = runtime.wakeLock ? new WebWakeLock(runtime.wakeLock) : new UnavailableWakeLock()
  if (apiUrl) {
    const client = new HttpClient(apiUrl)
    return {
      mode: 'api',
      connection: new HttpConnection(client),
      menu: new HttpMenu(client),
      orders: new HttpOrders(client),
      nfc,
      tag,
      buzzer,
      wakeLock,
    }
  }
  const menu = new LocalMenu()
  return { mode: 'demo', connection: new LocalConnection(), menu, orders: new LocalOrders(menu), nfc, tag, buzzer, wakeLock }
}
