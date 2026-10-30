import type { VoiceRecognitionPort } from '../../ports/voice'

export class SimulatorVoiceAdapter implements VoiceRecognitionPort {
  private customTranscript: string | null = null

  constructor(initialTranscript: string | null = null) {
    this.customTranscript = initialTranscript
  }

  isSupported(): boolean {
    return true
  }

  setNextTranscript(transcript: string): void {
    this.customTranscript = transcript
  }

  startListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    _onError?: (error: string) => void,
  ): () => void {
    void _onError
    const text = this.customTranscript ?? 'Quero um misto quente e um suco de laranja'
    const timer = setTimeout(() => {
      onTranscript(text, true)
    }, 50)

    return () => {
      clearTimeout(timer)
    }
  }
}
