export interface LLMResponse<T = unknown> {
  data: T;
  rawResponse?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ILLMProvider {
  name: string;
  generateStructured<T = unknown>(prompt: string, systemPrompt?: string): Promise<LLMResponse<T>>;
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
  isHealthy(): Promise<boolean>;
}
