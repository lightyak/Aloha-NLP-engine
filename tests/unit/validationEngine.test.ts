import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../../src/core/validation/validationEngine.js';
import type { FieldDefinition } from '../../src/schemas/types.js';

describe('ValidationEngine', () => {
  it('should validate required rule', () => {
    const field: FieldDefinition = {
      name: 'craft_type',
      type: 'string',
      required: true,
    };

    const err1 = ValidationEngine.validateFieldValue(field, '', {});
    expect(err1.length).toBeGreaterThan(0);
    expect(err1[0].rule).toBe('required');

    const err2 = ValidationEngine.validateFieldValue(field, 'Kondapalli', {});
    expect(err2.length).toBe(0);
  });

  it('should validate type rule', () => {
    const field: FieldDefinition = {
      name: 'price',
      type: 'number',
    };

    const err = ValidationEngine.validateFieldValue(field, 'invalid_number', {});
    expect(err.length).toBe(1);
    expect(err[0].rule).toBe('type');

    const ok = ValidationEngine.validateFieldValue(field, 800, {});
    expect(ok.length).toBe(0);
  });

  it('should validate min and max rules for numbers', () => {
    const field: FieldDefinition = {
      name: 'price',
      type: 'number',
      rules: [
        { type: 'min', value: 100 },
        { type: 'max', value: 10000 },
      ],
    };

    const tooLow = ValidationEngine.validateFieldValue(field, 50, {});
    expect(tooLow.some((e) => e.rule === 'min')).toBe(true);

    const tooHigh = ValidationEngine.validateFieldValue(field, 20000, {});
    expect(tooHigh.some((e) => e.rule === 'max')).toBe(true);

    const valid = ValidationEngine.validateFieldValue(field, 500, {});
    expect(valid.length).toBe(0);
  });

  it('should validate range rule', () => {
    const field: FieldDefinition = {
      name: 'rating',
      type: 'number',
      rules: [{ type: 'range', min: 1, max: 5 }],
    };

    expect(ValidationEngine.validateFieldValue(field, 0, {}).length).toBe(1);
    expect(ValidationEngine.validateFieldValue(field, 6, {}).length).toBe(1);
    expect(ValidationEngine.validateFieldValue(field, 4, {}).length).toBe(0);
  });

  it('should validate regex rule', () => {
    const field: FieldDefinition = {
      name: 'sku',
      type: 'string',
      rules: [{ type: 'regex', pattern: '^ART-[0-9]{4}$' }],
    };

    expect(ValidationEngine.validateFieldValue(field, 'ABC', {}).length).toBe(1);
    expect(ValidationEngine.validateFieldValue(field, 'ART-1234', {}).length).toBe(0);
  });

  it('should validate enum rule', () => {
    const field: FieldDefinition = {
      name: 'currency',
      type: 'string',
      rules: [{ type: 'enum', allowedValues: ['INR', 'USD', 'EUR'] }],
    };

    expect(ValidationEngine.validateFieldValue(field, 'GBP', {}).length).toBe(1);
    expect(ValidationEngine.validateFieldValue(field, 'INR', {}).length).toBe(0);
  });

  it('should validate dependency rule', () => {
    const field: FieldDefinition = {
      name: 'custom_text',
      type: 'string',
      rules: [{ type: 'dependency', dependsOnField: 'is_customizable', conditionValue: true }],
    };

    // When is_customizable is false/absent, custom_text is optional
    expect(ValidationEngine.validateFieldValue(field, undefined, { is_customizable: false }).length).toBe(0);

    // When is_customizable is true, custom_text becomes required
    const triggered = ValidationEngine.validateFieldValue(field, undefined, { is_customizable: true });
    expect(triggered.length).toBe(1);
    expect(triggered[0].rule).toBe('dependency');

    // When provided
    expect(ValidationEngine.validateFieldValue(field, 'Name Engraving', { is_customizable: true }).length).toBe(0);
  });
});
