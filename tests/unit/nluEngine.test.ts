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

  it('TEST 1: Basic extraction - extracts intent and materials without inventing unmentioned fields', async () => {
    const utterance = 'I make wooden toys.';
    const result = await nlu.process(utterance);

    expect(result.intent.name).toBe('CREATE_PRODUCT');
    expect(result.entities.product_name).toBe('wooden toys');
    expect(result.entities.material).toContain('Wood');
    expect(result.entities.price).toBeUndefined();
    expect(result.entities['location']).toBeUndefined();
    expect(result.entities.quantity).toBeUndefined();
  });

  it('TEST 2: Unknown product concept - preserves novel artisan concepts not in ontology', async () => {
    const utterance = 'I make Etikoppaka wooden toys.';
    const result = await nlu.process(utterance);

    expect(result.entities.product_name).toBe('Etikoppaka wooden toys');
    expect(result.entities.craft_type).toBe('Etikoppaka Craft');
    expect(result.entities.material).toContain('Wood');
    expect(result.concepts?.some((c) => c.value === 'Etikoppaka wooden toys')).toBe(true);
  });

  it('TEST 3: Multi-turn context - resolves pronouns and updates draft across turns', async () => {
    const currentDraft = {
      product_name: 'wooden toys',
      material: ['Wood'],
    };

    const utterance = 'They cost 350 rupees each.';
    const result = await nlu.process(utterance, { currentDraft });

    expect(result.entities.price).toBe(350);
    expect(result.entities.currency).toBe('INR');

    // Merged with draft state
    const updatedDraft = { ...currentDraft, ...result.entities };
    expect(updatedDraft).toEqual({
      product_name: 'wooden toys',
      material: ['Wood'],
      price: 350,
      currency: 'INR',
    });
  });

  it('TEST 4: Natural correction - updates existing draft value and marks isCorrection', async () => {
    const currentDraft = {
      product_name: 'Handmade Pot',
      craft_type: 'Clay Craft',
      material: ['Clay'],
      price: 500,
    };

    const utterance = 'Actually, they are made from terracotta.';
    const result = await nlu.process(utterance, { currentDraft });

    expect(result.isCorrection).toBe(true);
    expect(result.intent.name).toBe('CORRECT_INFORMATION');
    expect(result.entities.material).toBeDefined();

    const updatedDraft = { ...currentDraft, ...result.entities };
    expect(updatedDraft.material).toBeDefined();
  });

  it('TEST 5: Anti-hallucination - does not invent price, quantity, or location when not stated', async () => {
    const utterance = 'I make wooden toys.';
    const result = await nlu.process(utterance);

    expect(result.entities.price).toBeUndefined();
    expect(result.entities.quantity).toBeUndefined();
    expect(result.entities['location']).toBeUndefined();
    expect(result.entities['dimensions']).toBeUndefined();
  });

  it('TEST 6: Unknown field - discards hallucinated/unconfigured schema fields', async () => {
    mockLLM.setCannedResponse('custom product', {
      intent: 'CREATE_PRODUCT',
      confidence: 0.9,
      entities: {
        product_name: 'Custom Toy',
        randomMadeUpField: 'abc-xyz',
        hallucinatedLocation: 'Secret Forest',
      },
    });

    const result = await nlu.process('I make a custom product');
    expect(result.entities.product_name).toBe('Custom Toy');
    expect(result.entities['randomMadeUpField']).toBeUndefined();
    expect(result.entities['hallucinatedLocation']).toBeUndefined();
  });

  it('TEST 7: Known ontology synonym - normalizes synonym to canonical ontology concept', async () => {
    const utterance = 'I craft hand-carved boxes made from timber';
    const result = await nlu.process(utterance);

    expect(result.entities.material).toContain('Wood');
  });

  it('TEST 8: LLM unavailable - falls back to deterministic extraction gracefully without crashing', async () => {
    const failingLLM: typeof mockLLM = {
      name: 'failing-llm',
      generateStructured: async () => {
        throw new Error('503 Service Unavailable: Gemini rate limit exceeded');
      },
      generateText: async () => {
        throw new Error('503 Service Unavailable');
      },
      isHealthy: async () => false,
    } as any;

    const fallbackNLU = new NLUEngine({ llmProvider: failingLLM });
    const utterance = 'కొండపల్లి బొమ్మ 800 రూపాయలు';

    const result = await fallbackNLU.process(utterance);
    expect(result).toBeDefined();
    expect(result.intent.name).toBe('CREATE_PRODUCT');
    expect(result.entities.price).toBe(800);
    expect(result.entities.currency).toBe('INR');
    expect(result.entities.craft_type).toBe('Kondapalli Craft');
  });

  it('should reject empty input with ValidationError', async () => {
    await expect(nlu.process('')).rejects.toThrow(ValidationError);
    await expect(nlu.process('   ')).rejects.toThrow(ValidationError);
  });
});
