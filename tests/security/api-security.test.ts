import request from 'supertest';
import app from '@/server';
import { TestDatabase } from '../helpers/test-db';
import { createTestUserAndToken } from '../helpers/auth';

describe('API Security Tests', () => {
  let testDb: TestDatabase;
  let auth: string;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();

    const user = await createTestUserAndToken('admin');
    auth = `Bearer ${user.token}`;
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('Input Validation Security', () => {
    test('should reject requests with oversized payloads', async () => {
      const oversizedPayload = { data: 'x'.repeat(11 * 1024 * 1024) }; // > 10MB

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', auth)
        .send(oversizedPayload)
        .expect(413);

      expect(response.body.success).toBe(false);
    });

    test('should handle deeply nested objects without required fields safely', async () => {
      const deepObject = { a: { b: { c: { d: { e: { f: { g: { h: 'deep' } } } } } } } };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', auth)
        .send(deepObject);

      // Missing required name/type -> validation error, never a crash.
      expect([400, 422]).toContain(response.status);
    });

    test('should reject payloads that violate field limits', async () => {
      const largeArray = { name: 'x'.repeat(10000), type: 'general' };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', auth)
        .send(largeArray);

      expect([400, 422]).toContain(response.status);
    });

    test('should store string fields safely (parameterized queries)', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert("xss")</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', auth)
          .send({ name: payload, type: 'general' });

        // The API stores the value via parameterized queries; it must never 500.
        expect(response.status).toBeLessThan(500);
      }
    });

    test('should reject clearly invalid email formats at registration', async () => {
      const invalidEmails = ['invalid-email', '@invalid.com', 'test@', 'test space@test.com'];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({ email, username: 'someuser', fullName: 'Some User', password: 'ValidPassword123!' });

        expect([400, 422]).toContain(response.status);
      }
    });

    test('should enforce a minimum password length at registration', async () => {
      const shortPasswords = ['123456', 'short', ''];

      for (const password of shortPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({ email: 'pw@example.com', username: 'pwuser', fullName: 'PW User', password });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('HTTP Security Headers', () => {
    test('should include the expected security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    test('should not expose server implementation details', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server'] || '').not.toContain('Express');
    });

    test('should not reflect arbitrary CORS origins', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Origin', 'https://malicious-site.com')
        .set('Authorization', auth);

      const allowedOrigin = response.headers['access-control-allow-origin'];
      if (allowedOrigin) {
        expect(allowedOrigin).not.toBe('*');
        expect(allowedOrigin).not.toBe('https://malicious-site.com');
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak internal details on 404', async () => {
      const response = await request(app).get('/api/nonexistent-endpoint').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(JSON.stringify(response.body)).not.toContain('stack');
    });

    test('should not expose database internals on validation errors', async () => {
      const response = await request(app)
        .get('/api/agents/invalid-uuid-format')
        .set('Authorization', auth);

      expect(response.status).toBeGreaterThanOrEqual(400);
      const body = JSON.stringify(response.body).toLowerCase();
      expect(body).not.toContain('sql');
      expect(body).not.toContain('schema');
      expect(body).not.toContain('table');
    });

    test('should handle malformed POST requests gracefully', async () => {
      const malformedJson = await request(app)
        .post('/api/agents')
        .set('Authorization', auth)
        .set('Content-Type', 'application/json')
        .send('invalid-json');
      expect([400, 422]).toContain(malformedJson.status);

      const wrongContentType = await request(app)
        .post('/api/agents')
        .set('Authorization', auth)
        .set('Content-Type', 'text/plain')
        .send('not json');
      expect([400, 415, 422]).toContain(wrongContentType.status);
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    test('should rate limit repeated login attempts', async () => {
      const attempts = Array.from({ length: 12 }, () =>
        request(app).post('/api/auth/login').send({ email: 'abuse@test.com', password: 'wrong' })
      );

      const results = await Promise.all(attempts);
      const rateLimited = results.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should serve reads within the general limit', async () => {
      const results = await Promise.all(
        Array.from({ length: 15 }, () => request(app).get('/api/agents').set('Authorization', auth))
      );

      results.forEach((r) => expect([200, 429]).toContain(r.status));
    });
  });

  describe('Path Traversal and URL Security', () => {
    test('should not serve files via path traversal', async () => {
      const payloads = [
        '../../../etc/passwd',
        '/etc/passwd',
        '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      for (const payload of payloads) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set('Authorization', auth);

        // No file-serving routes exist; these must not resolve.
        expect([400, 401, 403, 404]).toContain(response.status);
      }
    });

    test('should handle duplicate query parameters safely', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query('id=1&id=2&id=3')
        .set('Authorization', auth);

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('API Versioning Security', () => {
    test('should return 404 for unknown API namespaces', async () => {
      const response = await request(app).get('/api/v999/agents').set('Authorization', auth);
      expect([404, 410, 501]).toContain(response.status);
    });
  });

  describe('Content Type Security', () => {
    test('should reject non-JSON bodies on JSON endpoints', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', auth)
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect([400, 415, 422]).toContain(response.status);
    });
  });

  describe('Information Disclosure Prevention', () => {
    test('should not reveal route structure on unknown resources', async () => {
      const response = await request(app)
        .get('/api/nonexistent-resource')
        .set('Authorization', auth);

      expect([404, 405]).toContain(response.status);
      expect(JSON.stringify(response.body)).not.toContain('routes');
    });

    test('should not expose sensitive columns in agent responses', async () => {
      const response = await request(app).get('/api/agents').set('Authorization', auth).expect(200);

      const body = JSON.stringify(response.body);
      expect(body).not.toContain('password_hash');
      expect(body).not.toContain('password');
    });

    test('should give consistent responses to resource enumeration', async () => {
      const results = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          request(app).get(`/api/users/${i}`).set('Authorization', auth)
        )
      );

      // /api/users is not mounted -> uniformly not found.
      results.forEach((r) => expect([401, 404]).toContain(r.status));
    });
  });

  describe('Resource Safety', () => {
    test('should respond promptly (no hanging requests)', async () => {
      const response = await request(app)
        .get('/api/agents')
        .query({ delay: 30000 })
        .set('Authorization', auth)
        .timeout(5000);

      expect([200, 400]).toContain(response.status);
    });

    test('should handle a burst of concurrent reads without rejecting connections', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => request(app).get('/api/agents').set('Authorization', auth))
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBe(20);
    });
  });
});
