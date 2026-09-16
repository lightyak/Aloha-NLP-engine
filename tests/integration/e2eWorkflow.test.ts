import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Realistic SIH 26090 Complete End-to-End Workflow', () => {
  it('runs complete multilingual voice & text flow with questions, corrections, and publishes with isolated users', async () => {
    // ==========================================
    // 1. ARTISAN 1 (User A) creates session
    // ==========================================
    const sessionResA = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer artisan-a')
      .send({ language: 'te' });

    expect(sessionResA.status).toBe(201);
    const sessionIdA = sessionResA.body.data.session.id;
    expect(sessionResA.body.data.session.artisanId).toBe('artisan-a');

    // ==========================================
    // 2. ARTISAN 1 sends first voice audio (STT + NLU)
    // ==========================================
    const mockAudioBuffer = Buffer.from('artisan voice wave audio buffer bytes');
    const audioResA = await request(app)
      .post(`/api/v1/sessions/${sessionIdA}/audio`)
      .set('Authorization', 'Bearer artisan-a')
      .attach('audio', mockAudioBuffer, {
        filename: 'artisan_recording.wav',
        contentType: 'audio/wav',
      });

    expect(audioResA.status).toBe(200);
    expect(audioResA.body.success).toBe(true);
    expect(audioResA.body.data.transcription.text).toBeDefined();

    // ==========================================
    // 3. ARTISAN 1 sends detailed Telugu utterance
    // ==========================================
    const teluguUtterance = 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి.';
    const msgResA1 = await request(app)
      .post(`/api/v1/sessions/${sessionIdA}/message`)
      .set('Authorization', 'Bearer artisan-a')
      .send({ text: teluguUtterance, languageHint: 'te' });

    expect(msgResA1.status).toBe(200);
    const draftA1 = msgResA1.body.data.session.productDraft;
    expect(draftA1.craft_type).toBe('Kondapalli Craft');
    expect(draftA1.price).toBe(800);

    // ==========================================
    // 4. ARTISAN 1 makes a natural correction: "Actually, the price is 900"
    // ==========================================
    const correctionUtterance = 'Actually the price is 900';
    const msgResA2 = await request(app)
      .post(`/api/v1/sessions/${sessionIdA}/message`)
      .set('Authorization', 'Bearer artisan-a')
      .send({ text: correctionUtterance });

    expect(msgResA2.status).toBe(200);
    const draftA2 = msgResA2.body.data.session.productDraft;
    expect(draftA2.price).toBe(900); // Successfully updated to 900

    // Provide product_name to satisfy default schema required fields
    await request(app)
      .post(`/api/v1/sessions/${sessionIdA}/message`)
      .set('Authorization', 'Bearer artisan-a')
      .send({ text: 'The product name is Kondapalli Dancing Doll' });

    // ==========================================
    // 5. ARTISAN 2 (User B) attempts to snoop or publish ARTISAN 1's session
    // ==========================================
    const snoopGet = await request(app)
      .get(`/api/v1/sessions/${sessionIdA}`)
      .set('Authorization', 'Bearer artisan-b');
    expect(snoopGet.status).toBe(403);

    const snoopPublish = await request(app)
      .post('/api/v1/products/publish')
      .set('Authorization', 'Bearer artisan-b')
      .send({ sessionId: sessionIdA });
    expect(snoopPublish.status).toBe(403);

    // ==========================================
    // 6. ARTISAN 1 publishes product successfully
    // ==========================================
    const publishResA = await request(app)
      .post('/api/v1/products/publish')
      .set('Authorization', 'Bearer artisan-a')
      .send({ sessionId: sessionIdA });

    expect(publishResA.status).toBe(201);
    expect(publishResA.body.success).toBe(true);
    const publishedProduct = publishResA.body.data.product;
    expect(publishedProduct.attributes.price).toBe(900);
    expect(publishedProduct.catalog.title).toBeDefined();
    expect(publishedProduct.artisanId).toBe('artisan-a');

    // ==========================================
    // 7. ARTISAN 2 (User B) creates their own session completely isolated
    // ==========================================
    const sessionResB = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', 'Bearer artisan-b')
      .send({ language: 'hi' });

    expect(sessionResB.status).toBe(201);
    const sessionIdB = sessionResB.body.data.session.id;
    expect(sessionIdB).not.toBe(sessionIdA);
    expect(sessionResB.body.data.session.artisanId).toBe('artisan-b');
  });
});
