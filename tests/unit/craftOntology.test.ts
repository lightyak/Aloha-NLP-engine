import { describe, it, expect, beforeEach } from 'vitest';
import { OntologyRegistry } from '../../src/ontology/ontologyRegistry.js';

describe('OntologyRegistry', () => {
  let registry: OntologyRegistry;

  beforeEach(() => {
    registry = new OntologyRegistry();
  });

  it('should find craft by canonical name and aliases', () => {
    const craft = registry.findCraft('kondapalli toys');
    expect(craft).not.toBeNull();
    expect(craft?.id).toBe('kondapalli_toys');
    expect(craft?.region.state).toBe('Andhra Pradesh');
  });

  it('should find craft by local language name (Telugu)', () => {
    const craft = registry.findCraft('కొండపల్లి బొమ్మలు');
    expect(craft).not.toBeNull();
    expect(craft?.id).toBe('kondapalli_toys');
  });

  it('should find category by alias', () => {
    const cat = registry.findCategory('bommalu');
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe('toys_and_dolls');
  });

  it('should map multilingual raw materials to canonical names', () => {
    expect(registry.findMaterial('చెక్క')).toBe('Wood'); // Telugu
    expect(registry.findMaterial('लकड़ी')).toBe('Wood'); // Hindi
    expect(registry.findMaterial('pattu')).toBe('Silk');  // Telugu alias
    expect(registry.findMaterial('cotton')).toBe('Cotton');
  });

  it('should allow runtime dynamic registration of new crafts', () => {
    registry.registerCraft({
      id: 'warli_painting',
      name: 'Warli Painting',
      category: 'folk_art',
      region: { state: 'Maharashtra', giCertified: true },
      aliases: ['warli', 'warli art'],
      localNames: { mr: 'वारली चित्रकला' },
      typicalMaterials: ['Mud wall', 'Rice paste'],
      techniques: ['Geometric stick figures'],
    });

    const found = registry.findCraft('वारली चित्रकला');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Warli Painting');
    expect(found?.region.state).toBe('Maharashtra');
  });
});
