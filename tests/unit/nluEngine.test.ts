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

  it('TEST 9: Etikoppaka Telugu Regression Case - extracts craft context, materials, price without hallucinating product_name or production_time', async () => {
    const utterance = 'ఆంధ్రప్రదేశ్ అనాకాపల్లి జిల్లాలోని ఏటికొప్పాక గ్రామానికి చెందిన ఈ సాంప్రదాయ బొమ్మను సహజమైన అంకుడు చెక్క మరియు లక్క రంగులతో తయారు చేశారు. దీని ధర రూ. 600/-.';
    const result = await nlu.process(utterance);

    expect(result.intent.name).toBe('CREATE_PRODUCT');
    expect(result.detectedLanguage).toBe('te');
    expect(result.entities.craft_type).toBe('Etikoppaka Craft');
    expect(result.entities.category).toBe('toys_and_dolls');
    expect(result.entities.material).toContain('Wood');
    expect(result.entities.material).toContain('Lacquer');
    expect(result.entities.price).toBe(600);
    expect(result.entities.currency).toBe('INR');

    // Missing fields: product_name and production_time must NOT be hallucinated
    expect(result.entities.product_name).toBeUndefined();
    expect(result.entities.production_time).toBeUndefined();
    expect(result.missingFields).toContain('product_name');
    expect(result.followUpQuestion).toBe('ఈ సాంప్రదాయ బొమ్మ పేరు ఏమిటి?');

    // Provenance & evidence: price is always grounded via deterministic regex from raw utterance
    const priceDetail = result.entityDetails.find((e) => e.field === 'price');
    expect(priceDetail?.source).toBe('DETERMINISTIC_EXTRACTION');
    expect(priceDetail?.confirmed).toBe(true);
  });

  it('TEST 10: Telugu + English code-switching - extracts mixed language utterance and asks follow-up in Telugu', async () => {
    const utterance = 'Nenu wooden toys chestanu, price is 500 rupees';
    const result = await nlu.process(utterance);

    expect(result.entities.product_name).toBe('wooden toys');
    expect(result.entities.material).toContain('Wood');
    expect(result.entities.price).toBe(500);
    expect(result.missingFields).toContain('craft_type');
    expect(result.followUpQuestion).toBeDefined();
  });

  it('TEST 11: Hindi + English code-switching - extracts mixed Hindi-English utterance', async () => {
    const utterance = 'Main handmade wooden toys banata hoon, rate is 600 rupees';
    const result = await nlu.process(utterance);

    expect(result.entities.product_name).toBe('handmade wooden toys');
    expect(result.entities.material).toContain('Wood');
    expect(result.entities.price).toBe(600);
    expect(result.missingFields).toContain('craft_type');
  });

  it('TEST 12: Tamil + English code-switching - extracts mixed Tamil-English utterance', async () => {
    const utterance = 'Naan wooden toys seigiren, price 400 rupees';
    const result = await nlu.process(utterance);

    expect(result.entities.product_name).toBe('wooden toys');
    expect(result.entities.price).toBe(400);
  });

  it('TEST 13: Kannada + English code-switching - extracts mixed Kannada-English utterance', async () => {
    const utterance = 'Naanu wooden toys maduttene, price 450 rupees';
    const result = await nlu.process(utterance);

    expect(result.entities.product_name).toBe('wooden toys');
    expect(result.entities.price).toBe(450);
  });

  it('TEST 14: Uncertainty / "I don\'t know" - leaves field unresolved and offers estimation', async () => {
    const utterance = "I don't know how many days it takes";
    const result = await nlu.process(utterance);

    expect(result.isDontKnow).toBe(true);
    expect(result.estimationOffered).toBe(true);
    expect(result.entities.production_time).toBeUndefined();
    expect(result.followUpQuestion).toContain('estimate');
  });

  it('TEST 15: Telugu "తెలియదు" uncertainty - generates estimation offer in Telugu', async () => {
    const utterance = 'నాకు సమయం ఎంత పడుతుందో తెలియదు';
    const result = await nlu.process(utterance);

    expect(result.isDontKnow).toBe(true);
    expect(result.estimationOffered).toBe(true);
    expect(result.followUpQuestion).toContain('అంచనా');
  });

  it('TEST 16: Explicit estimation permission - assigns SYSTEM_ESTIMATE provenance with confirmed: false', async () => {
    const utterance = 'Yes, estimate it';
    const result = await nlu.process(utterance, { allowEstimates: true });

    expect(result.entities.production_time).toBe('3 days');
    const timeDetail = result.entityDetails.find((e) => e.field === 'production_time');
    expect(timeDetail?.source).toBe('SYSTEM_ESTIMATE');
    expect(timeDetail?.confirmed).toBe(false);
  });

  it('TEST 17: Invalid LLM schema output - catches validation error and logs deterministic validation status', async () => {
    mockLLM.setCannedResponse('bad output', {
      intent: 'CREATE_PRODUCT',
      confidence: 1.5, // Invalid confidence > 1.0
      entities: 'invalid-not-an-object',
    });

    const result = await nlu.process('This will cause bad output');
    expect(result).toBeDefined();
    expect(result.pipelineStatus).toBe('DETERMINISTIC_VALIDATION_FAILED');
  });

  it('should reject empty input with ValidationError', async () => {
    await expect(nlu.process('')).rejects.toThrow(ValidationError);
    await expect(nlu.process('   ')).rejects.toThrow(ValidationError);
  });
});
