import { describe, it, expect } from 'vitest';
import { CatalogGenerator } from '../../src/core/catalog/catalogGenerator.js';
import { MockLLMProvider } from '../../src/providers/llm/mockLLMProvider.js';

describe('CatalogGenerator', () => {
  it('generates catalog using deterministic fallback when LLM fails or is disabled', async () => {
    const mockLLM = new MockLLMProvider();
    // Setting empty title will cause ProviderError, triggering fallbackCatalog
    mockLLM.setCannedResponse('generate catalog content', {
      title: '',
      short_description: '',
      detailed_description: '',
    });

    const generator = new CatalogGenerator(mockLLM);
    const attributes = {
      product_name: 'Dancing Doll',
      craft_type: 'kondapalli_toys',
      category: 'toys_and_dolls',
      material: ['tella poniki wood'],
      dimensions: '15x10x5 cm',
      price: 450,
      currency: 'INR',
      weight_grams: 200,
    };

    const catalog = await generator.generate(attributes, 'te');

    expect(catalog.title).toBe('Dancing Doll - kondapalli_toys');
    expect(catalog.shortDescription).toBeDefined();
    expect(catalog.detailedDescription).toContain('Handcrafted');
    expect(catalog.tags).toContain('kondapalli_toys');
    expect(catalog.searchKeywords.length).toBeGreaterThan(0);
  });

  it('parses structured catalog when LLM returns valid JSON', async () => {
    const mockLLM = new MockLLMProvider();
    const fakeCatalog = {
      title: 'Authentic Kondapalli Dancing Doll (Aata Bomma)',
      short_description: 'Masterfully carved traditional wooden toy from Kondapalli.',
      detailed_description: 'Eco-friendly natural vegetable dyes, hand-carved Tella Poniki wood.',
      tags: ['kondapalli', 'wooden-toy', 'traditional'],
      search_keywords: ['kondapalli bomma', 'dancing doll'],
    };

    // Substring match in lowerPrompt: 'generate catalog content'
    mockLLM.setCannedResponse('generate catalog content', fakeCatalog);

    const generator = new CatalogGenerator(mockLLM);
    const attributes = {
      product_name: 'Dancing Doll',
      craft_type: 'kondapalli_toys',
      material: ['Tella Poniki'],
      price: 450,
    };

    const catalog = await generator.generate(attributes, 'en');

    expect(catalog.title).toBe('Authentic Kondapalli Dancing Doll (Aata Bomma)');
    expect(catalog.shortDescription).toBe('Masterfully carved traditional wooden toy from Kondapalli.');
    expect(catalog.tags).toContain('kondapalli');
    expect(catalog.searchKeywords).toContain('kondapalli bomma');
  });
});
