import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Sessions API', () => {
  it('POST /api/v1/sessions should create a session', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .send({ artisanId: 'artisan-1', language: 'te' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.id).toBeDefined();
    expect(res.body.data.session.status).toBe('active');
  });

  it('POST /api/v1/sessions/:id/message should process Telugu benchmark utterance', async () => {
    const created = await request(app)
      .post('/api/v1/sessions')
      .send({ artisanId: 'artisan-1' });

    const sessionId = created.body.data.session.id;

    const res = await request(app)
      .post(`/api/v1/sessions/${sessionId}/message`)
      .send({ text: 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nlu.intent.name).toBe('CREATE_PRODUCT');
    expect(res.body.data.nlu.extractedEntities.craft_type).toBe('Kondapalli Craft');
    expect(res.body.data.nlu.extractedEntities.price).toBe(800);
    expect(res.body.data.nlu.missingFields).toHaveLength(0);
  });

  it('POST /api/v1/sessions/:id/message should merge corrections into draft', async () => {
    const created = await request(app)
      .post('/api/v1/sessions')
      .send({});
    const sessionId = created.body.data.session.id;

    // First message
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/message`)
      .send({ text: 'ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి.' });

    // Correction
    const corrRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/message`)
      .send({ text: 'Actually, the price is 900' });

    expect(corrRes.status).toBe(200);
    expect(corrRes.body.data.nlu.isCorrection).toBe(true);
    expect(corrRes.body.data.nlu.extractedEntities.price).toBe(900);

    // Verify session draft was updated
    const sessionRes = await request(app).get(`/api/v1/sessions/${sessionId}`);
    expect(sessionRes.body.data.session.productDraft.price).toBe(900);
  });

  it('GET /api/v1/sessions/:id should return 404 for unknown session', async () => {
    const res = await request(app).get('/api/v1/sessions/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/sessions/:id/message updates productDraft when artisan sends new explicit craft information across turns', async () => {
    const created = await request(app).post('/api/v1/sessions').send({ language: 'te' });
    const sessionId = created.body.data.session.id;

    // Turn 1: Etikoppaka craft
    const t1 = await request(app)
      .post(`/api/v1/sessions/${sessionId}/message`)
      .send({ text: 'ఆంధ్రప్రదేశ్ అనాకాపల్లి జిల్లాలోని ఏటికొప్పాక గ్రామానికి చెందిన ఈ సాంప్రదాయ బొమ్మను సహజమైన అంకుడు చెక్క మరియు లక్క రంగులతో తయారు చేశారు. దీని ధర రూ. 600/-.' });

    expect(t1.status).toBe(200);
    expect(t1.body.data.session.productDraft.craft_type).toBe('Etikoppaka Craft');
    expect(t1.body.data.session.productDraft.price).toBe(600);

    // Turn 2: Artisan sends Nimmalakunta Leather Toy utterance
    const t2 = await request(app)
      .post(`/api/v1/sessions/${sessionId}/message`)
      .send({ text: 'ఆంధ్రప్రదేశ్ అనంతపురం జిల్లా నిమ్మలకుంట గ్రామానికి చెందిన ఈ సాంప్రదాయ తోలు బొమ్మను మేక చర్మంతో చేతితో రూపొందించారు. దీని వెల రూ. 1,200/-.' });

    expect(t2.status).toBe(200);
    expect(t2.body.data.nlu.extractedEntities.craft_type).toBe('Nimmalakunta Leather Craft');
    expect(t2.body.data.nlu.extractedEntities.price).toBe(1200);
    expect(t2.body.data.nlu.extractedEntities.material).toEqual(expect.arrayContaining(['Leather']));

    // Verify session.productDraft reflects the new explicit information
    expect(t2.body.data.session.productDraft.craft_type).toBe('Nimmalakunta Leather Craft');
    expect(t2.body.data.session.productDraft.price).toBe(1200);
    expect(t2.body.data.session.productDraft.material).toEqual(expect.arrayContaining(['Leather']));
    expect(t2.body.data.session.productDraft.product_name).toBeUndefined();
    expect(t2.body.data.session.missingFields).toContain('product_name');
  });

  it('POST /api/v1/sessions/:id/message should return 400 for empty text', async () => {
    const created = await request(app).post('/api/v1/sessions').send({});
    const sessionId = created.body.data.session.id;
    const res = await request(app)
      .post(`/api/v1/sessions/${sessionId}/message`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });
});
