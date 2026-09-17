import type { ISTTProvider } from './sttProvider.interface.js';
import { MockSTTProvider } from './mockSTTProvider.js';
import { GeminiSTTProvider } from './geminiSTTProvider.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class STTProviderFactory {
  private static instance: ISTTProvider | null = null;

  public static getProvider(): ISTTProvider {
    if (this.instance) return this.instance;

    if (config.app.isTest) {
      this.instance = new MockSTTProvider();
      return this.instance;
    }

    const sttConfig = config.providers.stt;

    // Use the dedicated STT API key; fall back to the LLM key if not configured.
    const apiKey = sttConfig.apiKey || config.providers.llm.apiKey;
    // Use the dedicated STT model; fall back to the LLM model if not configured.
    const model = sttConfig.model || config.providers.llm.model;

    if (sttConfig.provider === 'gemini' && apiKey) {
      logger.info({ provider: 'gemini-stt', model }, 'Initializing Gemini STT Provider');
      this.instance = new GeminiSTTProvider(apiKey, model);
      return this.instance;
    }

    logger.info('Initializing Mock STT Provider (Development & Testing Mode)');
    this.instance = new MockSTTProvider();
    return this.instance;
  }

  public static setProvider(provider: ISTTProvider): void {
    this.instance = provider;
  }

  public static reset(): void {
    this.instance = null;
  }
}

export const defaultSTTProvider = STTProviderFactory.getProvider();
