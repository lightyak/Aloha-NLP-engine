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
      if (priceMatch) entities.price = { value: parseInt(priceMatch[1], 10), evidence: priceMatch[0], source: 'USER_CORRECTION', confirmed: true };
      if (qtyMatch) entities.quantity = { value: parseInt(qtyMatch[1], 10), evidence: qtyMatch[0], source: 'USER_CORRECTION', confirmed: true };
      if (terracottaMatch) entities.material = { value: ['terracotta'], evidence: 'terracotta', source: 'USER_CORRECTION', confirmed: true };

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

    // 2. "I don't know" / Uncertainty response
    if (lowerPrompt.includes("don't know") || lowerPrompt.includes('dont know') || lowerPrompt.includes('తెలియదు') || lowerPrompt.includes('pata nahi') || lowerPrompt.includes('theriyathu') || lowerPrompt.includes('gottilla')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.90,
          isDontKnow: true,
          isCorrection: false,
          language: lowerPrompt.includes('తెలియదు') ? 'te' : (lowerPrompt.includes('pata nahi') ? 'hi' : 'en'),
          entities: {},
          missingInformation: ['production_time'],
          estimationOffered: true,
          followUpQuestion: lowerPrompt.includes('తెలియదు')
            ? 'పర్వాలేదు! మీ తరపున నేనే అంచనా వేయమంటారా?'
            : "That's okay! Would you like me to estimate the production time for you?",
        } as T,
      };
    }

    // 3. Explicit permission for estimation: "Yes, estimate it" / "estimate it"
    if (lowerPrompt.includes('estimate it') || lowerPrompt.includes('estimate') || lowerPrompt.includes('అంచనా వేయండి') || lowerPrompt.includes('haan estimate karo')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.88,
          isCorrection: false,
          language: 'en',
          entities: {
            production_time: {
              value: '3 days',
              evidence: 'SYSTEM_ESTIMATION',
              source: 'SYSTEM_ESTIMATE',
              confirmed: false,
            },
          },
          missingInformation: [],
          followUpQuestion: 'I estimated the production time as 3 days. Does that look good to you?',
        } as T,
      };
    }

    // 4. Affirmation / Confirmation
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

    // 5. Rejection
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

    // 6. Etikoppaka Telugu Regression Case (Requirement 11)
    // "ఆంధ్రప్రదేశ్ అనాకాపల్లి జిల్లాలోని ఏటికొప్పాక గ్రామానికి చెందిన ఈ సాంప్రదాయ బొమ్మను సహజమైన అంకుడు చెక్క మరియు లక్క రంగులతో తయారు చేశారు. దీని ధర రూ. 600/-."
    if (prompt.includes('ఏటికొప్పాక') || prompt.includes('అంకుడు చెక్క') || (prompt.includes('etikoppaka') && prompt.includes('600'))) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.94,
          isCorrection: false,
          language: 'te',
          entities: {
            craft_type: { value: 'Etikoppaka Craft', evidence: 'ఏటికొప్పాక గ్రామానికి చెందిన', source: 'USER_EXPLICIT', confirmed: true },
            category: { value: 'toys_and_dolls', evidence: 'సాంప్రదాయ బొమ్మను', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood', 'Lacquer'], evidence: 'అంకుడు చెక్క మరియు లక్క రంగులతో', source: 'USER_EXPLICIT', confirmed: true },
            price: { value: 600, evidence: 'రూ. 600/-', source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'రూ.', source: 'USER_EXPLICIT', confirmed: true },
          },
          concepts: [
            { name: 'craft_context', value: 'Etikoppaka', type: 'craft_context', isKnown: true, evidence: 'ఏటికొప్పాక' },
            { name: 'material', value: 'Wood', type: 'material', isKnown: true, evidence: 'అంకుడు చెక్క' },
            { name: 'material', value: 'Lacquer', type: 'material', isKnown: true, evidence: 'లక్క రంగులతో' },
          ],
          missingInformation: ['product_name', 'production_time'],
          followUpQuestion: 'ఈ సాంప్రదాయ బొమ్మ పేరు ఏమిటి?',
        } as T,
      };
    }

    // 7. Telugu benchmark: "ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి."
    if (prompt.includes('కొండపల్లి') || prompt.includes('kondapalli')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.92,
          isCorrection: false,
          language: 'te',
          entities: {
            product_name: { value: 'Kondapalli Toy', evidence: 'కొండపల్లి బొమ్మ', source: 'USER_EXPLICIT', confirmed: true },
            craft_type: { value: 'Kondapalli Craft', evidence: 'కొండపల్లి', source: 'USER_EXPLICIT', confirmed: true },
            category: { value: 'toys_and_dolls', evidence: 'బొమ్మ', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'చెక్కతో', source: 'USER_EXPLICIT', confirmed: true },
            production_time: { value: '3 days', evidence: 'మూడు రోజులు', source: 'USER_EXPLICIT', confirmed: true },
            price: { value: 800, evidence: '800 రూపాయలు', source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'రూపాయలు', source: 'USER_EXPLICIT', confirmed: true },
          },
          missingInformation: [],
        } as T,
      };
    }

    // 8. Telugu + English code-switching: "Nenu wooden toys chestanu, price is 500 rupees"
    if (lowerPrompt.includes('nenu') && lowerPrompt.includes('wooden')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.91,
          isCorrection: false,
          language: 'te',
          entities: {
            product_name: { value: 'wooden toys', evidence: 'wooden toys', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'wooden', source: 'USER_EXPLICIT', confirmed: true },
            price: { value: 500, evidence: '500 rupees', source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'rupees', source: 'USER_EXPLICIT', confirmed: true },
          },
          missingInformation: ['craft_type'],
          followUpQuestion: 'ఈ wooden toys ఏ craft style లో తయారు చేశారు?',
        } as T,
      };
    }

    // 9. Hindi + English code-switching: "Main handmade wooden toys banata hoon, rate is 600 rupees"
    if (lowerPrompt.includes('main') && lowerPrompt.includes('banata')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.91,
          isCorrection: false,
          language: 'hi',
          entities: {
            product_name: { value: 'handmade wooden toys', evidence: 'handmade wooden toys', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'wooden', source: 'USER_EXPLICIT', confirmed: true },
            price: { value: 600, evidence: '600 rupees', source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'rupees', source: 'USER_EXPLICIT', confirmed: true },
          },
          missingInformation: ['craft_type'],
          followUpQuestion: 'इन wooden toys की craft style क्या है?',
        } as T,
      };
    }

    // 10. Tamil + English code-switching: "Naan wooden toys seigiren, price 400 rupees"
    if (lowerPrompt.includes('naan') && lowerPrompt.includes('seigiren')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.90,
          isCorrection: false,
          language: 'ta',
          entities: {
            product_name: { value: 'wooden toys', evidence: 'wooden toys', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'wooden', source: 'USER_EXPLICIT', confirmed: true },
            price: { value: 400, evidence: '400 rupees', source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'rupees', source: 'USER_EXPLICIT', confirmed: true },
          },
          missingInformation: ['craft_type'],
          followUpQuestion: 'இந்த wooden toys-ன் craft வகை என்ன?',
        } as T,
      };
    }

    // 11. Kannada + English code-switching: "Naanu wooden toys maduttene, price 450 rupees"
    if (lowerPrompt.includes('naanu') && lowerPrompt.includes('maduttene')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.90,
          isCorrection: false,
          language: 'kn',
          entities: {
            product_name: { value: 'wooden toys', evidence: 'wooden toys', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'wooden', source: 'USER_EXPLICIT', confirmed: true },
            price: { value: 450, evidence: '450 rupees', source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'rupees', source: 'USER_EXPLICIT', confirmed: true },
          },
          missingInformation: ['craft_type'],
          followUpQuestion: 'ಈ wooden toys ನ craft ಶೈಲಿ ಯಾವುದು?',
        } as T,
      };
    }

    // 12. Unknown artisan concept benchmark: "I make Etikoppaka wooden toys"
    if (lowerPrompt.includes('etikoppaka')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.91,
          isCorrection: false,
          language: 'en',
          entities: {
            product_name: { value: 'Etikoppaka wooden toys', evidence: 'Etikoppaka wooden toys', source: 'USER_EXPLICIT', confirmed: true },
            craft_type: { value: 'Etikoppaka Craft', evidence: 'Etikoppaka', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'wooden', source: 'USER_EXPLICIT', confirmed: true },
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

    // 13. Synonym mapping: "made from timber"
    if (lowerPrompt.includes('timber')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.90,
          isCorrection: false,
          language: 'en',
          entities: {
            material: { value: ['Wood'], evidence: 'timber', source: 'USER_EXPLICIT', confirmed: true },
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

    // 14. Multi-turn anaphora or price follow-up: "They cost 350 rupees each"
    if (lowerPrompt.includes('350') || (lowerPrompt.includes('cost') && /\d+/.test(lowerPrompt))) {
      const priceNum = (prompt.match(/\d+/) || ['350'])[0];
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.92,
          isCorrection: false,
          language: 'en',
          entities: {
            price: { value: parseInt(priceNum, 10), evidence: `${priceNum} rupees`, source: 'USER_EXPLICIT', confirmed: true },
            currency: { value: 'INR', evidence: 'rupees', source: 'USER_EXPLICIT', confirmed: true },
          },
        } as T,
      };
    }

    // 15. Basic product creation without price: "I make wooden toys"
    if (lowerPrompt.includes('wooden toys') || lowerPrompt.includes('wooden toy')) {
      return {
        data: {
          intent: 'CREATE_PRODUCT',
          confidence: 0.88,
          isCorrection: false,
          language: 'en',
          entities: {
            product_name: { value: 'wooden toys', evidence: 'wooden toys', source: 'USER_EXPLICIT', confirmed: true },
            material: { value: ['Wood'], evidence: 'wooden', source: 'USER_EXPLICIT', confirmed: true },
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

    // 16. General creation / update fallback
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
