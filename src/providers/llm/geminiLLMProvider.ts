import type { ILLMProvider, LLMResponse } from './llmProvider.interface.js';
import { ProviderError, ConfigurationError } from '../../utils/errors.js';

export interface GeminiProviderConfig {
  apiKey: string;
  model?: string;
}

export class GeminiLLMProvider implements ILLMProvider {
  public readonly name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey) {
      throw new ConfigurationError('Gemini API key is required to initialize GeminiLLMProvider');
    }
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-1.5-flash';
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!this.apiKey) return msg;
    return msg.replace(new RegExp(this.apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED_API_KEY]');
  }

  public async generateStructured<T = unknown>(
    prompt: string,
    systemPrompt?: string
  ): Promise<LLMResponse<T>> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      systemInstruction: systemPrompt
        ? { parts: [{ text: `${systemPrompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object matching the requested schema. Do not include markdown code block formatting, backticks, or any conversational preamble or postscript.` }] }
        : undefined,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError('Gemini', `HTTP ${response.status}: ${this.sanitizeErrorMessage(errorText)}`);
      }

      const json = (await response.json()) as any;

      if (json.promptFeedback?.blockReason) {
        throw new ProviderError('Gemini', `Request blocked by safety policy: ${json.promptFeedback.blockReason}`);
      }

      const candidate = json.candidates?.[0];
      if (!candidate) {
        throw new ProviderError('Gemini', 'No generation candidates returned from Gemini API');
      }

      const rawText = candidate.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new ProviderError('Gemini', 'Empty response received from model');
      }

      let cleanText = rawText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      }

      const parsed: T = JSON.parse(cleanText);
      return {
        data: parsed,
        rawResponse: rawText,
        usage: {
          promptTokens: json.usageMetadata?.promptTokenCount,
          completionTokens: json.usageMetadata?.candidatesTokenCount,
          totalTokens: json.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const rawMsg = error instanceof Error ? error.message : String(error);
      throw new ProviderError('Gemini', this.sanitizeErrorMessage(rawMsg));
    }
  }

  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError('Gemini', `HTTP ${response.status}: ${this.sanitizeErrorMessage(errorText)}`);
      }

      const json = (await response.json()) as any;
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const rawMsg = error instanceof Error ? error.message : String(error);
      throw new ProviderError('Gemini', this.sanitizeErrorMessage(rawMsg));
    }
  }

  public async isHealthy(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
