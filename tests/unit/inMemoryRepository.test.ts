import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionRepository } from '../../src/repositories/in-memory/inMemorySession.repository.js';
import { InMemoryProductRepository } from '../../src/repositories/in-memory/inMemoryProduct.repository.js';

describe('InMemorySessionRepository', () => {
  let sessionRepo: InMemorySessionRepository;

  beforeEach(() => {
    sessionRepo = new InMemorySessionRepository();
  });

  it('should create and retrieve a session', async () => {
    const session = await sessionRepo.create({
      artisanId: 'artisan-101',
      language: 'te',
      initialIntent: 'CREATE_PRODUCT',
    });

    expect(session.id).toBeDefined();
    expect(session.artisanId).toBe('artisan-101');
    expect(session.language).toBe('te');
    expect(session.currentIntent).toBe('CREATE_PRODUCT');
    expect(session.status).toBe('active');
    expect(session.history).toEqual([]);

    const fetched = await sessionRepo.findById(session.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(session.id);
  });

  it('should update session draft and missing fields', async () => {
    const session = await sessionRepo.create({});
    const updated = await sessionRepo.update(session.id, {
      productDraft: { craft_type: 'Kondapalli Craft', price: 800 },
      missingFields: ['material'],
    });

    expect(updated.productDraft).toEqual({ craft_type: 'Kondapalli Craft', price: 800 });
    expect(updated.missingFields).toEqual(['material']);
  });

  it('should append conversation messages', async () => {
    const session = await sessionRepo.create({});
    const withMsg = await sessionRepo.appendMessage(session.id, {
      role: 'user',
      content: 'ఇది కొండపల్లి బొమ్మ',
    });

    expect(withMsg.history.length).toBe(1);
    expect(withMsg.history[0].role).toBe('user');
    expect(withMsg.history[0].content).toBe('ఇది కొండపల్లి బొమ్మ');
  });

  it('should delete a session', async () => {
    const session = await sessionRepo.create({});
    const deleted = await sessionRepo.delete(session.id);
    expect(deleted).toBe(true);

    const fetched = await sessionRepo.findById(session.id);
    expect(fetched).toBeNull();
  });
});

describe('InMemoryProductRepository', () => {
  let productRepo: InMemoryProductRepository;

  beforeEach(() => {
    productRepo = new InMemoryProductRepository();
  });

  it('should create and retrieve a product', async () => {
    const product = await productRepo.create({
      craftType: 'Woodcraft',
      category: 'Toys',
      attributes: { price: 800, material: 'Wood' },
    });

    expect(product.id).toBeDefined();
    expect(product.craftType).toBe('Woodcraft');
    expect(product.status).toBe('draft');

    const fetched = await productRepo.findById(product.id);
    expect(fetched?.attributes).toEqual({ price: 800, material: 'Wood' });
  });

  it('should update product status and catalog details', async () => {
    const product = await productRepo.create({
      craftType: 'Handloom',
      attributes: { material: 'Silk' },
    });

    const updated = await productRepo.update(product.id, {
      status: 'validated',
      catalog: {
        title: 'Pure Silk Saree',
        shortDescription: 'Handwoven silk saree',
        tags: ['silk', 'handloom'],
        searchKeywords: ['saree', 'silk', 'handwoven'],
      },
    });

    expect(updated.status).toBe('validated');
    expect(updated.catalog?.title).toBe('Pure Silk Saree');
  });

  it('should list and filter products', async () => {
    await productRepo.create({ artisanId: 'a1', attributes: {}, status: 'draft' });
    await productRepo.create({ artisanId: 'a2', attributes: {}, status: 'published' });

    const published = await productRepo.list({ status: 'published' });
    expect(published.length).toBe(1);
    expect(published[0].artisanId).toBe('a2');
  });
});
