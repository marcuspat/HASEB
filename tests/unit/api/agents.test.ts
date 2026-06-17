import request from 'supertest';
import express from 'express';
import agentsRoutes from '@/api/agents';
import { errorHandler } from '@/middleware/errorHandler';
import { TestDatabase } from '../../helpers/test-db';
import { mockRequest, mockResponse } from '../../helpers/mocks';

// Mock the database models
jest.mock('../../../src/database/models/Agent');

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the middleware
jest.mock('../../../src/middleware/requestLogger', () => ({
  logApiCall: jest.fn((req, res, next) => next()),
}));

jest.mock('../../../src/middleware/validation', () => ({
  validateRequest: jest.fn((schema) => (req: any, res: any, next: any) => next()),
  extractPagination: jest.fn((req, res, next) => {
    req.pagination = { page: 1, limit: 20 };
    next();
  }),
  commonSchemas: {
    pagination: { query: {} },
    search: { query: {} },
    id: { params: {} },
    agentCreate: { body: {} },
  },
}));

jest.mock('../../../src/middleware/errorHandler', () => ({
  asyncHandler: (fn: any) => async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  },
  errorHandler: (err: any, req: any, res: any, next: any) => {
    res.status(500).json({ error: 'Internal server error' });
  },
}));

const mockAgentModel = {
  findById: jest.fn(),
  list: jest.fn(),
  search: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
  getActiveAgents: jest.fn(),
} as any;

const AgentModel = mockAgentModel;

describe('Agents API', () => {
  let app: express.Application;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await testDb.seedTestData();

    // Create express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/agents', agentsRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await testDb.close();
  });

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
          performance: { taskSuccessRate: 0.95 },
          lastActive: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      mockAgentModel.list.mockResolvedValue({
        agents: mockAgents,
        total: 1,
      });

      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockAgents,
        metadata: expect.any(Object),
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: 1,
        }),
      });

      expect(mockAgentModel.list).toHaveBeenCalledWith(1, 20, undefined, undefined);
    });

    it('should handle query parameters for filtering', async () => {
      mockAgentModel.list.mockResolvedValue({
        agents: [],
        total: 0,
      });

      await request(app)
        .get('/api/agents?type=swe&status=active')
        .expect(200);

      expect(mockAgentModel.list).toHaveBeenCalledWith(1, 20, 'swe', 'active');
    });

    it('should handle database errors gracefully', async () => {
      mockAgentModel.list.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/agents')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Database error',
        }),
      });
    });
  });

  describe('GET /api/agents/search', () => {
    it('should search agents by query', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Code Master',
          type: 'swe',
          status: 'active',
        },
      ];

      mockAgentModel.search.mockResolvedValue({
        agents: mockAgents,
        total: 1,
      });

      const response = await request(app)
        .get('/api/agents/search?q=code')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgents);
      expect(mockAgentModel.search).toHaveBeenCalledWith('code', 1, 20);
    });

    it('should validate search query parameter', async () => {
      const response = await request(app)
        .get('/api/agents/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/agents/types', () => {
    it('should return available agent types', async () => {
      const response = await request(app)
        .get('/api/agents/types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(['swe', 'gui', 'general', 'orchestrator']);
    });
  });

  describe('GET /api/agents/:id', () => {
    it('should return agent by ID', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Code Master',
        type: 'swe',
        status: 'active',
      };

      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const response = await request(app)
        .get('/api/agents/agent-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgent);
      expect(mockAgentModel.findById).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      mockAgentModel.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/agents/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/agents', () => {
    it('should create new agent', async () => {
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

      const response = await request(app)
        .post('/api/agents')
        .send(agentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgent);
      expect(mockAgentModel.create).toHaveBeenCalledWith({
        ...agentData,
        status: 'inactive',
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        type: 'general',
        // Missing name
      };

      const response = await request(app)
        .post('/api/agents')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle duplicate agent names', async () => {
      const agentData = {
        name: 'Code Master',
        type: 'swe',
      };

      mockAgentModel.create.mockRejectedValue(new Error('Agent already exists'));

      const response = await request(app)
        .post('/api/agents')
        .send(agentData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('PUT /api/agents/:id', () => {
    it('should update existing agent', async () => {
      const updateData = {
        name: 'Updated Agent',
        description: 'Updated description',
      };

      const mockAgent = {
        id: 'agent-1',
        ...updateData,
        type: 'swe',
        status: 'active',
      };

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
      const statusData = { status: 'training' };

      mockAgentModel.updateStatus.mockResolvedValue(true);

      const response = await request(app)
        .patch('/api/agents/agent-1/status')
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ id: 'agent-1', status: 'training' });
      expect(mockAgentModel.updateStatus).toHaveBeenCalledWith('agent-1', 'training');
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .patch('/api/agents/agent-1/status')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/agents/:id', () => {
    it('should delete agent', async () => {
      mockAgentModel.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/agents/agent-1')
        .expect(204);

      expect(response.status).toBe(204);
      expect(mockAgentModel.delete).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      mockAgentModel.delete.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/agents/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/agents/active', () => {
    it('should return active agents', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Code Master',
          type: 'swe',
          status: 'active',
        },
      ];

      mockAgentModel.getActiveAgents.mockResolvedValue(mockAgents);

      const response = await request(app)
        .get('/api/agents/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgents);
      expect(mockAgentModel.getActiveAgents).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      mockAgentModel.list.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/api/agents')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should include request metadata in responses', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Code Master',
          type: 'swe',
          status: 'active',
        },
      ];

      mockAgentModel.list.mockResolvedValue({
        agents: mockAgents,
        total: 1,
      });

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

    it('should handle rate limiting (if configured)', async () => {
      // This test would typically require rate limiting middleware
      // For now, we just ensure the endpoint responds correctly
      mockAgentModel.list.mockResolvedValue({
        agents: [],
        total: 0,
      });

      // Make multiple rapid requests
      const promises = Array.from({ length: 5 }, () =>
        request(app).get('/api/agents')
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});