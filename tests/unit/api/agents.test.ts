import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// True unit test for the agents router. We mock the AgentModel (DB boundary) and
// the request/validation middleware, but use the REAL asyncHandler + errorHandler
// so error-to-HTTP mapping is exercised genuinely. No live database is used.
//
// The router is loaded via dynamic import AFTER the mocks are registered so the
// transitive `import { AgentModel } from '../database/models/Agent'` resolves to
// our mock (and never touches `pg`/the real connection singleton).

const mockAgentModel = {
  findById: jest.fn(),
  list: jest.fn(),
  search: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
  getActiveAgents: jest.fn(),
};

jest.unstable_mockModule('@/database/models/Agent', () => ({
  AgentModel: mockAgentModel,
}));

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.unstable_mockModule('@/middleware/requestLogger', () => ({
  logApiCall: (_req: any, _res: any, next: any) => next(),
}));

// Validation is mocked as a permissive pass-through: it sets pagination and
// lets every request through so we can assert the router's handler logic in
// isolation. (Validation rules themselves are covered by validation.test.ts.)
jest.unstable_mockModule('@/middleware/validation', () => ({
  validateRequest: (_schema: any) => (_req: any, _res: any, next: any) => next(),
  extractPagination: (req: any, _res: any, next: any) => {
    req.pagination = { page: 1, limit: 20 };
    next();
  },
  commonSchemas: {
    pagination: { query: {} },
    search: { query: {} },
    id: { params: {} },
    agentCreate: { body: {} },
  },
}));

let app: express.Application;

beforeAll(async () => {
  const agentsRoutes = (await import('@/api/agents')).default;
  const { errorHandler } = await import('@/middleware/errorHandler');

  app = express();
  app.use(express.json());
  // The router reads req.pagination on the search route too.
  app.use((req: any, _res, next) => {
    req.pagination = { page: 1, limit: 20 };
    next();
  });
  app.use('/api/agents', agentsRoutes);
  app.use(errorHandler);
});

describe('Agents API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return list of agents with pagination', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Code Master',
          type: 'swe',
          status: 'active',
          capabilities: ['code-generation'],
          createdAt: new Date().toISOString(),
        },
      ];

      mockAgentModel.list.mockResolvedValue({ agents: mockAgents, total: 1 });

      const response = await request(app).get('/api/agents').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgents);
      expect(response.body.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 20, total: 1, totalPages: 1 })
      );
      expect(mockAgentModel.list).toHaveBeenCalledWith(1, 20, undefined, undefined);
    });

    it('should pass query parameters for filtering', async () => {
      mockAgentModel.list.mockResolvedValue({ agents: [], total: 0 });

      await request(app).get('/api/agents?type=swe&status=active').expect(200);

      expect(mockAgentModel.list).toHaveBeenCalledWith(1, 20, 'swe', 'active');
    });

    it('should map model errors to a 500 INTERNAL_ERROR via the error handler', async () => {
      mockAgentModel.list.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/agents').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/agents/search', () => {
    it('should search agents by query', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'Code Master', type: 'swe', status: 'active' },
      ];

      mockAgentModel.search.mockResolvedValue({ agents: mockAgents, total: 1 });

      const response = await request(app).get('/api/agents/search?q=code').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgents);
      expect(mockAgentModel.search).toHaveBeenCalledWith('code', 1, 20);
    });
  });

  describe('GET /api/agents/types', () => {
    it('should return available agent types', async () => {
      const response = await request(app).get('/api/agents/types').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(['swe', 'gui', 'general', 'orchestrator']);
    });
  });

  describe('GET /api/agents/:id', () => {
    it('should return agent by ID', async () => {
      const mockAgent = { id: 'agent-1', name: 'Code Master', type: 'swe', status: 'active' };
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const response = await request(app).get('/api/agents/agent-1').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgent);
      expect(mockAgentModel.findById).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      mockAgentModel.findById.mockResolvedValue(null);

      const response = await request(app).get('/api/agents/non-existent').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/agents', () => {
    it('should create a new agent with default inactive status', async () => {
      const agentData = {
        name: 'Test Agent',
        type: 'general',
        description: 'A test agent',
        capabilities: ['testing'],
      };

      const mockAgent = {
        ...agentData,
        id: 'new-agent-id',
        status: 'inactive',
        createdAt: new Date().toISOString(),
      };

      mockAgentModel.create.mockResolvedValue(mockAgent);

      const response = await request(app).post('/api/agents').send(agentData).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgent);
      expect(mockAgentModel.create).toHaveBeenCalledWith({
        ...agentData,
        status: 'inactive',
      });
    });

    it('should map model errors during create to a 500 response', async () => {
      mockAgentModel.create.mockRejectedValue(new Error('Agent already exists'));

      const response = await request(app)
        .post('/api/agents')
        .send({ name: 'Code Master', type: 'swe' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/agents/:id', () => {
    it('should update an existing agent', async () => {
      const updateData = { name: 'Updated Agent', description: 'Updated description' };
      const mockAgent = { id: 'agent-1', ...updateData, type: 'swe', status: 'active' };

      mockAgentModel.update.mockResolvedValue(mockAgent);

      const response = await request(app)
        .put('/api/agents/agent-1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgent);
      expect(mockAgentModel.update).toHaveBeenCalledWith('agent-1', updateData);
    });

    it('should return 404 for non-existent agent', async () => {
      mockAgentModel.update.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/agents/non-existent')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/agents/:id/status', () => {
    it('should update agent status', async () => {
      mockAgentModel.updateStatus.mockResolvedValue(true);

      const response = await request(app)
        .patch('/api/agents/agent-1/status')
        .send({ status: 'training' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ id: 'agent-1', status: 'training' });
      expect(mockAgentModel.updateStatus).toHaveBeenCalledWith('agent-1', 'training');
    });

    it('should return 404 when the agent to update is missing', async () => {
      mockAgentModel.updateStatus.mockResolvedValue(false);

      const response = await request(app)
        .patch('/api/agents/non-existent/status')
        .send({ status: 'active' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('should delete an agent', async () => {
      mockAgentModel.delete.mockResolvedValue(true);

      const response = await request(app).delete('/api/agents/agent-1').expect(204);

      expect(response.status).toBe(204);
      expect(mockAgentModel.delete).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      mockAgentModel.delete.mockResolvedValue(false);

      const response = await request(app).delete('/api/agents/non-existent').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('route resolution for /active', () => {
    // GET '/active' is registered before the parameterized GET '/:id', so it
    // resolves through getActiveAgents() rather than being shadowed by ':id'.
    it('routes GET /api/agents/active to getActiveAgents', async () => {
      const activeAgents = [
        { id: 'agent-1', name: 'Code Master', type: 'swe', status: 'active' },
      ];
      mockAgentModel.getActiveAgents.mockResolvedValue(activeAgents);

      const response = await request(app).get('/api/agents/active').expect(200);

      expect(mockAgentModel.getActiveAgents).toHaveBeenCalled();
      expect(mockAgentModel.findById).not.toHaveBeenCalledWith('active');
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(activeAgents);
    });
  });

  describe('Response metadata', () => {
    it('should include request metadata in responses', async () => {
      mockAgentModel.list.mockResolvedValue({ agents: [], total: 0 });

      const response = await request(app)
        .get('/api/agents')
        .set('x-request-id', 'test-request-id')
        .expect(200);

      expect(response.body.metadata).toEqual({
        timestamp: expect.any(String),
        requestId: 'test-request-id',
        version: '1.0.0',
      });
    });
  });
});
