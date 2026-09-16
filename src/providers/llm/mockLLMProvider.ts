import type { ILLMProvider, LLMResponse } from './llmProvider.interface.js';

export class MockLLMProvider implements ILLMProvider {
  public readonly name = 'mock-llm';

  private cannedResponses: Map<string, unknown> = new Map();

  public setCannedResponse(keySnippet: string, response: unknown): void {
    this.cannedResponses.set(keySnippet.toLowerCase(), response);
  }

  public clearCannedResponses(): void {
    this.cannedResponses.clear();
  }

  public async generateStructured<T = unknown>(
    prompt: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    systemPrompt?: string
  ): Promise<LLMResponse<T>> {
    const lowerPrompt = prompt.toLowerCase();

    // Check canned responses first
    for (const [key, val] of this.cannedResponses.entries()) {
      if (lowerPrompt.includes(key)) {
        return {
          data: val as T,
          rawResponse: JSON.stringify(val),
          usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
        };
      }
    }

    // Heuristic mock parser for multilingual benchmark utterances
    // 1. Natural correction: "Actually, the price is 900" or "Change quantity to 10"
    if (lowerPrompt.includes('actually') || lowerPrompt.includes('no,') || lowerPrompt.includes('change')) {
      const priceMatch = prompt.match(/(?:price|rate|cost|రూపాయలు|vela)\s*(?:is|to|:)?\s*(\d+)/i);
      const qtyMatch = prompt.match(/(?:quantity|units|pieces)\s*(?:to|is|:)?\s*(\d+)/i);

      const entities: Record<string, unknown> = {};
      if (priceMatch) entities.price = parseInt(priceMatch[1], 10);
      if (qtyMatch) entities.quantity = parseInt(qtyMatch[1], 10);

      return {
        data: {
          intent: 'CORRECT_INFORMATION',
          confidence: 0.95,
          isCorrection: true,
          entities,
          language: 'en',
        } as T,
      };
    }

    // 2. Affirmation / Confirmation
    if (/^(yes|correct|అవును|సరే|हाँ|looks good)$/i.test(prompt.trim())) {
      return {
        data: {
          intent: 'CONFIRM',
          confidence: 0.98,
          isCorrection: false,
          entities: {},
        } as T,
      };
    }

    // 3. Rejection
    if (/^(no|cancel|వద్దు|కాదు|नहीं)$/i.test(prompt.trim())) {
      return {
        data: {
          intent: 'REJECT',
          confidence: 0.98,
          isCorrection: false,
          entities: {},
        } as T,
      };
    }

    // 4. Telugu benchmark: "ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి."
    if (prompt.includes('కొండపల్లి') || prompt.includes('kondapalli')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.92,
          isCorrection: false,
          language: 'te',
          entities: {
            product_name: 'Kondapalli Toy',
            craft_type: 'Kondapalli Craft',
            category: 'toys_and_dolls',
            material: ['Wood'],
            production_time: '3 days',
            price: 800,
            currency: 'INR',
          },
        } as T,
      };
    }

    // 5. General creation / update fallback
    return {
      data: {
        intent: 'CREATE_PRODUCT',
        confidence: 0.85,
        isCorrection: false,
        entities: {},
      } as T,
    };
  }

  public async generateText(
    prompt: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    systemPrompt?: string
  ): Promise<string> {
    return `Mock AI generated response for prompt: "${prompt.slice(0, 50)}..."`;
  }

  public async isHealthy(): Promise<boolean> {
    return true;
  }
}
