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
    // 1. Natural correction: "Actually, they are made from terracotta" or "Actually, the price is 900"
    if (lowerPrompt.includes('actually') || lowerPrompt.includes('no,') || lowerPrompt.includes('change') || lowerPrompt.includes('కాదు') || lowerPrompt.includes('తప్పు')) {
      const priceMatch = prompt.match(/(?:price|rate|cost|రూపాయలు|vela)\s*(?:is|to|:)?\s*(\d+)/i);
      const qtyMatch = prompt.match(/(?:quantity|units|pieces)\s*(?:to|is|:)?\s*(\d+)/i);
      const terracottaMatch = lowerPrompt.includes('terracotta') || lowerPrompt.includes('clay');

      const entities: Record<string, unknown> = {};
      if (priceMatch) entities.price = parseInt(priceMatch[1], 10);
      if (qtyMatch) entities.quantity = parseInt(qtyMatch[1], 10);
      if (terracottaMatch) entities.material = ['terracotta'];

      return {
        data: {
          intent: 'CORRECT_INFORMATION',
          confidence: 0.95,
          isCorrection: true,
          entities,
          language: lowerPrompt.includes('కాదు') ? 'te' : 'en',
          concepts: terracottaMatch ? [{ name: 'material', value: 'terracotta', isKnown: false, evidence: 'terracotta' }] : [],
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

    // 5. Unknown artisan concept benchmark: "I make Etikoppaka wooden toys" or "Etikoppaka"
    if (lowerPrompt.includes('etikoppaka')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.91,
          isCorrection: false,
          language: 'en',
          entities: {
            product_name: 'Etikoppaka wooden toys',
            craft_type: 'Etikoppaka Craft',
            material: ['Wood'],
          },
          concepts: [
            {
              name: 'product_concept',
              value: 'Etikoppaka wooden toys',
              isKnown: false,
              evidence: 'Etikoppaka wooden toys',
            },
          ],
        } as T,
      };
    }

    // 6. Synonym mapping: "made from timber"
    if (lowerPrompt.includes('timber')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.90,
          isCorrection: false,
          language: 'en',
          entities: {
            material: ['Wood'],
          },
          concepts: [
            {
              name: 'material',
              value: 'Wood',
              isKnown: true,
              evidence: 'timber',
            },
          ],
        } as T,
      };
    }

    // 7. Multi-turn anaphora or price follow-up: "They cost 350 rupees each" or "350 rupees"
    if (lowerPrompt.includes('350') || (lowerPrompt.includes('cost') && /\d+/.test(lowerPrompt))) {
      const priceNum = (prompt.match(/\d+/) || ['350'])[0];
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.92,
          isCorrection: false,
          language: 'en',
          entities: {
            price: parseInt(priceNum, 10),
            currency: 'INR',
          },
        } as T,
      };
    }

    // 8. Basic product creation without price: "I make wooden toys"
    if (lowerPrompt.includes('wooden toys') || lowerPrompt.includes('wooden toy')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.88,
          isCorrection: false,
          language: 'en',
          entities: {
            product_name: 'wooden toys',
            material: ['Wood'],
          },
          concepts: [
            {
              name: 'product_concept',
              value: 'wooden toys',
              isKnown: false,
              evidence: 'wooden toys',
            },
          ],
          missingInformation: ['price', 'craft_type'],
          followUpQuestion: 'What price would you like to set for these wooden toys?',
        } as T,
      };
    }

    // 9. General creation / update fallback
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
