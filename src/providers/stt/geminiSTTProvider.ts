import type { ISTTProvider, STTTranscription } from './sttProvider.interface.js';
import { ProviderError, ConfigurationError } from '../../utils/errors.js';

export class GeminiSTTProvider implements ISTTProvider {
  public readonly name = 'gemini-stt';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-3.6-flash') {
    if (!apiKey) throw new ConfigurationError('Gemini API key required for GeminiSTTProvider');
    this.apiKey = apiKey;
    this.model = model;
  }

  public async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    languageHint?: string
  ): Promise<STTTranscription> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const b64Audio = audioBuffer.toString('base64');
    const promptText = languageHint
      ? `Transcribe this audio. The speaker is likely speaking in language: ${languageHint}. Return only the transcription text.`
      : 'Transcribe this audio accurately. Return only the transcription text.';

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: b64Audio } },
          { text: promptText },
        ],
      }],
      generationConfig: { temperature: 0 },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new ProviderError('Gemini STT', `HTTP ${response.status}: ${err}`);
      }

      const json = (await response.json()) as any;
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      return { text, language: languageHint, confidence: 0.9 };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('Gemini STT', error instanceof Error ? error.message : String(error));
    }
  }

  public async isHealthy(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
