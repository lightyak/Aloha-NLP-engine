import { describe, it, expect, beforeEach } from 'vitest';
import { NLUEngine } from '../../src/core/nlu/nluEngine.js';
import { MockLLMProvider } from '../../src/providers/llm/mockLLMProvider.js';
import { ValidationError } from '../../src/utils/errors.js';

describe('NLUEngine', () => {
  let nlu: NLUEngine;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider();
    nlu = new NLUEngine({ llmProvider: mockLLM });
  });

  it('should process master prompt benchmark Telugu utterance into structured validated data', async () => {
    const utterance = 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి.';
    const result = await nlu.process(utterance);

    expect(result.intent.name).toBe('CREATE_PRODUCT');
    expect(result.detectedLanguage).toBe('te');
    expect(result.entities.craft_type).toBe('Kondapalli Craft');
    expect(result.entities.price).toBe(800);
    expect(result.entities.currency).toBe('INR');
    expect(result.entities.production_time).toBe('3 days');
    expect(result.entities.material).toContain('Wood');
    expect(result.validation.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('should detect natural corrections and flag isCorrection', async () => {
    const utterance = 'Actually, the price is 900';
    const result = await nlu.process(utterance, {
      currentDraft: {
        product_name: 'Kondapalli Toy',
        craft_type: 'Kondapalli Craft',
        category: 'toys_and_dolls',
        material: ['Wood'],
        price: 800,
      },
    });

    expect(result.intent.name).toBe('CORRECT_INFORMATION');
    expect(result.isCorrection).toBe(true);
    expect(result.entities.price).toBe(900);
  });

  it('should calculate missing fields dynamically when partial information is provided', async () => {
    mockLLM.setCannedResponse('wooden toy', {
      intent: 'CREATE_PRODUCT',
      confidence: 0.85,
      isCorrection: false,
      entities: {
        product_name: 'Wooden Dancing Doll',
        material: ['Wood'],
      },
    });

    const result = await nlu.process('I made a wooden toy');
    expect(result.intent.name).toBe('CREATE_PRODUCT');
    expect(result.entities.product_name).toBe('Wooden Dancing Doll');
    expect(result.missingFields).toContain('price');
    expect(result.missingFields).toContain('craft_type');
  });

  it('should reject empty input with ValidationError', async () => {
    await expect(nlu.process('')).rejects.toThrow(ValidationError);
    await expect(nlu.process('   ')).rejects.toThrow(ValidationError);
  });
});
