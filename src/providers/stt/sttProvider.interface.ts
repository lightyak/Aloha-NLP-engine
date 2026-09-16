export interface STTTranscription {
  text: string;
  language?: string;
  confidence?: number;
  duration?: number;
}

export interface ISTTProvider {
  name: string;
  transcribe(audioBuffer: Buffer, mimeType: string, languageHint?: string): Promise<STTTranscription>;
  isHealthy(): Promise<boolean>;
}
