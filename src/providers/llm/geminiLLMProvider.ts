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
    this.model = config.model || 'gemini-3.6-flash';
  }

  public async generateStructured<T = unknown>(
    prompt: string,
    systemPrompt?: string
  ): Promise<LLMResponse<T>> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      systemInstruction: systemPrompt
        ? { parts: [{ text: `${systemPrompt}\n\nIMPORTANT: Respond ONLY with a valid JSON object matching the schema. Do not enclose in markdown blocks or write any commentary.` }] }
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
        throw new ProviderError('Gemini', `HTTP ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as any;
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new ProviderError('Gemini', 'Empty response received from model');
      }

      const parsed: T = JSON.parse(rawText);
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
      throw new ProviderError('Gemini', error instanceof Error ? error.message : String(error));
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
        throw new ProviderError('Gemini', `HTTP ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as any;
      return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('Gemini', error instanceof Error ? error.message : String(error));
    }
  }

  public async isHealthy(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
