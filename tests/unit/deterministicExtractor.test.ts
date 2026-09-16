import { describe, it, expect } from 'vitest';
import { DeterministicExtractor } from '../../src/core/nlu/deterministicExtractor.js';
import { defaultOntologyRegistry } from '../../src/ontology/ontologyRegistry.js';

describe('DeterministicExtractor', () => {
  it('should extract craft and category from multilingual text', () => {
    const res = DeterministicExtractor.extract(
      'ఇది కొండపల్లి బొమ్మ',
      defaultOntologyRegistry
    );

    expect(res.entities.craft_type).toBe('Kondapalli Craft');
    expect(res.entities.category).toBe('toys_and_dolls');
    expect(res.detectedLanguage).toBe('te');
  });

  it('should extract material and price deterministically', () => {
    const res = DeterministicExtractor.extract(
      'It is made of wood and costs ₹1200',
      defaultOntologyRegistry
    );

    expect(res.entities.material).toContain('Wood');
    expect(res.entities.price).toBe(1200);
    expect(res.entities.currency).toBe('INR');
  });

  it('should detect natural correction cues', () => {
    const res1 = DeterministicExtractor.extract(
      'Actually, the price is 900',
      defaultOntologyRegistry
    );
    expect(res1.isCorrectionCandidate).toBe(true);

    const res2 = DeterministicExtractor.extract(
      'కాదు, ధర 850 రూపాయలు',
      defaultOntologyRegistry
    );
    expect(res2.isCorrectionCandidate).toBe(true);
    expect(res2.entities.price).toBe(850);
  });
});
