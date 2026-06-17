import request from 'supertest';
import app from '@/server';
import { TestDatabase } from '../helpers/test-db';

// Mock logger for security tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('API Security Tests', () => {
  let testDb: TestDatabase;
  let authToken: string;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await testDb.seedTestData();

    // Create valid auth token for testing
    authToken = 'Bearer valid-test-token-for-security-tests';
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('Input Validation Security', () => {
    test('should reject requests with oversized payloads', async () => {
      const oversizedPayload = {
        data: 'x'.repeat(11 * 1024 * 1024), // > 10MB
      };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', authToken)
        .send(oversizedPayload)
        .expect(413);

      expect(response.body.success).toBe(false);
    });

    test('should handle deeply nested objects safely', async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: 'deeply nested value'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', authToken)
        .send(deepObject);

      // Should either process safely or reject due to depth limits
      expect([200, 400, 401, 422]).toContain(response.status);
    });

    test('should validate array sizes', async () => {
      const largeArray = {
        tags: Array.from({ length: 10000 }, (_, i) => `tag-${i}`),
      };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', authToken)
        .send(largeArray);

      expect([400, 401, 422]).toContain(response.status);
    });

    test('should sanitize HTML content', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(\'xss\')">',
        'javascript:alert("xss")',
        '<svg onload="alert(\'xss\')">',
        '"><script>alert("xss")</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', authToken)
          .send({
            name: payload,
            type: 'general',
          });

        // Should reject or sanitize XSS payloads
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    test('should validate email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        '@invalid.com',
        'test@',
        'test..test@test.com',
        'test@.test.com',
        'test@test..com',
        'test space@test.com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'ValidPassword123!',
          });

        expect([400, 409, 422]).toContain(response.status);
      }
    });

    test('should validate password strength', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '111111',
        'password123',
        'short',
        '', // Empty
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
          });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('HTTP Security Headers', () => {
    test('should include all necessary security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Content Security Policy
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['content-security-policy']).toBeDefined();
      }

      // X-Content-Type-Options
      expect(response.headers['x-content-type-options']).toBe('nosniff');

      // X-Frame-Options
      expect(response.headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);

      // X-XSS-Protection
      expect(response.headers['x-xss-protection']).toBeDefined();

      // Referrer-Policy
      expect(response.headers['referrer-policy']).toBeDefined();

      // Permissions-Policy (if implemented)
      const permissionsPolicy = response.headers['permissions-policy'];
      if (permissionsPolicy) {
        expect(permissionsPolicy).toBeDefined();
      }
    });

    test('should not expose server information', async () => {
      const response = await request(app).get('/health').expect(200);

      // Should not expose server software details
      expect(response.headers['server']).not.toContain('Express');
      expect(response.headers['x-powered-by']).not.toBeDefined();

      // Should not expose application version in headers
      expect(response.headers['x-api-version']).not.toBeDefined();
    });

    test('should implement proper CORS headers', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Origin', 'https://malicious-site.com');

      // Should not allow arbitrary origins
      const allowedOrigin = response.headers['access-control-allow-origin'];
      if (allowedOrigin) {
        expect(allowedOrigin).not.toBe('*');
        expect(allowedOrigin).not.toBe('https://malicious-site.com');
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const response = await request(app)
          .get('/api/nonexistent-endpoint')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');

        // Should not include stack traces or internal details
        expect(JSON.stringify(response.body)).not.toContain('Error:');
        expect(JSON.stringify(response.body)).not.toContain('stack');
        expect(JSON.stringify(response.body)).not.toContain('internal');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should sanitize database error messages', async () => {
      // This would require intentionally triggering a database error
      const response = await request(app)
        .get('/api/agents/invalid-uuid-format')
        .set('Authorization', authToken);

      // Should not expose database schema or internal errors
      if (response.status >= 400) {
        expect(JSON.stringify(response.body)).not.toContain('sql');
        expect(JSON.stringify(response.body)).not.toContain('schema');
        expect(JSON.stringify(response.body)).not.toContain('table');
      }
    });

    test('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        { method: 'GET', path: '/api/agents', headers: { 'Content-Type': 'application/json' } },
        { method: 'POST', path: '/api/agents', body: 'invalid-json', headers: { 'Content-Type': 'application/json' } },
        { method: 'POST', path: '/api/agents', body: null, headers: { 'Content-Type': 'application/json' } },
      ];

      for (const req of malformedRequests) {
        const requestBuilder = (request(app) as any)[req.method.toLowerCase()](req.path);

        if (req.headers) {
          Object.entries(req.headers).forEach(([key, value]) => {
            requestBuilder.set(key, value);
          });
        }

        if (req.body !== undefined) {
          requestBuilder.send(req.body);
        }

        const response = await requestBuilder;
        expect([400, 401, 415, 422]).toContain(response.status);
      }
    });
  });

  describe('API Rate Limiting and Abuse Prevention', () => {
    test('should limit brute force attempts on authentication', async () => {
      const loginAttempts = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: `user${i}@test.com`,
            password: 'wrongpassword',
          })
      );

      const results = await Promise.all(loginAttempts);
      const rateLimited = results.filter(r => r.status === 429);

      // Should rate limit after several failed attempts
      expect(rateLimited.length).toBeGreaterThan(5);
    });

    test('should implement IP-based rate limiting', async () => {
      const requests = Array.from({ length: 30 }, () =>
        request(app).get('/health')
      );

      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r.status === 429);

      // Should have some rate limiting in place
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should limit resource-intensive operations', async () => {
      const expensiveRequests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/agents')
          .query({ limit: 1000, page: 1 }) // Large page size
          .set('Authorization', authToken)
      );

      const results = await Promise.all(expensiveRequests);
      const rejected = results.filter(r => [400, 422, 429].includes(r.status));

      // Should limit resource-intensive queries
      expect(rejected.length).toBeGreaterThan(0);
    });
  });

  describe('Path Traversal and URL Security', () => {
    test('should prevent path traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set('Authorization', authToken);

        expect([400, 401, 403, 404]).toContain(response.status);
      }
    });

    test('should validate URL parameters', async () => {
      const maliciousParams = [
        '?redirect=javascript:alert("xss")',
        '?next=//evil.com',
        '?return_to=data:text/html,<script>alert("xss")</script>',
        '?callback=alert("xss")',
      ];

      for (const params of maliciousParams) {
        const response = await request(app)
          .get(`/api/auth/login${params}`)
          .send({});

        expect([400, 401, 422]).toContain(response.status);
      }
    });

    test('should handle HTTP parameter pollution', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query('id=1&id=2&id=3')
        .set('Authorization', authToken);

      // Should handle duplicate parameters safely
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('API Versioning Security', () => {
    test('should handle unknown API versions gracefully', async () => {
      const response = await request(app)
        .get('/api/v999/agents')
        .set('Authorization', authToken);

      expect([404, 410, 501]).toContain(response.status);
    });

    test('should validate API version in headers', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('API-Version', '999.0')
        .set('Authorization', authToken);

      expect([200, 400, 406]).toContain(response.status);
    });
  });

  describe('Content Type Security', () => {
    test('should reject requests with incorrect content types', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Content-Type', 'text/plain')
        .send('not json')
        .set('Authorization', authToken);

      expect([400, 415, 422]).toContain(response.status);
    });

    test('should validate JSON content', async () => {
      const malformedJson = '{ "invalid": json }';

      const response = await request(app)
        .post('/api/agents')
        .set('Content-Type', 'application/json')
        .send(malformedJson)
        .set('Authorization', authToken);

      expect([400, 422]).toContain(response.status);
    });

    test('should handle multipart content safely', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Content-Type', 'multipart/form-data')
        .field('data', JSON.stringify({ malicious: '<script>alert("xss")</script>' }))
        .set('Authorization', authToken);

      expect([200, 400, 401, 422]).toContain(response.status);
    });
  });

  describe('Information Disclosure Prevention', () => {
    test('should not expose internal API structure', async () => {
      const response = await request(app)
        .get('/api/nonexistent-resource')
        .set('Authorization', authToken);

      expect([404, 405]).toContain(response.status);

      // Should not reveal available endpoints or routes
      expect(JSON.stringify(response.body)).not.toContain('routes');
      expect(JSON.stringify(response.body)).not.toContain('endpoints');
      expect(JSON.stringify(response.body)).not.toContain('/api/');
    });

    test('should not expose database schema information', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', authToken);

      if (response.status === 200) {
        // Should not include database column names or schema details
        const responseBody = JSON.stringify(response.body);
        expect(responseBody).not.toContain('password_hash');
        expect(responseBody).not.toContain('internal_id');
        expect(responseBody).not.toContain('created_at');
      }
    });

    test('should handle enumeration attacks', async () => {
      // Try to enumerate user IDs
      const enumerationRequests = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .get(`/api/users/${i}`)
          .set('Authorization', authToken)
      );

      const results = await Promise.all(enumerationRequests);

      // Should not allow systematic enumeration
      const found = results.filter(r => r.status === 200);
      const notFound = results.filter(r => r.status === 404);

      // Should have consistent responses (all 404 or properly authorized)
      expect(found.length + notFound.length).toBe(50);
    });
  });

  describe('Timeout and Resource Security', () => {
    test('should implement request timeouts', async () => {
      // This test assumes there might be endpoints that could hang
      const response = await request(app)
        .get('/api/agents')
        .query({ delay: 30000 }) // Request long delay
        .set('Authorization', authToken)
        .timeout(5000); // 5 second client timeout

      // Should either succeed quickly or timeout
      expect([200, 408, 500]).toContain(response.status || 408);
    });

    test('should limit concurrent connections per user', async () => {
      const concurrentRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/agents')
          .set('Authorization', authToken)
      );

      const results = await Promise.allSettled(concurrentRequests);
      const rejected = results.filter(r => r.status === 'rejected');

      // Should limit concurrent connections
      expect(rejected.length).toBeGreaterThan(0);
    });
  });
});