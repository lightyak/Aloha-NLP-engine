import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { defaultNLUEngine } from '../../src/core/nlu/nluEngine.js';
import { MockLLMProvider } from '../../src/providers/llm/mockLLMProvider.js';

describe('Hardened NLU: Anti-Hallucination & Provenance', () => {
  it('discards ungrounded or unconfigured attributes hallucinated by LLM', async () => {
    const mockLLM = new MockLLMProvider();
    // Simulate LLM trying to hallucinate unconfigured fields
    mockLLM.setCannedResponse('kondapalli', {
      intent: 'CREATE_PRODUCT',
      confidence: 0.9,
      entities: {
        craft_type: 'kondapalli_toys',
        price: 800,
        // Hallucinated attributes:
        awards_won: 'National Handicraft Award 2021',
        artisan_experience_years: 25,
        gi_tag_number: 'GI-AP-1234',
        location_coordinates: '16.6167 N, 80.5333 E',
        phone_number: '+91 9876543210',
      },
    });

    defaultNLUEngine.setLLMProvider(mockLLM);

    const res = await defaultNLUEngine.process('ఇది కొండపల్లి బొమ్మ. 800 రూపాయలు.');

    // Valid configured schema fields are kept
    expect(res.entities.craft_type).toBeDefined();
    expect(res.entities.price).toBe(800);

    // Hallucinated/unconfigured fields are strictly discarded
    expect((res.entities as Record<string, unknown>)['awards_won']).toBeUndefined();
    expect((res.entities as Record<string, unknown>)['artisan_experience_years']).toBeUndefined();
    expect((res.entities as Record<string, unknown>)['gi_tag_number']).toBeUndefined();
    expect((res.entities as Record<string, unknown>)['location_coordinates']).toBeUndefined();
    expect((res.entities as Record<string, unknown>)['phone_number']).toBeUndefined();
  });

  it('preserves provenance evidence for deterministic and ontology matches', async () => {
    const res = await defaultNLUEngine.process('ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. ధర 800 రూపాయలు.');

    expect(res.entityDetails.length).toBeGreaterThan(0);
    const craftDetail = res.entityDetails.find((e) => e.field === 'craft_type');
    expect(craftDetail).toBeDefined();
    expect(craftDetail?.source).toBe('ONTOLOGY_MATCH');
    expect(craftDetail?.confidence).toBeGreaterThanOrEqual(0.9);

    const priceDetail = res.entityDetails.find((e) => e.field === 'price');
    expect(priceDetail).toBeDefined();
    expect(priceDetail?.source).toBe('DETERMINISTIC_EXTRACTION');
  });

  it('explicit user evidence overrides contradictory weaker LLM inference', async () => {
    const mockLLM = new MockLLMProvider();
    // LLM thinks price is 1200, but user said 800
    mockLLM.setCannedResponse('kondapalli', {
      intent: 'CREATE_PRODUCT',
      confidence: 0.8,
      entities: {
        price: 1200,
      },
    });

    defaultNLUEngine.setLLMProvider(mockLLM);

    const res = await defaultNLUEngine.process('ఇది కొండపల్లి బొమ్మ. ధర 800 రూపాయలు.');
    // Explicit user deterministic extraction wins
    expect(res.entities.price).toBe(800);
  });
});

describe('User and Session Data Isolation', () => {
  it('prevents User B from accessing or modifying User A session and products', async () => {
    // 1. User A creates a session
    const sessionResA = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer user-a')
      .send({ language: 'te' });

    expect(sessionResA.status).toBe(201);
    const sessionIdA = sessionResA.body.data.session.id;
    expect(sessionResA.body.data.session.artisanId).toBe('user-a');

    // 2. User A sends message
    await request(app)
      .post(`/api/v1/sessions/${sessionIdA}/message`)
      .set('Authorization', 'Bearer user-a')
      .send({ text: 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. 800 రూపాయలు కావాలి.' });

    // 3. User B attempts to access User A's session -> MUST BE 403 FORBIDDEN
    const getResB = await request(app)
      .get(`/api/v1/sessions/${sessionIdA}`)
      .set('Authorization', 'Bearer user-b');

    expect(getResB.status).toBe(403);
    expect(getResB.body.success).toBe(false);

    // 4. User B attempts to send message to User A's session -> MUST BE 403 FORBIDDEN
    const msgResB = await request(app)
      .post(`/api/v1/sessions/${sessionIdA}/message`)
      .set('Authorization', 'Bearer user-b')
      .send({ text: 'Malicious modification' });

    expect(msgResB.status).toBe(403);

    // 5. User B attempts to publish User A's session as product -> MUST BE 403 FORBIDDEN
    const publishResB = await request(app)
      .post('/api/v1/products/publish')
      .set('Authorization', 'Bearer user-b')
      .send({ sessionId: sessionIdA });

    expect(publishResB.status).toBe(403);

    // 6. User A CAN successfully access and publish their own session
    const publishResA = await request(app)
      .post('/api/v1/products/publish')
      .set('Authorization', 'Bearer user-a')
      .send({ sessionId: sessionIdA });

    expect(publishResA.status).toBe(201);
    expect(publishResA.body.data.product.artisanId).toBe('user-a');
  });
});
