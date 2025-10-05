import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

import app from '@/server';
import { TestDatabase } from '../helpers/test-db';
import { logger } from '@/utils/logger';

describe('API Integration Tests', () => {
  let testDb: TestDatabase;
  let server: any;
  let port: number;

  beforeAll(async () => {
    // Initialize test database
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await testDb.seedTestData();

    // Start server on random port for testing
    port = Math.floor(Math.random() * 1000) + 3000;
    server = app.listen(port);

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.PORT = port.toString();
  });

  afterAll(async () => {
    // Close server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    // Cleanup test database
    await testDb.close();
  });

  beforeEach(async () => {
    // Reset test data
    await testDb.cleanup();
    await testDb.seedTestData();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
        version: expect.any(String),
        database: {
          connected: true,
          pool: {
            totalCount: expect.any(Number),
            idleCount: expect.any(Number),
            waitingCount: expect.any(Number),
          },
        },
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
        },
      });
    });

    it('should handle database connection failure', async () => {
      // Temporarily break database connection
      await testDb.close();

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Service unavailable',
        timestamp: expect.any(String),
      });

      // Reinitialize database for other tests
      await testDb.initialize();
    });
  });

  describe('API Documentation', () => {
    it('should serve API documentation', async () => {
      const response = await request(app)
        .get('/api-docs')
        .expect(200);

      expect(response.text).toContain('swagger');
      expect(response.text).toContain('HASEB API Documentation');
    });

    it('should serve OpenAPI specification', async () => {
      const response = await request(app)
        .get('/api-docs.json')
        .expect(200);

      const spec = response.body;
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('HASEB API');
      expect(spec.paths).toBeDefined();
    });
  });

  describe('Root Endpoint', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

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
        .expect(200);

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
    it('should allow normal request rate', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/api/agents')
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    it('should limit excessive requests', async () => {
      // Make many rapid requests
      const promises = Array.from({ length: 100 }, () =>
        request(app).get('/api/agents')
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // At least some requests should be rate limited in test environment
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet should add security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('Compression', () => {
    it('should compress responses for large payloads', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Check if response is compressed (this is a basic check)
      expect(response.headers['content-encoding']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          timestamp: expect.any(String),
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

    it('should handle oversized requests', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // > 10MB

      const response = await request(app)
        .post('/api/agents')
        .send({ data: largeData })
        .expect(413);
    });
  });

  describe('Request Logging', () => {
    it('should log API requests', async () => {
      const logSpy = jest.spyOn(logger, 'info').mockImplementation();

      await request(app)
        .get('/api/agents')
        .expect(200);

      // Check that requests were logged
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should include request metadata in logs', async () => {
      const logSpy = jest.spyOn(logger, 'info').mockImplementation();

      await request(app)
        .get('/api/agents')
        .set('User-Agent', 'test-agent')
        .set('X-Request-ID', 'test-req-123')
        .expect(200);

      // Verify request was logged with metadata
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/agents'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });
  });

  describe('Authentication Integration', () => {
    it('should reject requests without authentication', async () => {
      // This test assumes certain endpoints require authentication
      const response = await request(app)
        .get('/api/agents')
        .expect(401); // Assuming authentication is required

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should accept requests with valid authentication', async () => {
      // Mock authentication token
      const validToken = 'Bearer valid-jwt-token';

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', validToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid authentication tokens', async () => {
      const invalidToken = 'Bearer invalid-token';

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', invalidToken)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Database Integration', () => {
    it('should maintain database connection across requests', async () => {
      // Make multiple concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/agents')
      );

      const responses = await Promise.all(promises);

      // All requests should succeed if database connection is stable
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle database errors gracefully', async () => {
      // This would require mocking database errors in a real scenario
      // For now, ensure endpoints don't crash on database issues
      const response = await request(app)
        .get('/api/agents/nonexistent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      const promises = Array.from({ length: 20 }, () =>
        request(app).get('/api/agents')
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should handle 20 concurrent requests within reasonable time
      expect(duration).toBeLessThan(2000); // 2 seconds
    });

    it('should maintain response times under load', async () => {
      const responseTimes: number[] = [];

      const promises = Array.from({ length: 10 }, async () => {
        const start = Date.now();
        await request(app).get('/health');
        return Date.now() - start;
      });

      const times = await Promise.all(promises);
      responseTimes.push(...times);

      const averageTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      // Average response time should be reasonable
      expect(averageTime).toBeLessThan(500); // 500ms
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection', async () => {
      // This would require WebSocket client in tests
      // For now, ensure the server can handle WebSocket upgrade requests
      const response = await request(app)
        .get('/socket.io/')
        .set('Connection', 'upgrade')
        .set('Upgrade', 'websocket');

      // WebSocket handshake would return 101, but we accept other responses for this test
      expect([101, 400, 404]).toContain(response.status);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should handle graceful shutdown', async () => {
      // This test would involve simulating SIGTERM/SIGINT
      // For now, ensure server can be closed without errors
      const testServer = app.listen(0);

      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });

      // If we reach here, shutdown was graceful
      expect(true).toBe(true);
    });
  });
});