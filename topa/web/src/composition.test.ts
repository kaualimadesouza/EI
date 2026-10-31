import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpAuth } from './adapters/http/http-auth'
import { HttpConnection } from './adapters/http/http-connection'
import { HttpCustomerAuth } from './adapters/http/http-customer-auth'
import { HttpMenu } from './adapters/http/http-menu'
import { HttpOrders } from './adapters/http/http-orders'
import { HttpRecommendations } from './adapters/http/http-recommendations'
import { HttpStores } from './adapters/http/http-stores'
import { LocalAuth } from './adapters/local/local-auth'
import { LocalConnection } from './adapters/local/local-connection'
import { LocalCustomerAuth } from './adapters/local/local-customer-auth'
import { LocalMenu } from './adapters/local/local-menu'
import { LocalOrders } from './adapters/local/local-orders'
import { LocalPrinterAdapter } from './adapters/local/local-printer'
import { LocalRecommendations } from './adapters/local/local-recommendations'
import { LocalStores } from './adapters/local/local-stores'
import { SimulatorVoiceAdapter } from './adapters/local/local-voice'
import { OfflineResilientOrders } from './adapters/resilient/offline-resilient-orders'
import { TauriNfc } from './adapters/tauri/tauri-nfc'
import { UnavailableBuzzer } from './adapters/unavailable/unavailable-buzzer'
import { UnavailableNfc } from './adapters/unavailable/unavailable-nfc'
import { UnavailableWakeLock } from './adapters/unavailable/unavailable-wake-lock'
import { WebNfc } from './adapters/web/web-nfc'
import { WebPrinterAdapter } from './adapters/web/web-printer'
import { WebSpeechVoiceAdapter } from './adapters/web/web-voice'
import { WebWakeLock } from './adapters/web/web-wake-lock'
import type { NdefReader } from './adapters/web/web-nfc'
import { createAdapters, detectRuntime, isPhoneApp, roleSwitch, type Runtime } from './composition'

const browser: Runtime = {
  tauri: false,
  mobile: false,
  flavor: 'cliente',
  storeRole: 'totem',
  totem: false,
  ndefReader: undefined,
  tagBridge: undefined,
  vibrate: undefined,
  wakeLock: undefined,
}
const customerApp: Runtime = { ...browser, tauri: true, mobile: true, flavor: 'cliente' }
const storeApp: Runtime = { ...browser, tauri: true, mobile: true, flavor: 'loja' }
const androidApp: Runtime = customerApp
const desktopApp: Runtime = { ...browser, tauri: true, flavor: 'loja' }

/** Chrome's NDEFReader as far as composition cares: it gets constructed when a scan starts. */
class FakeNdefReader implements NdefReader {
  static created = 0
  onreading = null
  onreadingerror = null

  constructor() {
    FakeNdefReader.created += 1
  }

