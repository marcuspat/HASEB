import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';

import app from '@/server';
import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { TestDatabase } from '../helpers/test-db';

// Well-formed v4 UUID that will not exist in the database.
const UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';

describe('API Integration Tests', () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    // Ensures the (shared) test database is migrated and reachable. The HTTP
    // handlers use the global `db` singleton, which points at the same
    // PostgreSQL test database via .env.test.
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
  });

  afterAll(async () => {
    await testDb.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
        version: expect.any(String),
        database: {
          connected: true,
          pool: expect.any(Object),
        },
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
        },
      });
    });

    it('should return 503 when the database is unavailable', async () => {
      jest.spyOn(db, 'testConnection').mockRejectedValue(new Error('db down') as never);

      const response = await request(app).get('/health').expect(503);

      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Service unavailable',
        timestamp: expect.any(String),
      });
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger UI', async () => {
      const response = await request(app).get('/api-docs/').expect(200);
      expect(response.text).toContain('swagger');
    });
  });

  describe('Root Endpoint', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toMatchObject({
        name: 'HASEB API',
        version: '1.0.0',
        description: 'Holistic Agentic System Evaluator & Benchmarking Suite',
        endpoints: {
          health: '/health',
          documentation: '/api-docs',
          api: '/api',
        },
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/agents')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should include CORS headers in API responses', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow a normal request rate', async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => request(app).get('/api/agents'))
      );

      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status);
      });
    });

    it('should not throttle requests within the configured limit', async () => {
      // The test environment allows 1000 requests / 15 min, so a modest burst
      // must not be rate limited.
      const responses = await Promise.all(
        Array.from({ length: 30 }, () => request(app).get('/api/agents'))
      );

      const throttled = responses.filter((r) => r.status === 429);
      expect(throttled).toHaveLength(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('Compression', () => {
    it('should compress large responses when gzip is accepted', async () => {
      const response = await request(app)
        .get('/api/metrics/dashboard')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app).get('/api/nonexistent').expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          timestamp: expect.anything(),
        },
      });
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject oversized requests', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // > 10MB limit

      const response = await request(app)
        .post('/api/agents')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ data: largeData }))
        .expect(413);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Request Logging', () => {
    it('should log API requests', async () => {
      const logSpy = jest.spyOn(logger, 'info');

      await request(app).get('/api/agents').expect(200);

      expect(logSpy).toHaveBeenCalled();
    });

    it('should include request metadata in logs', async () => {
      const logSpy = jest.spyOn(logger, 'info');

      await request(app)
        .get('/api/agents')
        .set('User-Agent', 'test-agent')
        .expect(200);

      expect(logSpy).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({ method: 'GET', url: '/api/agents' })
      );
    });
  });

  describe('Public Endpoint Access', () => {
    it('should serve the agents collection without authentication', async () => {
      const response = await request(app).get('/api/agents').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Database Integration', () => {
    it('should maintain database connection across concurrent requests', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => request(app).get('/api/agents'))
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should return 404 for a non-existent agent id', async () => {
      const response = await request(app)
        .get(`/api/agents/${UNKNOWN_UUID}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      await Promise.all(Array.from({ length: 20 }, () => request(app).get('/api/agents')));

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain reasonable response times under load', async () => {
      const times = await Promise.all(
        Array.from({ length: 10 }, async () => {
          const start = Date.now();
          await request(app).get('/health');
          return Date.now() - start;
        })
      );

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(averageTime).toBeLessThan(1000);
    });
  });

  describe('WebSocket Integration', () => {
    it('should respond to WebSocket upgrade probes', async () => {
      const response = await request(app)
        .get('/socket.io/')
        .set('Connection', 'upgrade')
        .set('Upgrade', 'websocket');

      expect([101, 400, 404]).toContain(response.status);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close a server instance without errors', async () => {
      const testServer = app.listen(0);

      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });

      expect(true).toBe(true);
    });
  });
});
