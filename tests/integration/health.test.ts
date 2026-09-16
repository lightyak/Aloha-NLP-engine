import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('API Integration Tests', () => {
  it('GET /api/v1/health should return 200 OK and healthy status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.database.connected).toBe(true);
    expect(res.body.data.database.type).toBe('in-memory');
  });

  it('GET /api/v1/unknown-route should return 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/v1/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