  scan(): Promise<void> {
    return Promise.reject(new DOMException('no adapter', 'NotSupportedError'))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createAdapters', () => {
  it('talks to the API when an API URL is configured', () => {
    const adapters = createAdapters('/api', browser)

    expect(adapters.mode).toBe('api')
    expect(adapters.connection).toBeInstanceOf(HttpConnection)
    expect(adapters.menu).toBeInstanceOf(HttpMenu)
    expect(adapters.orders).toBeInstanceOf(OfflineResilientOrders)
    const resilientOrders = adapters.orders as OfflineResilientOrders
    expect(resilientOrders.underlying).toBeInstanceOf(HttpOrders)
    expect(adapters.auth).toBeInstanceOf(HttpAuth)
    expect(adapters.customerAuth).toBeInstanceOf(HttpCustomerAuth)
    expect(adapters.stores).toBeInstanceOf(HttpStores)
    expect(adapters.recommendations).toBeInstanceOf(HttpRecommendations)
    expect(adapters.voice).toBeInstanceOf(WebSpeechVoiceAdapter)
    expect(adapters.printer).toBeInstanceOf(WebPrinterAdapter)

    const menuProvider = (adapters.menu as unknown as { tokenProvider: () => string | null }).tokenProvider
    const ordersProvider = (resilientOrders.underlying as unknown as { tokenProvider: () => string | null }).tokenProvider
    const customerProvider = (resilientOrders.underlying as unknown as { customerTokenProvider: () => string | null }).customerTokenProvider
    expect(menuProvider()).toBeNull()
    expect(ordersProvider()).toBeNull()
    expect(customerProvider()).toBeNull()
  })

  it('falls back to demo mode when there is no API URL', () => {
    const adapters = createAdapters(undefined, browser)

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
    expect(adapters.menu).toBeInstanceOf(LocalMenu)
    expect(adapters.orders).toBeInstanceOf(OfflineResilientOrders)
    expect((adapters.orders as OfflineResilientOrders).underlying).toBeInstanceOf(LocalOrders)
    expect(adapters.auth).toBeInstanceOf(LocalAuth)
    expect(adapters.customerAuth).toBeInstanceOf(LocalCustomerAuth)
    expect(adapters.stores).toBeInstanceOf(LocalStores)
    expect(adapters.recommendations).toBeInstanceOf(LocalRecommendations)
    expect(adapters.voice).toBeInstanceOf(SimulatorVoiceAdapter)
    expect(adapters.printer).toBeInstanceOf(LocalPrinterAdapter)
  })

  it('treats an empty API URL as no API', () => {
    const adapters = createAdapters('', browser)

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
  })

  it('reads NFC through the Tauri plugin in the phone app', () => {
    expect(createAdapters(undefined, androidApp).nfc).toBeInstanceOf(TauriNfc)
  })

  it('has no NFC in the desktop app, where the plugin is not registered', () => {
    expect(createAdapters(undefined, desktopApp).nfc).toBeInstanceOf(UnavailableNfc)
  })

  it('reads NFC through Web NFC in a browser that has it', async () => {
    const { nfc } = createAdapters(undefined, { ...browser, ndefReader: FakeNdefReader })

    expect(nfc).toBeInstanceOf(WebNfc)
    expect(await nfc.scan(new AbortController().signal)).toEqual({ kind: 'no-nfc' })
    expect(FakeNdefReader.created).toBe(1)
  })

  it('has no NFC in a browser without Web NFC', () => {
    expect(createAdapters(undefined, browser).nfc).toBeInstanceOf(UnavailableNfc)
  })

  it('detects the runtime itself when none is given', () => {
    expect(createAdapters(undefined).nfc).toBeInstanceOf(UnavailableNfc)
  })

  it('serves the totem tag through the Android bridge when the app has one', () => {
    const tagBridge = { publish: vi.fn(), withdraw: vi.fn() }
    const { tag } = createAdapters(undefined, { ...androidApp, tagBridge })

    tag.publish('https://topa-totem.vercel.app/?loja=padaria-sol')
    tag.withdraw()

    expect(tag.available).toBe(true)
    expect(tagBridge.publish).toHaveBeenCalledWith('https://topa-totem.vercel.app/?loja=padaria-sol')
    expect(tagBridge.withdraw).toHaveBeenCalledOnce()
  })

  it('buzzes in pager pulses through the Vibration API where the device has one', () => {
    const vibrate = vi.fn(() => true)

    createAdapters(undefined, { ...browser, vibrate }).buzzer.buzz()

    expect(vibrate).toHaveBeenCalledExactlyOnceWith([400, 200, 400, 200, 400])
  })

  it('has nothing to buzz without the Vibration API, and buzzing is harmless', () => {
    const { buzzer } = createAdapters('/api', browser)

    buzzer.buzz()

    expect(buzzer).toBeInstanceOf(UnavailableBuzzer)
  })

  it('keeps the screen on through the Screen Wake Lock API where the device has one', () => {
    const release = vi.fn(() => Promise.resolve())
    const wakeLock = { request: vi.fn(() => Promise.resolve({ release })) }

    const { wakeLock: port } = createAdapters(undefined, { ...browser, wakeLock })
    port.hold()

    expect(port).toBeInstanceOf(WebWakeLock)
    expect(wakeLock.request).toHaveBeenCalledWith('screen')
  })

  it('leaves the screen to its timeout without the Screen Wake Lock API', () => {
    const { wakeLock } = createAdapters('/api', browser)

    wakeLock.hold()()

    expect(wakeLock).toBeInstanceOf(UnavailableWakeLock)
  })

  it('has no tag to serve without the bridge, and publishing is harmless', () => {
    const { tag } = createAdapters('/api', browser)

    tag.publish('https://topa-totem.vercel.app/?loja=padaria-sol')
    tag.withdraw()

    expect(tag.available).toBe(false)
  })
})

