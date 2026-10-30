export interface VoiceRecognitionPort {
  isSupported(): boolean
  startListening(
    onTranscript: (transcript: string, isFinal: boolean) => void,
    onError: (error: string) => void,
  ): () => void
}
