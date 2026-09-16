import { describe, it, expect } from 'vitest';
import { DynamicPromptBuilder } from '../../src/core/nlu/dynamicPromptBuilder.js';
import { defaultSchemaRegistry } from '../../src/schemas/dynamicSchema.js';
import { defaultIntentRegistry } from '../../src/core/nlu/intentRegistry.js';
import { defaultOntologyRegistry } from '../../src/ontology/ontologyRegistry.js';

describe('DynamicPromptBuilder', () => {
  it('should build prompt reflecting schema attributes and intents dynamically', () => {
    const prompt = DynamicPromptBuilder.buildNLUSystemPrompt(
      defaultSchemaRegistry,
      defaultIntentRegistry,
      defaultOntologyRegistry
    );

    expect(prompt).toContain('product_name');
    expect(prompt).toContain('price');
    expect(prompt).toContain('craft_type');
    expect(prompt).toContain('CREATE_PRODUCT');
    expect(prompt).toContain('Kondapalli Craft');
    expect(prompt).toContain('OUTPUT JSON FORMAT');
  });
});
