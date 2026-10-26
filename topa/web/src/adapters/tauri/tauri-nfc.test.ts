import { NFCTypeNameFormat, scan, type Tag, type TagRecord } from '@tauri-apps/plugin-nfc'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TauriNfc } from './tauri-nfc'

vi.mock('@tauri-apps/plugin-nfc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tauri-apps/plugin-nfc')>()),
  scan: vi.fn(),
}))

const pluginScan = vi.mocked(scan)

// Android hands bytes over as signed Java bytes, so anything past ASCII arrives negative
function signedBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)].map((byte) => (byte > 127 ? byte - 256 : byte))
}

function uriRecord(code: number, rest: string): TagRecord {
  return { tnf: NFCTypeNameFormat.NfcWellKnown, kind: [0x55], id: [], payload: [code, ...signedBytes(rest)] }
}

function tagWith(...records: TagRecord[]): Tag {
  return { id: [4, 1, 2], kind: ['android.nfc.tech.Ndef'], records }
}

const textRecord: TagRecord = {
  tnf: NFCTypeNameFormat.NfcWellKnown,
  kind: [0x54],
  id: [],
  payload: [2, ...signedBytes('enolá')],
}

function scanNow() {
  return new TauriNfc().scan(new AbortController().signal)
}

afterEach(() => {
  pluginScan.mockReset()
})

describe('TauriNfc', () => {
  it('asks the plugin for any tag and returns the URL of its URI record', async () => {
    pluginScan.mockResolvedValue(tagWith(uriRecord(0x04, 'topa-totem.vercel.app/?loja=lanchonete-bauru')))

    expect(await scanNow()).toEqual({ kind: 'url', url: 'https://topa-totem.vercel.app/?loja=lanchonete-bauru' })
    expect(pluginScan).toHaveBeenCalledWith({ type: 'tag' })
  })

  it.each([
    [0x00, 'https://topa.app/?loja=a', 'https://topa.app/?loja=a'],
    [0x01, 'topa.app/?loja=a', 'http://www.topa.app/?loja=a'],
    [0x02, 'topa.app/?loja=a', 'https://www.topa.app/?loja=a'],
    [0x03, 'topa.app/?loja=a', 'http://topa.app/?loja=a'],
  ])('expands the URI prefix code %i', async (code, rest, url) => {
    pluginScan.mockResolvedValue(tagWith(uriRecord(code, rest)))

    expect(await scanNow()).toEqual({ kind: 'url', url })
  })

  it('decodes characters past ASCII from the signed bytes Android sends', async () => {
    pluginScan.mockResolvedValue(tagWith(uriRecord(0x04, 'topa.app/cardápio?loja=a')))

    expect(await scanNow()).toEqual({ kind: 'url', url: 'https://topa.app/cardápio?loja=a' })
  })

  it('skips records that are not URI records', async () => {
    pluginScan.mockResolvedValue(tagWith(textRecord, uriRecord(0x04, 'topa.app/?loja=a')))

    expect(await scanNow()).toEqual({ kind: 'url', url: 'https://topa.app/?loja=a' })
  })

  it('reports a tag without a URI record as no-url', async () => {
    pluginScan.mockResolvedValue(tagWith(textRecord))

    expect(await scanNow()).toEqual({ kind: 'no-url' })
  })

  it('reports a blank tag as no-url', async () => {
    pluginScan.mockResolvedValue(tagWith())

    expect(await scanNow()).toEqual({ kind: 'no-url' })
  })

  it('ignores records typed by an absolute URI instead of the well known U', async () => {
    const absolute: TagRecord = { tnf: NFCTypeNameFormat.AbsoluteURI, kind: [0x55], id: [], payload: [0x04] }
    pluginScan.mockResolvedValue(tagWith(absolute))

    expect(await scanNow()).toEqual({ kind: 'no-url' })
  })

  it('treats URIs that are not web addresses as no-url', async () => {
    pluginScan.mockResolvedValue(tagWith(uriRecord(0x05, '+5511999999999'), uriRecord(0x23, 'x')))

    expect(await scanNow()).toEqual({ kind: 'no-url' })
  })

  it('treats a URI record with an empty payload as no-url', async () => {
    pluginScan.mockResolvedValue(tagWith({ tnf: NFCTypeNameFormat.NfcWellKnown, kind: [0x55], id: [], payload: [] }))

    expect(await scanNow()).toEqual({ kind: 'no-url' })
  })

  it('reports a phone without NFC hardware', async () => {
    pluginScan.mockRejectedValue({ message: 'NFC unavailable: Device does not have NFC capabilities' })

    expect(await scanNow()).toEqual({ kind: 'no-nfc' })
  })

  it('reports NFC turned off in the settings', async () => {
    pluginScan.mockRejectedValue({ message: 'NFC unavailable: NFC is disabled in device settings' })

    expect(await scanNow()).toEqual({ kind: 'nfc-off' })
  })

  it('reports a failed read as nothing-read', async () => {
    pluginScan.mockRejectedValue({ message: 'failed to read tag' })

    expect(await scanNow()).toEqual({ kind: 'nothing-read' })
  })

  it('reports a call that never reached the plugin as nothing-read', async () => {
    pluginScan.mockRejectedValue('plugin nfc not found')

    expect(await scanNow()).toEqual({ kind: 'nothing-read' })
  })

  it('ends a pending scan as nothing-read when the signal aborts', async () => {
    pluginScan.mockReturnValue(new Promise<Tag>(() => {}))
    const controller = new AbortController()

    const outcome = new TauriNfc().scan(controller.signal)
    controller.abort()

    expect(await outcome).toEqual({ kind: 'nothing-read' })
  })

  it('does not start the plugin when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    expect(await new TauriNfc().scan(controller.signal)).toEqual({ kind: 'nothing-read' })
    expect(pluginScan).not.toHaveBeenCalled()
  })
})
