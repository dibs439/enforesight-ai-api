import request from 'supertest';

// JWT_SECRET must be set before importing app (utils/auth.ts throws at module load)
process.env.JWT_SECRET = 'test-secret-key-for-jest-unit-tests-32chars';
process.env.NODE_ENV = 'test';

import app from '../index';

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status with dependency info', async () => {
      const response = await request(app).get('/health');

      // Accepts either 200 (healthy) or 503 (Convex unreachable in test env)
      expect([200, 503]).toContain(response.status);
      expect(['OK', 'DEGRADED']).toContain(response.body.status);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body.dependencies).toHaveProperty('convex');
    });
  });

  describe('GET /api/v1', () => {
    it('should return 200 and API information', async () => {
      const response = await request(app).get('/api/v1').expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'Welcome to Enforesight API'
      );
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('GET /api/v1/status', () => {
    it('should return 200 and server status', async () => {
      const response = await request(app).get('/api/v1/status').expect(200);

      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/nonexistent').expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('Response headers', () => {
    it('should include X-Request-ID on every response', async () => {
      const response = await request(app).get('/api/v1');
      expect(response.headers).toHaveProperty('x-request-id');
      expect(typeof response.headers['x-request-id']).toBe('string');
    });

    it('should echo back a client-provided X-Request-ID', async () => {
      const myId = 'test-correlation-id-123';
      const response = await request(app)
        .get('/api/v1')
        .set('x-request-id', myId);
      expect(response.headers['x-request-id']).toBe(myId);
    });
  });

  describe('GET /api (old unversioned route)', () => {
    it('should return 404 now that unversioned routes are removed', async () => {
      await request(app).get('/api').expect(404);
    });
  });
});
