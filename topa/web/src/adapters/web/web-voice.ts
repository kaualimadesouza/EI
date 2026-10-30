import type { VoiceRecognitionPort } from '../../ports/voice'

interface SpeechRecognitionEvent {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      [index: number]: {
        transcript: string
      }
    }
  }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition
}

export class WebSpeechVoiceAdapter implements VoiceRecognitionPort {
  isSupported(): boolean {
    return getRecognitionConstructor() !== undefined
  }

  startListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
  ): () => void {
    const RecognitionClass = getRecognitionConstructor()
    if (!RecognitionClass) {
      onError('Reconhecimento de voz não suportado neste navegador.')
      return () => {}
    }

    try {
      const recognition = new RecognitionClass()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = ''
        let isFinal = false
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          if (res[0]) {
            fullTranscript += `${res[0].transcript} `
            if (res.isFinal) {
              isFinal = true
            }
          }
        }
        onTranscript(fullTranscript.trim(), isFinal)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        onError(event.error)
      }

      recognition.start()

      return () => {
        recognition.onresult = null
        recognition.onerror = null
        recognition.stop()
      }
    } catch (err) {
      onError((err as Error).message)
      return () => {}
    }
  }
}
