export interface STTTranscription {
  /** Transcribed text. */
  text: string;
  /**
   * Language code detected by the STT provider (e.g. "te", "hi").
   * Only populated when the provider actually reports detected language.
   * Do NOT populate this from a caller-supplied hint.
   */
  detectedLanguage?: string;
  /**
   * The language hint passed by the caller, echoed back for traceability.
   * Present when a hint was supplied; does not imply Gemini confirmed it.
   */
  languageHint?: string;
  /** @deprecated Use detectedLanguage. Kept for backwards-compat with existing controller/tests. */
  language?: string;
  /** Confidence score only when the provider genuinely returns one. Never manufactured. */
  confidence?: number;
  /** Audio duration in seconds, when available. */
  duration?: number;
}

export interface ISTTProvider {
  name: string;
  transcribe(audioBuffer: Buffer, mimeType: string, languageHint?: string): Promise<STTTranscription>;
  isHealthy(): Promise<boolean>;
}
