import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicSchemaRegistry } from '../../src/schemas/dynamicSchema.js';

describe('DynamicSchemaRegistry', () => {
  let registry: DynamicSchemaRegistry;

  beforeEach(() => {
    registry = new DynamicSchemaRegistry();
  });

  it('should load default schema and identify missing fields in an empty draft', () => {
    const missing = registry.getMissingFields({});
    expect(missing).toContain('product_name');
    expect(missing).toContain('craft_type');
    expect(missing).toContain('category');
    expect(missing).toContain('material');
    expect(missing).toContain('price');
  });

  it('should identify remaining missing fields as product draft is populated', () => {
    const draft = {
      product_name: 'Kondapalli Raja Rani Toy',
      craft_type: 'Kondapalli Craft',
      category: 'toys_and_dolls',
    };

    const missing = registry.getMissingFields(draft);
    expect(missing).not.toContain('product_name');
    expect(missing).not.toContain('craft_type');
    expect(missing).toContain('material');
    expect(missing).toContain('price');
  });

  it('should validate a complete valid product draft', () => {
    const draft = {
      product_name: 'Kondapalli Dancing Doll',
      craft_type: 'Kondapalli Craft',
      category: 'toys_and_dolls',
      material: ['Wood', 'Natural Dyes'],
      price: 800,
      currency: 'INR',
      production_time: '3 days',
    };

    const result = registry.validateDraft(draft);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should normalize product draft fields', () => {
    const draft = {
      product_name: '  Kondapalli Toy  ',
      craft_type: 'Kondapalli Craft',
      category: '  TOYS_AND_DOLLS  ',
      material: ['  Wood  '],
      price: '800 rupees',
      production_time: '3 rojulu',
    };

    const normalized = registry.normalizeDraft(draft);
    expect(normalized.product_name).toBe('Kondapalli Toy');
    expect(normalized.category).toBe('toys_and_dolls');
    expect(normalized.price).toBe(800);
    expect(normalized.production_time).toBe('3 days');
  });

  /**
   * Section 32 Compliance: Proving that adding a field through configuration works
   * WITHOUT changing the NLU or engine core code.
   */
  it('CRITICAL TEST: dynamically adding a new field through configuration works without modifying engine core', () => {
    // Before adding 'artisan_experience_years', draft without it is valid
    const baseDraft = {
      product_name: 'Handcrafted Wooden Elephant',
      craft_type: 'Woodcraft',
      category: 'toys',
      material: ['Wood'],
      price: 1200,
    };

    expect(registry.getMissingFields(baseDraft)).not.toContain('artisan_experience_years');

    // Register a new dynamic field at runtime (as if loaded from DB or JSON config)
    registry.registerField({
      name: 'artisan_experience_years',
      type: 'number',
      required: true,
      description: 'Years of artisan experience producing this craft',
      rules: [
        { type: 'required', message: 'Artisan experience is required.' },
        { type: 'type', expectedType: 'number' },
        { type: 'min', value: 1, message: 'Experience must be at least 1 year.' },
      ],
    });

    // Now the dynamic schema recognizes this new attribute immediately
    const missingAfter = registry.getMissingFields(baseDraft);
    expect(missingAfter).toContain('artisan_experience_years');

    // Validation fails when new required field is absent
    const invalidResult = registry.validateDraft(baseDraft);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.some((e) => e.field === 'artisan_experience_years')).toBe(true);

    // Validation passes once field is provided and satisfies dynamic rules
    const completeDraft = {
      ...baseDraft,
      artisan_experience_years: 15,
    };

    const validResult = registry.validateDraft(completeDraft);
    expect(validResult.isValid).toBe(true);
    expect(registry.getMissingFields(completeDraft)).not.toContain('artisan_experience_years');
  });
});
