import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Products and Audio Integration Endpoints', () => {
  describe('POST /api/v1/products/validate', () => {
    it('validates craft attributes', async () => {
      const res = await request(app)
        .post('/api/v1/products/validate')
        .send({
          attributes: {
            product_name: 'Kondapalli Bomma',
            craft_type: 'kondapalli_toys',
            category: 'toys_and_dolls',
            material: ['tella poniki wood'],
            price: 450,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.normalized).toBeDefined();
    });

    it('rejects validation when attributes is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/products/validate')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/products/catalog', () => {
    it('generates catalog directly from attributes', async () => {
      const res = await request(app)
        .post('/api/v1/products/catalog')
        .send({
          attributes: {
            craft_type: 'kondapalli_toys',
            material: 'tella poniki wood',
            price: 450,
          },
          language: 'te',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.catalog.title).toBeDefined();
    });
  });

  describe('Full Session to Catalog Publication Lifecycle', () => {
    it('creates session, feeds benchmark Telugu artisan message, and publishes product', async () => {
      // 1. Create Session
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .send({ language: 'te' });

      expect(sessionRes.status).toBe(201);
      const sessionId = sessionRes.body.data.session.id;

      // 2. Send benchmark Telugu message
      const teluguMessage = 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి.';
      const msgRes = await request(app)
        .post(`/api/v1/sessions/${sessionId}/message`)
        .send({ text: teluguMessage, language: 'te' });

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.nlu.extractedEntities.craft_type).toBe('Kondapalli Craft');

      // 3. Publish product from session
      const publishRes = await request(app)
        .post('/api/v1/products/publish')
        .send({ sessionId });

      expect(publishRes.status).toBe(201);
      expect(publishRes.body.success).toBe(true);
      expect(publishRes.body.data.product).toBeDefined();
      expect(publishRes.body.data.product.catalog).toBeDefined();
      expect(publishRes.body.data.product.attributes.craft_type).toBe('Kondapalli Craft');
    });

    it('processes audio upload via POST /api/v1/sessions/:id/audio', async () => {
      // Create session
      const sessionRes = await request(app)
        .post('/api/v1/sessions')
        .send({ language: 'te' });
      const sessionId = sessionRes.body.data.session.id;

      // Send audio mock
      const audioBuffer = Buffer.from('mock audio test');
      const audioRes = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .attach('audio', audioBuffer, {
          filename: 'artisan_voice.wav',
          contentType: 'audio/wav',
        });

      expect(audioRes.status).toBe(200);
      expect(audioRes.body.success).toBe(true);
      expect(audioRes.body.data.transcription).toBeDefined();
      expect(audioRes.body.data.session).toBeDefined();
    });
  });
});
