import type { ILLMProvider, LLMResponse } from './llmProvider.interface.js';
import { ProviderError, ConfigurationError } from '../../utils/errors.js';

export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAILLMProvider implements ILLMProvider {
  public readonly name = 'openai';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: OpenAIProviderConfig) {
    if (!config.apiKey) {
      throw new ConfigurationError('API key is required to initialize OpenAILLMProvider');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';
  }

  public async generateStructured<T = unknown>(
    prompt: string,
    systemPrompt?: string
  ): Promise<LLMResponse<T>> {
    const url = `${this.baseUrl}/chat/completions`;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError('OpenAI', `HTTP ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as any;
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new ProviderError('OpenAI', 'Empty completion received from model');
      }

      const parsed: T = JSON.parse(content);
      return {
        data: parsed,
        rawResponse: content,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('OpenAI', error instanceof Error ? error.message : String(error));
    }
  }

  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError('OpenAI', `HTTP ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as any;
      return json.choices?.[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('OpenAI', error instanceof Error ? error.message : String(error));
    }
  }

  public async isHealthy(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
