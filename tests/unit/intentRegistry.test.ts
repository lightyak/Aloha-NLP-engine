import { describe, it, expect, beforeEach } from 'vitest';
import { IntentRegistry } from '../../src/core/nlu/intentRegistry.js';

describe('IntentRegistry', () => {
  let registry: IntentRegistry;

  beforeEach(() => {
    registry = new IntentRegistry();
  });

  it('should load default intents', () => {
    const intents = registry.getIntents();
    expect(intents.length).toBeGreaterThanOrEqual(8);

    expect(registry.getIntent('CREATE_PRODUCT')).toBeDefined();
    expect(registry.getIntent('CORRECT_INFORMATION')).toBeDefined();
    expect(registry.getIntent('SET_PRICE')).toBeDefined();
    expect(registry.getIntent('CONFIRM')).toBeDefined();
  });

  it('should allow runtime dynamic registration of new intents', () => {
    registry.registerIntent({
      name: 'REQUEST_DISCOUNT',
      description: 'Customer or artisan asks for wholesale discount negotiation',
      examples: ['Can I get a discount for bulk order?'],
      defaultConfidence: 0.80,
    });

    const registered = registry.getIntent('REQUEST_DISCOUNT');
    expect(registered).toBeDefined();
    expect(registered?.description).toContain('discount');
  });

  it('should generate dynamic prompt description without hard-coding', () => {
    const promptDesc = registry.toPromptDescription();
    expect(promptDesc).toContain('CREATE_PRODUCT');
    expect(promptDesc).toContain('CORRECT_INFORMATION');
  });
});
