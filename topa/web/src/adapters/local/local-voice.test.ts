import { describe, expect, it, vi } from 'vitest'

import { SimulatorVoiceAdapter } from './local-voice'

describe('SimulatorVoiceAdapter', () => {
  it('is always supported and triggers simulated transcript', async () => {
    vi.useFakeTimers()
    const adapter = new SimulatorVoiceAdapter()
    expect(adapter.isSupported()).toBe(true)

    const onTranscript = vi.fn()
    const onError = vi.fn()

    const stop = adapter.startListening(onTranscript, onError)
    expect(onTranscript).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(onTranscript).toHaveBeenCalledWith('Quero um misto quente e um suco de laranja', true)
    expect(onError).not.toHaveBeenCalled()

    stop()
    vi.useRealTimers()
  })

  it('allows configuring custom transcript and supports cancelling before timeout', () => {
    vi.useFakeTimers()
    const adapter = new SimulatorVoiceAdapter('dois pasteis')
    adapter.setNextTranscript('tres cafés')

    const onTranscript = vi.fn()
    const stop = adapter.startListening(onTranscript, vi.fn())

    stop()
    vi.advanceTimersByTime(100)
    expect(onTranscript).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
