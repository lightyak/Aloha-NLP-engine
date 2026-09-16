import type { ISTTProvider, STTTranscription } from './sttProvider.interface.js';

/**
 * Development mock STT provider — returns canned transcriptions based on audio buffer size/hash.
 * NEVER used in production; clearly marked as development-only.
 */
export class MockSTTProvider implements ISTTProvider {
  public readonly name = 'mock-stt';

  private canned: Map<string, STTTranscription> = new Map();

  public setCannedTranscription(key: string, result: STTTranscription): void {
    this.canned.set(key, result);
  }

  public async transcribe(
    audioBuffer: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mimeType: string,
    languageHint?: string
  ): Promise<STTTranscription> {
    // Check canned responses by buffer size key
    const sizeKey = `size:${audioBuffer.length}`;
    if (this.canned.has(sizeKey)) return this.canned.get(sizeKey)!;

    // Default mock response for development testing
    return {
      text: 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి.',
      language: languageHint || 'te',
      confidence: 0.92,
      duration: 5.0,
    };
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }
}
