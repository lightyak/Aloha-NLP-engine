import { describe, it, expect } from 'vitest';
import { NormalizationEngine } from '../../src/core/normalization/normalizationEngine.js';

describe('NormalizationEngine', () => {
  describe('parseCurrency', () => {
    it('should parse currency expressions with rupees / rs / ₹', () => {
      expect(NormalizationEngine.parseCurrency('800 rupees')).toEqual({
        amount: 800,
        currency: 'INR',
      });
      expect(NormalizationEngine.parseCurrency('₹1500')).toEqual({
        amount: 1500,
        currency: 'INR',
      });
      expect(NormalizationEngine.parseCurrency('Rs. 2,500')).toEqual({
        amount: 2500,
        currency: 'INR',
      });
      expect(NormalizationEngine.parseCurrency('800 roopayalu')).toEqual({
        amount: 800,
        currency: 'INR',
      });
    });

    it('should parse foreign currencies', () => {
      expect(NormalizationEngine.parseCurrency('$50')).toEqual({
        amount: 50,
        currency: 'USD',
      });
      expect(NormalizationEngine.parseCurrency('45 euro')).toEqual({
        amount: 45,
        currency: 'EUR',
      });
    });
  });

  describe('normalizeTimeUnit', () => {
    it('should normalize multilingual time units', () => {
      // Telugu "rojulu" -> "days"
      expect(NormalizationEngine.normalizeTimeUnit('3 rojulu')).toBe('3 days');
      expect(NormalizationEngine.normalizeTimeUnit('1 roju')).toBe('1 day');

      // Hindi "din" -> "day"
      expect(NormalizationEngine.normalizeTimeUnit('5 din')).toBe('5 days');

      // English
      expect(NormalizationEngine.normalizeTimeUnit('2 weeks')).toBe('2 weeks');
      expect(NormalizationEngine.normalizeTimeUnit('1 week')).toBe('1 week');
    });
  });

  describe('normalizeFieldValue', () => {
    it('should normalize string trimming and aliases', () => {
      const field = {
        name: 'category',
        type: 'string' as const,
        normalization: {
          trim: true,
          lowercase: true,
          aliases: {
            'bommala': 'toys',
            'bommalu': 'toys',
          },
        },
      };

      expect(NormalizationEngine.normalizeFieldValue(field, '  BOMMALU  ')).toBe('toys');
    });

    it('should normalize array items', () => {
      const field = {
        name: 'material',
        type: 'array' as const,
        normalization: {
          trim: true,
          lowercase: true,
          aliases: {
            chekka: 'wood',
          },
        },
      };

      const result = NormalizationEngine.normalizeFieldValue(field, [' Chekka ', ' Natural Dyes ']);
      expect(result).toEqual(['wood', 'natural dyes']);
    });
  });
});
