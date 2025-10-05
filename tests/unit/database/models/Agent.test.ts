import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the pg module to prevent database connections
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  })),
  PoolClient: jest.fn(),
}));

// Mock logger to prevent actual logging during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the database connection module more completely
const mockQuery = jest.fn();

jest.mock('@/database/connection', () => {
  const mockDb = {
    query: mockQuery,
    getClient: jest.fn(),
    transaction: jest.fn(),
    testConnection: jest.fn(),
    close: jest.fn(),
    getPoolStats: jest.fn(),
  };

  return {
    DatabaseConnection: jest.fn().mockImplementation(() => mockDb),
    db: mockDb,
  };
});

// Import after mocking
import { AgentModel } from '@/database/models/Agent';

describe('AgentModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new agent successfully', async () => {
      const agentData = {
        name: 'Test Agent',
        type: 'language-model',
        description: 'A test agent for testing',
        capabilities: ['code-generation', 'text-analysis'],
        configuration: { model: 'gpt-4', temperature: 0.7 },
        status: 'active',
      };

      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Test Agent',
          type: 'language-model',
          description: 'A test agent for testing',
          capabilities: ['code-generation', 'text-analysis'],
          configuration: { model: 'gpt-4', temperature: 0.7 },
          status: 'active',
          created_at: new Date('2024-01-15T10:30:00Z'),
          updated_at: new Date('2024-01-15T10:30:00Z'),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.create(agentData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        ['Test Agent', 'language-model', 'A test agent for testing', ['code-generation', 'text-analysis'], { model: 'gpt-4', temperature: 0.7 }, 'active']
      );
      expect(result).toEqual({
        id: 'agent-123',
        name: 'Test Agent',
        type: 'language-model',
        description: 'A test agent for testing',
        capabilities: ['code-generation', 'text-analysis'],
        configuration: { model: 'gpt-4', temperature: 0.7 },
        status: 'active',
        createdAt: new Date('2024-01-15T10:30:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z'),
      });
    });

    it('should handle database errors during creation', async () => {
      const agentData = {
        name: 'Test Agent',
        type: 'language-model',
        description: 'A test agent for testing',
        capabilities: ['code-generation'],
        configuration: {},
        status: 'active',
      };

      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(AgentModel.create(agentData)).rejects.toThrow('Database connection failed');
    });

    it('should create agent with default values', async () => {
      const agentData = {
        name: 'Minimal Agent',
        type: 'test',
        description: '',
        capabilities: [],
        configuration: {},
        status: 'active',
      };

      const mockResult = {
        rows: [{
          id: 'agent-456',
          ...agentData,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.create(agentData);

      expect(result.id).toBe('agent-456');
      expect(result.name).toBe('Minimal Agent');
    });
  });

  describe('findById', () => {
    it('should find agent by ID successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Test Agent',
          type: 'language-model',
          description: 'A test agent',
          capabilities: ['code-generation'],
          configuration: {},
          status: 'active',
          created_at: new Date('2024-01-15T10:30:00Z'),
          updated_at: new Date('2024-01-15T10:30:00Z'),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.findById('agent-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE id = $1',
        ['agent-123']
      );
      expect(result?.id).toBe('agent-123');
      expect(result?.name).toBe('Test Agent');
    });

    it('should return null when agent not found', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors during find', async () => {
      mockQuery.mockRejectedValue(new Error('Database query failed'));

      await expect(AgentModel.findById('agent-123')).rejects.toThrow('Database query failed');
    });
  });

  describe('findByType', () => {
    it('should find agents by type successfully', async () => {
      const mockResult = {
        rows: [
          {
            id: 'agent-1',
            name: 'Agent 1',
            type: 'language-model',
            description: 'First agent',
            capabilities: [],
            configuration: {},
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'agent-2',
            name: 'Agent 2',
            type: 'language-model',
            description: 'Second agent',
            capabilities: [],
            configuration: {},
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 2,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.findByType('language-model');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE type = $1 ORDER BY created_at DESC',
        ['language-model']
      );
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('language-model');
    });

    it('should return empty array when no agents found', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.findByType('nonexistent-type');

      expect(result).toEqual([]);
    });
  });

  describe('findByStatus', () => {
    it('should find agents by status successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-1',
          name: 'Active Agent',
          type: 'language-model',
          description: 'An active agent',
          capabilities: [],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.findByStatus('active');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE status = $1 ORDER BY created_at DESC',
        ['active']
      );
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });
  });

  describe('findByCapability', () => {
    it('should find agents by capability successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-1',
          name: 'Code Agent',
          type: 'language-model',
          description: 'A code generation agent',
          capabilities: ['code-generation', 'text-analysis'],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.findByCapability('code-generation');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE $1 = ANY(capabilities) ORDER BY created_at DESC',
        ['code-generation']
      );
      expect(result).toHaveLength(1);
      expect(result[0].capabilities).toContain('code-generation');
    });
  });

  describe('list', () => {
    it('should return paginated list of agents', async () => {
      const mockResult = {
        rows: [
          {
            id: 'agent-1',
            name: 'Agent 1',
            type: 'language-model',
            description: 'First agent',
            capabilities: [],
            configuration: {},
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'agent-2',
            name: 'Agent 2',
            type: 'test',
            description: 'Second agent',
            capabilities: [],
            configuration: {},
            status: 'idle',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 2,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.list(1, 10);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [10, 0]
      );
      expect(result).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-1',
          name: 'Filtered Agent',
          type: 'language-model',
          description: 'Filtered agent',
          capabilities: [],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.list(1, 10, { type: 'language-model' });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE type = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        ['language-model', 10, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-1',
          name: 'Active Agent',
          type: 'language-model',
          description: 'Active agent',
          capabilities: [],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.list(1, 10, { status: 'active' });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        ['active', 10, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should handle empty results', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.list(1, 10);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update agent successfully', async () => {
      const updateData = {
        name: 'Updated Agent',
        description: 'Updated description',
        configuration: { newSetting: true },
      };

      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Updated Agent',
          type: 'language-model',
          description: 'Updated description',
          capabilities: ['code-generation'],
          configuration: { newSetting: true },
          status: 'active',
          created_at: new Date('2024-01-15T10:30:00Z'),
          updated_at: new Date('2024-01-15T11:00:00Z'),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.update('agent-123', updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agents SET'),
        expect.arrayContaining(['Updated Agent', 'Updated description', { newSetting: true }, 'agent-123'])
      );
      expect(result?.name).toBe('Updated Agent');
      expect(result?.description).toBe('Updated description');
    });

    it('should handle partial updates', async () => {
      const updateData = {
        name: 'New Name Only',
      };

      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'New Name Only',
          type: 'language-model',
          description: 'Original description',
          capabilities: [],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.update('agent-123', updateData);

      expect(result?.name).toBe('New Name Only');
    });

    it('should return null when updating nonexistent agent', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.update('nonexistent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should return original agent when no updates provided', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Original Agent',
          type: 'language-model',
          description: 'Original description',
          capabilities: [],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.update('agent-123', {});

      expect(result?.name).toBe('Original Agent');
    });
  });

  describe('updateStatus', () => {
    it('should update agent status successfully', async () => {
      const mockResult = {
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.updateStatus('agent-123', 'inactive');

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['inactive', 'agent-123']
      );
      expect(result).toBe(true);
    });

    it('should return false for nonexistent agent', async () => {
      const mockResult = {
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.updateStatus('nonexistent', 'inactive');

      expect(result).toBe(false);
    });
  });

  describe('updateConfiguration', () => {
    it('should update agent configuration successfully', async () => {
      const newConfig = { model: 'gpt-4-turbo', temperature: 0.5 };
      const mockResult = {
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.updateConfiguration('agent-123', newConfig);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE agents SET configuration = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newConfig, 'agent-123']
      );
      expect(result).toBe(true);
    });

    it('should return false for nonexistent agent', async () => {
      const mockResult = {
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.updateConfiguration('nonexistent', {});

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete agent successfully', async () => {
      const mockResult = {
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.delete('agent-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM agents WHERE id = $1',
        ['agent-123']
      );
      expect(result).toBe(true);
    });

    it('should return false when deleting nonexistent agent', async () => {
      const mockResult = {
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getActiveAgents', () => {
    it('should return only active agents', async () => {
      const mockResult = {
        rows: [
          {
            id: 'agent-1',
            name: 'Active Agent 1',
            type: 'language-model',
            description: 'First active agent',
            capabilities: [],
            configuration: {},
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'agent-2',
            name: 'Active Agent 2',
            type: 'test',
            description: 'Second active agent',
            capabilities: [],
            configuration: {},
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 2,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.getActiveAgents();

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE status = $1 ORDER BY created_at DESC',
        ['active']
      );
      expect(result).toHaveLength(2);
      result.forEach(agent => {
        expect(agent.status).toBe('active');
      });
    });

    it('should return empty array when no active agents', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.getActiveAgents();

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('should search agents by name and description', async () => {
      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Search Test Agent',
          type: 'language-model',
          description: 'An agent for search testing',
          capabilities: [],
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.search('search test');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, type, description, capabilities, configuration, status, created_at, updated_at FROM agents WHERE name ILIKE $1 OR description ILIKE $2 ORDER BY created_at DESC',
        ['%search test%', '%search test%']
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toContain('Search Test');
    });

    it('should return empty for no matches', async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.search('nonexistent term');

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValue(new Error('Connection lost'));

      await expect(AgentModel.findById('agent-123')).rejects.toThrow('Connection lost');
    });

    it('should handle constraint violations', async () => {
      mockQuery.mockRejectedValue(new Error('Duplicate key value'));

      await expect(AgentModel.create({
        name: 'Duplicate Agent',
        type: 'language-model',
        description: 'Should fail',
        capabilities: [],
        configuration: {},
        status: 'active',
      })).rejects.toThrow('Duplicate key value');
    });
  });

  describe('Data Validation', () => {
    it('should handle complex configuration objects', async () => {
      const complexConfig = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        settings: {
          enableCodeGeneration: true,
          enableTextAnalysis: false,
          nested: {
            deep: {
              value: 'test',
            },
          },
        },
      };

      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Complex Agent',
          type: 'language-model',
          description: 'Agent with complex config',
          capabilities: ['code-generation'],
          configuration: complexConfig,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.create({
        name: 'Complex Agent',
        type: 'language-model',
        description: 'Agent with complex config',
        capabilities: ['code-generation'],
        configuration: complexConfig,
        status: 'active',
      });

      expect(result.configuration).toEqual(complexConfig);
    });

    it('should handle large capability arrays', async () => {
      const manyCapabilities = Array.from({ length: 100 }, (_, i) => `capability-${i}`);

      const mockResult = {
        rows: [{
          id: 'agent-123',
          name: 'Multi-capability Agent',
          type: 'language-model',
          description: 'Agent with many capabilities',
          capabilities: manyCapabilities,
          configuration: {},
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      };

      mockQuery.mockResolvedValue(mockResult);

      const result = await AgentModel.create({
        name: 'Multi-capability Agent',
        type: 'language-model',
        description: 'Agent with many capabilities',
        capabilities: manyCapabilities,
        configuration: {},
        status: 'active',
      });

      expect(result.capabilities).toHaveLength(100);
      expect(result.capabilities[0]).toBe('capability-0');
      expect(result.capabilities[99]).toBe('capability-99');
    });
  });
});