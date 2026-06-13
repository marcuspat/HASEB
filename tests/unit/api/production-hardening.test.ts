/**
 * Production-hardening regression tests.
 *
 * These exercise the HTTP surface of the auth and agent routes plus the
 * evaluation routes that previously hung forever (they were registered with a
 * bare `validateRequest` middleware reference instead of `validateRequest(schema)`,
 * so `next()` was never called). The model layer is mocked so the suite is
 * fully self-contained and does not need a database.
 */
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';

// Deterministic mocks for the data-access layer (jest hoists these; the `mock`
// prefix is required for variables referenced inside a jest.mock factory).
type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;
const asyncMock = (): AsyncMock => jest.fn<(...args: any[]) => Promise<any>>();

const mockUserModel = {
  findByEmail: asyncMock(),
  findByUsername: asyncMock(),
  findById: asyncMock(),
  create: asyncMock(),
  updatePassword: asyncMock(),
  getPasswordHash: asyncMock(),
};
const mockAgentModel = {
  list: asyncMock(),
  findById: asyncMock(),
  create: asyncMock(),
  delete: asyncMock(),
};
const mockBenchmarkModel = {
  findById: asyncMock(),
};
const mockEvaluationModel = {
  create: asyncMock(),
  updateStatusWithTime: asyncMock(),
};

jest.mock('@/database/models/User', () => ({ UserModel: mockUserModel }));
jest.mock('@/database/models/Agent', () => ({ AgentModel: mockAgentModel }));
jest.mock('@/database/models/Benchmark', () => ({ BenchmarkModel: mockBenchmarkModel }));
jest.mock('@/database/models/Evaluation', () => ({ EvaluationModel: mockEvaluationModel }));

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';

let app: Express;
let passwordHash: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  passwordHash = await bcrypt.hash('Password123', 4);

  const express = (await import('express')).default;
  const authRoutes = (await import('@/api/auth')).default;
  const agentsRoutes = (await import('@/api/agents')).default;
  const evaluationsRoutes = (await import('@/api/evaluations')).default;
  const { errorHandler } = await import('@/middleware/errorHandler');

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/agents', agentsRoutes);
  app.use('/api/evaluations', evaluationsRoutes);
  app.use(errorHandler);
});

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  id: VALID_UUID,
  email: 'user@example.com',
  username: 'testuser',
  fullName: 'Test User',
  role: 'user',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth routes', () => {
  it('rejects registration with a missing/short password (validation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', username: 'testuser', fullName: 'Test User', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });

  it('registers a valid user and returns access + refresh tokens', async () => {
    mockUserModel.findByEmail.mockResolvedValue(null);
    mockUserModel.findByUsername.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue(buildUser());
    mockUserModel.updatePassword.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', username: 'testuser', fullName: 'Test User', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('logs in with valid credentials', async () => {
    mockUserModel.findByEmail.mockResolvedValue(buildUser());
    mockUserModel.getPasswordHash.mockResolvedValue(passwordHash);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects login with an invalid password', async () => {
    mockUserModel.findByEmail.mockResolvedValue(buildUser());
    mockUserModel.getPasswordHash.mockResolvedValue(passwordHash);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a refresh request with no token (validation)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rotates tokens on refresh, issuing a new refresh token', async () => {
    mockUserModel.findByEmail.mockResolvedValue(buildUser());
    mockUserModel.getPasswordHash.mockResolvedValue(passwordHash);
    mockUserModel.findById.mockResolvedValue(buildUser());

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'Password123' });
    const originalRefresh = login.body.data.refreshToken;

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefresh });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // Rotation: a brand-new refresh token (fresh jti) is handed back.
    expect(res.body.data.refreshToken).not.toBe(originalRefresh);
  });
});

describe('Agent CRUD routes', () => {
  it('lists agents', async () => {
    mockAgentModel.list.mockResolvedValue({ agents: [], total: 0 });

    const res = await request(app).get('/api/agents');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockAgentModel.list).toHaveBeenCalled();
  });

  it('rejects agent creation with a missing name (validation)', async () => {
    const res = await request(app).post('/api/agents').send({ type: 'swe' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockAgentModel.create).not.toHaveBeenCalled();
  });

  it('creates an agent with valid input', async () => {
    const agent = { id: VALID_UUID, name: 'My Agent', type: 'swe', status: 'inactive' };
    mockAgentModel.create.mockResolvedValue(agent);

    const res = await request(app)
      .post('/api/agents')
      .send({ name: 'My Agent', type: 'swe' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockAgentModel.create).toHaveBeenCalled();
  });
});

describe('Evaluation routes no longer hang (validateRequest schema fix)', () => {
  it('POST /api/evaluations responds (400) to an invalid body instead of hanging', async () => {
    const res = await request(app).post('/api/evaluations').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/evaluations/:id/status validates and responds', async () => {
    const res = await request(app)
      .patch(`/api/evaluations/${VALID_UUID}/status`)
      .send({ status: 'not-a-real-status' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/evaluations creates an evaluation when input is valid', async () => {
    mockAgentModel.findById.mockResolvedValue({ id: VALID_UUID, name: 'Agent' });
    mockBenchmarkModel.findById.mockResolvedValue({ id: VALID_UUID_2, name: 'Benchmark' });
    mockEvaluationModel.create.mockResolvedValue({ id: 'eval-1', status: 'pending' });

    const res = await request(app)
      .post('/api/evaluations')
      .send({ agentId: VALID_UUID, benchmarkId: VALID_UUID_2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockEvaluationModel.create).toHaveBeenCalled();
  });
});
