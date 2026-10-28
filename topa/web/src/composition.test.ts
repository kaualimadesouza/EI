import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpConnection } from './adapters/http/http-connection'
import { HttpMenu } from './adapters/http/http-menu'
import { HttpOrders } from './adapters/http/http-orders'
import { LocalConnection } from './adapters/local/local-connection'
import { LocalMenu } from './adapters/local/local-menu'
import { LocalOrders } from './adapters/local/local-orders'
import { TauriNfc } from './adapters/tauri/tauri-nfc'
import { UnavailableBuzzer } from './adapters/unavailable/unavailable-buzzer'
import { UnavailableNfc } from './adapters/unavailable/unavailable-nfc'
import { WebNfc } from './adapters/web/web-nfc'
import type { NdefReader } from './adapters/web/web-nfc'
import { createAdapters, detectRuntime, isPhoneApp, roleSwitch, type Runtime } from './composition'

const browser: Runtime = {
  tauri: false,
  mobile: false,
  totem: false,
  ndefReader: undefined,
  tagBridge: undefined,
  vibrate: undefined,
}
const androidApp: Runtime = { ...browser, tauri: true, mobile: true }
const desktopApp: Runtime = { ...browser, tauri: true }

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
    expect(adapters.orders).toBeInstanceOf(HttpOrders)
  })

  it('falls back to demo mode when there is no API URL', () => {
    const adapters = createAdapters(undefined, browser)

    expect(adapters.mode).toBe('demo')
    expect(adapters.connection).toBeInstanceOf(LocalConnection)
    expect(adapters.menu).toBeInstanceOf(LocalMenu)
    expect(adapters.orders).toBeInstanceOf(LocalOrders)
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

  it('picks up Web NFC when the browser has it', () => {
    vi.stubGlobal('NDEFReader', FakeNdefReader)

    expect(detectRuntime().ndefReader).toBe(FakeNdefReader)
  })
})

describe('roleSwitch', () => {
  afterEach(() => localStorage.clear())

  it('turns the Android phone app into a totem from the next start, withdrawing any tag first', () => {
    const tagBridge = { publish: vi.fn(), withdraw: vi.fn() }
    const reload = vi.fn()

    roleSwitch({ ...androidApp, tagBridge }, reload)!()

    expect(detectRuntime().totem).toBe(true)
    expect(tagBridge.withdraw).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('turns a totem back into the phone app, so it stops answering as a tag after the reload', () => {
    const tagBridge = { publish: vi.fn(), withdraw: vi.fn() }
    roleSwitch(androidApp, vi.fn())!()

    roleSwitch({ ...androidApp, totem: true, tagBridge }, vi.fn())!()

    expect(detectRuntime().totem).toBe(false)
    expect(tagBridge.withdraw).toHaveBeenCalledOnce()
  })

  it('has nothing to switch in a browser or the desktop app', () => {
    expect(roleSwitch(browser, vi.fn())).toBeUndefined()
    expect(roleSwitch({ ...browser, mobile: true }, vi.fn())).toBeUndefined()
    expect(roleSwitch(desktopApp, vi.fn())).toBeUndefined()
  })
})

describe('isPhoneApp', () => {
  it('is the Tauri build on a phone', () => {
    expect(isPhoneApp(androidApp)).toBe(true)
  })

  it('is not the desktop app nor a browser, even on a phone', () => {
    expect(isPhoneApp(desktopApp)).toBe(false)
    expect(isPhoneApp({ ...browser, mobile: true })).toBe(false)
  })

  it('is not a phone marked as totem: that one runs the kiosk', () => {
    expect(isPhoneApp({ ...androidApp, totem: true })).toBe(false)
  })
})