describe('detectRuntime', () => {
  afterEach(() => {
    localStorage.clear()
    Reflect.deleteProperty(navigator, 'vibrate')
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('sees a plain desktop browser in the test DOM', () => {
    expect(detectRuntime()).toEqual(browser)
  })

  it('picks up the tag bridge the Android app puts on window', () => {
    const tagBridge = { publish: vi.fn(), withdraw: vi.fn() }
    vi.stubGlobal('TopaTag', tagBridge)

    expect(detectRuntime().tagBridge).toBe(tagBridge)
  })

  it('sees the Tauri app on an Android phone', () => {
    vi.stubGlobal('isTauri', true)
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
    )

    expect(detectRuntime()).toEqual(androidApp)
  })

  it('picks up the Vibration API when the device has it', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })

    detectRuntime().vibrate!([200])

    expect(vibrate).toHaveBeenCalledWith([200])
  })

  it('picks up the Screen Wake Lock API when the device has it', () => {
    const wakeLock = { request: vi.fn() }
    Object.defineProperty(navigator, 'wakeLock', { value: wakeLock, configurable: true })

    expect(detectRuntime().wakeLock).toBe(wakeLock)
  })

  it('picks up the store flavor from the Android bridge or build mode', () => {
    expect(detectRuntime().flavor).toBe('cliente')

    vi.stubGlobal('TopaNative', { getFlavor: () => 'loja' })
    expect(detectRuntime().flavor).toBe('loja')
  })

  it('picks up the store flavor from build environment when native bridge is absent', () => {
    vi.stubEnv('VITE_APP_FLAVOR', 'loja')
    expect(detectRuntime().flavor).toBe('loja')
    vi.unstubAllEnvs()
  })
})

describe('roleSwitch', () => {
  afterEach(() => localStorage.clear())

  it('has no role switch in the customer app, keeping customers out of totem and painel', () => {
    expect(roleSwitch(customerApp, vi.fn())).toBeUndefined()
  })

  it('toggles store mode between totem and painel in the store app, withdrawing any tag first', () => {
    const tagBridge = { publish: vi.fn(), withdraw: vi.fn() }
    const reload = vi.fn()

    roleSwitch({ ...storeApp, tagBridge, storeRole: 'totem' }, reload)!()

    expect(detectRuntime().storeRole).toBe('painel')
    expect(tagBridge.withdraw).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()

    roleSwitch({ ...storeApp, tagBridge, storeRole: 'painel' }, reload)!()
    expect(detectRuntime().storeRole).toBe('totem')
  })

  it('has nothing to switch in a browser or desktop build without store role switch', () => {
    expect(roleSwitch(browser, vi.fn())).toBeUndefined()
    expect(roleSwitch({ ...browser, mobile: true }, vi.fn())).toBeUndefined()
  })
})

describe('isPhoneApp', () => {
  it('is the Tauri customer build on a phone', () => {
    expect(isPhoneApp(customerApp)).toBe(true)
  })

  it('is never the store app, which opens totem or painel directly', () => {
    expect(isPhoneApp(storeApp)).toBe(false)
  })

  it('is not the desktop app nor a browser, even on a phone', () => {
    expect(isPhoneApp(desktopApp)).toBe(false)
    expect(isPhoneApp({ ...browser, mobile: true })).toBe(false)
  })
})
