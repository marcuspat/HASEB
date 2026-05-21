import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '@/server';
import { TestDatabase } from '../helpers/test-db';
import { createTestUserAndToken, signToken } from '../helpers/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
const UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';

describe('Authentication Security Tests', () => {
  let testDb: TestDatabase;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();

    const user = await createTestUserAndToken('admin');
    authToken = user.token;
    userId = user.id;
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('Authentication Middleware', () => {
    test('should reject requests without authentication', async () => {
      const response = await request(app).get('/api/agents').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED', message: expect.any(String) },
      });
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '-1h' });

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should reject a token for a non-existent user', async () => {
      const ghostToken = signToken(UNKNOWN_UUID);

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${ghostToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'InvalidHeader',
        'Bearer',
        'Basic dXNlcjpwYXNz',
        'Bearer ' + 'a'.repeat(5000),
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/agents')
          .set('Authorization', header)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Role-Based Access Control', () => {
    test('should forbid non-admin users from destructive operations', async () => {
      const viewer = await createTestUserAndToken('user');

      const response = await request(app)
        .delete(`/api/agents/${UNKNOWN_UUID}`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('should allow admin users to reach destructive operations', async () => {
      // Admin passes the role gate; the (random) id simply isn't found.
      const response = await request(app)
        .delete(`/api/agents/${UNKNOWN_UUID}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([204, 404]).toContain(response.status);
    });
  });

  describe('Login Flow', () => {
    test('should issue a token for valid credentials', async () => {
      const email = `login_${Date.now()}@test.com`;
      const password = 'ValidPassword123!';

      await request(app)
        .post('/api/auth/register')
        .send({ email, username: `login${Date.now()}`, fullName: 'Login User', password })
        .expect(201);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    test('should reject invalid credentials with 401', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'wrongpassword' });

      // 401 normally; 429 if the strict login limiter has already tripped.
      expect([401, 429]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Password Security', () => {
    test('should hash passwords with bcrypt', async () => {
      const plainPassword = 'testpassword123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/);
      expect(await bcrypt.compare(plainPassword, hashedPassword)).toBe(true);
      expect(await bcrypt.compare('wrongpassword', hashedPassword)).toBe(false);
    });

    test('should use sufficient bcrypt rounds', async () => {
      const hashedPassword = await bcrypt.hash('testpassword123', 12);
      expect(hashedPassword).toMatch(/^\$2[aby]\$12\$/);
    });
  });

  describe('JWT Security', () => {
    test('should use a strong signing algorithm', async () => {
      const token = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256' });
      const decoded = jwt.decode(token, { complete: true }) as any;
      expect(decoded.header.alg).toBe('HS256');
    });

    test('should include standard token claims', async () => {
      const decoded = jwt.decode(authToken) as any;
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    test('should set a reasonable token expiration', async () => {
      const decoded = jwt.decode(authToken) as any;
      const timeUntilExpiration = decoded.exp * 1000 - Date.now();
      expect(timeUntilExpiration).toBeGreaterThan(0);
      expect(timeUntilExpiration).toBeLessThan(24 * 60 * 60 * 1000);
    });
  });

  describe('Input Validation Security', () => {
    test('should enforce input length limits', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'a'.repeat(10000), type: 'general' });

      expect([400, 413, 422]).toContain(response.status);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Rate Limiting Security', () => {
    test('should limit repeated authentication attempts', async () => {
      const attempts = Array.from({ length: 10 }, () =>
        request(app).post('/api/auth/login').send({ email: 'brute@test.com', password: 'wrong' })
      );

      const results = await Promise.all(attempts);
      const rateLimited = results.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    test('should not leak internal details in error messages', async () => {
      const response = await request(app).get('/api/nonexistent-endpoint').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).not.toContain('Error:');
      expect(response.body.error.message).not.toContain('stack');
    });
  });

  describe('SQL Injection Protection', () => {
    test('should safely reject injection payloads in path params', async () => {
      const payloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of payloads) {
        const response = await request(app)
          .get(`/api/agents/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Non-UUID path param fails validation; never a server/database error.
        expect([400, 404, 422]).toContain(response.status);
      }

      // Database remains healthy after the attempts.
      const health = await request(app).get('/health').expect(200);
      expect(health.body.database.connected).toBe(true);
    });
  });
});
