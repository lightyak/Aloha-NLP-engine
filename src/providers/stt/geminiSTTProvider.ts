import type { ISTTProvider, STTTranscription } from './sttProvider.interface.js';
import { ProviderError, ConfigurationError } from '../../utils/errors.js';

/**
 * Gemini-based STT provider.
 *
 * Uses the Gemini generateContent API with inline audio data.
 * The STT model is independently configured via STT_MODEL (never borrowed from LLM_MODEL).
 * The API key is independently configured via STT_API_KEY (never shared with LLM_API_KEY).
 *
 * Confidence: NOT manufactured. Only populated if the Gemini response contains a real value.
 * Language: detectedLanguage is only set when Gemini actually reports it.
 *           languageHint echoes the caller-supplied hint for traceability without claiming detection.
 */
export class GeminiSTTProvider implements ISTTProvider {
  public readonly name = 'gemini-stt';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    if (!apiKey) throw new ConfigurationError('STT_API_KEY is required for GeminiSTTProvider');
    this.apiKey = apiKey;
    this.model = model;
  }

  /** Redacts the API key from any string before it reaches logs or error messages. */
  private redact(msg: string): string {
    return msg.replace(
      new RegExp(this.apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      '[REDACTED]',
    );
  }

  public async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    languageHint?: string,
  ): Promise<STTTranscription> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const b64Audio = audioBuffer.toString('base64');

    // Build a transcription-focused prompt.
    // If a language hint is supplied, include it — but do not assert detection.
    const promptParts: string[] = [
      'Transcribe the following audio accurately.',
      'Return only the verbatim transcription text.',
      'Preserve the original language(s) and script.',
      'Do not translate, summarise, or add commentary.',
    ];
    if (languageHint) {
      promptParts.push(`The speaker is likely using language code: ${languageHint}.`);
    }

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: b64Audio } },
          { text: promptParts.join(' ') },
        ],
      }],
      generationConfig: { temperature: 0 },
    };

    let responseJson: unknown;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '(unreadable)');
        throw new ProviderError('GeminiSTT', `HTTP ${response.status}: ${this.redact(errText)}`);
      }

      responseJson = await response.json();
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const raw = error instanceof Error ? error.message : String(error);
      throw new ProviderError('GeminiSTT', this.redact(raw));
    }

    const json = responseJson as Record<string, any>;
    console.log('GEMINI STT RESPONSE:', JSON.stringify(json, null, 2));

    if (json.promptFeedback?.blockReason) {
      throw new ProviderError('GeminiSTT', `Blocked by safety policy: ${json.promptFeedback.blockReason}`);
    }

    const candidate = (json as any).candidates?.[0];
    if (!candidate) {
      throw new ProviderError('GeminiSTT', 'No candidate returned from Gemini STT response');
    }

    const parts = candidate?.content?.parts ?? [];

    const rawText = parts
      .map((part: any) => part?.audioTranscription?.text ?? part?.text ?? '')
      .filter(Boolean)
      .join(' ');

    const text = rawText.trim();

    if (!text) {
      throw new ProviderError('GeminiSTT', 'Gemini returned an empty transcription');
    }

    // Gemini's generateContent response does not include a per-request language detection field.
    // Do not manufacture detectedLanguage from the hint.
    const result: STTTranscription = { text };
    if (languageHint) result.languageHint = languageHint;
    // Maintain backwards-compat: populate deprecated `language` only from the hint when supplied.
    if (languageHint) result.language = languageHint;

    return result;
  }

  /**
   * Configuration readiness check — verifies the API key is present.
   * Does NOT make a network call to avoid startup latency.
   */
  public async isHealthy(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
