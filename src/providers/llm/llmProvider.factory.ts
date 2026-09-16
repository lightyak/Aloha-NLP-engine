import type { ILLMProvider } from './llmProvider.interface.js';
import { MockLLMProvider } from './mockLLMProvider.js';
import { GeminiLLMProvider } from './geminiLLMProvider.js';
import { OpenAILLMProvider } from './openaiLLMProvider.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class LLMProviderFactory {
  private static instance: ILLMProvider | null = null;

  public static getProvider(): ILLMProvider {
    if (this.instance) {
      return this.instance;
    }

    if (config.app.isTest) {
      this.instance = new MockLLMProvider();
      return this.instance;
    }

    const { provider, apiKey, model } = config.providers.llm;

    if (provider === 'gemini' && apiKey) {
      logger.info({ provider: 'gemini', model }, 'Initializing Google Gemini LLM Provider');
      this.instance = new GeminiLLMProvider({ apiKey, model });
      return this.instance;
    }

    if ((provider === 'openai' || provider === 'groq') && apiKey) {
      logger.info({ provider, model }, `Initializing ${provider.toUpperCase()} LLM Provider`);
      this.instance = new OpenAILLMProvider({ apiKey, model });
      return this.instance;
    }

    logger.info('Initializing Mock LLM Provider (Development & Testing Mode)');
    this.instance = new MockLLMProvider();
    return this.instance;
  }

  public static setProvider(provider: ILLMProvider): void {
    this.instance = provider;
  }

  public static reset(): void {
    this.instance = null;
  }
}

export const defaultLLMProvider = LLMProviderFactory.getProvider();
