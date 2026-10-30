import { afterEach, describe, expect, it, vi } from 'vitest'

import { WebSpeechVoiceAdapter } from './web-voice'

describe('WebSpeechVoiceAdapter', () => {
  const originalSpeechRecognition = (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
  const originalWebkitSpeechRecognition = (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

  afterEach(() => {
    ;(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = originalSpeechRecognition
    ;(window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = originalWebkitSpeechRecognition
    vi.restoreAllMocks()
  })

  it('detects when speech recognition is not supported', () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

    const adapter = new WebSpeechVoiceAdapter()
    expect(adapter.isSupported()).toBe(false)

    const onError = vi.fn()
    const stop = adapter.startListening(vi.fn(), onError)
    expect(onError).toHaveBeenCalledWith('Reconhecimento de voz não suportado neste navegador.')
    expect(typeof stop).toBe('function')
    stop()
  })

  it('starts recognition and receives transcript results', () => {
    const mockInstance = {
      lang: '',
      continuous: false,
      interimResults: false,
      onresult: null as ((ev: unknown) => void) | null,
      onerror: null as ((ev: unknown) => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    }

    class MockSpeechRecognition {
      constructor() {
        return mockInstance
      }
    }

    ;(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = MockSpeechRecognition

    const adapter = new WebSpeechVoiceAdapter()
    expect(adapter.isSupported()).toBe(true)

    const onTranscript = vi.fn()
    const onError = vi.fn()
    const stop = adapter.startListening(onTranscript, onError)

    expect(mockInstance.start).toHaveBeenCalled()

    mockInstance.onresult?.({
      resultIndex: 0,
      results: [
        {
          0: { transcript: 'quero dois cafés' },
          isFinal: true,
        },
      ],
    })

    expect(onTranscript).toHaveBeenCalledWith('quero dois cafés', true)

    mockInstance.onresult?.({
      resultIndex: 1,
      results: [
        {
          0: { transcript: 'e um suco' },
          isFinal: false,
        },
        {} as never,
      ],
    })

    expect(onTranscript).toHaveBeenCalledWith('e um suco', false)

    mockInstance.onerror?.({ error: 'not-allowed' })
    expect(onError).toHaveBeenCalledWith('not-allowed')

    stop()
    expect(mockInstance.stop).toHaveBeenCalled()
  })

  it('handles constructor throw safely', () => {
    class FailingSpeechRecognition {
      constructor() {
        throw new Error('Microphone permission blocked')
      }
    }

    ;(window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FailingSpeechRecognition

    const adapter = new WebSpeechVoiceAdapter()
    const onError = vi.fn()
    const stop = adapter.startListening(vi.fn(), onError)

    expect(onError).toHaveBeenCalledWith('Microphone permission blocked')
    stop()
  })
})
