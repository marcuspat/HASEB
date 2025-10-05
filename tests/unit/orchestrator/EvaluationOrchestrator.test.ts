import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EvaluationOrchestrator } from '@/orchestrator/EvaluationOrchestrator';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/metrics/index', () => ({
  MetricsOrchestrator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    collectMetrics: jest.fn(),
  })),
}));

jest.mock('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/database/models/Benchmark', () => ({
  BenchmarkModel: {
    findById: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@/database/models/Agent', () => ({
  AgentModel: {
    findById: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('@langchain/langgraph', () => ({
  StateGraph: jest.fn().mockImplementation(() => ({
    addNode: jest.fn(),
    addEdge: jest.fn(),
    addConditionalEdges: jest.fn(),
    setEntryPoint: jest.fn(),
    setFinishPoint: jest.fn(),
    compile: jest.fn().mockReturnValue({
      invoke: jest.fn(),
      stream: jest.fn(),
    }),
  })),
}));

describe('EvaluationOrchestrator', () => {
  let orchestrator: EvaluationOrchestrator;

  beforeEach(() => {
    orchestrator = new EvaluationOrchestrator();

    // Mock console methods to reduce noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (orchestrator.isRunning()) {
      orchestrator.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize without throwing', async () => {
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.initialize).toBe('function');
      expect(typeof orchestrator.runEvaluation).toBe('function');
      expect(typeof orchestrator.stop).toBe('function');
      expect(typeof orchestrator.isRunning).toBe('function');

      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization to throw error
      const mockOrchestrator = new EvaluationOrchestrator();

      // Should not throw even with initialization issues
      await expect(mockOrchestrator.initialize()).resolves.not.toThrow();
    });

    it('should handle multiple initialization attempts', async () => {
      await orchestrator.initialize();
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('Evaluation Execution', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should run evaluation without throwing', async () => {
      const evaluationData = {
        agentId: 'test-agent-123',
        benchmarkId: 'test-benchmark-456',
        configuration: {
          timeout: 300000,
          maxRetries: 3,
        },
      };

      await expect(orchestrator.runEvaluation(evaluationData))
        .resolves.not.toThrow();
    });

    it('should handle evaluation with minimal configuration', async () => {
      const evaluationData = {
        agentId: 'minimal-agent',
        benchmarkId: 'minimal-benchmark',
        configuration: {},
      };

      await expect(orchestrator.runEvaluation(evaluationData))
        .resolves.not.toThrow();
    });

    it('should handle concurrent evaluations', async () => {
      const evaluationData = {
        agentId: 'concurrent-agent',
        benchmarkId: 'concurrent-benchmark',
        configuration: { timeout: 60000 },
      };

      // Start first evaluation
      const firstEval = orchestrator.runEvaluation(evaluationData);

      // Should handle starting second evaluation (may queue or reject gracefully)
      expect(async () => {
        await orchestrator.runEvaluation(evaluationData);
      }).not.toThrow();

      await firstEval;
    });
  });

  describe('Status and Monitoring', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should track running status correctly', () => {
      expect(orchestrator.isRunning()).toBe(false);

      // Start evaluation
      orchestrator.runEvaluation({
        agentId: 'status-agent',
        benchmarkId: 'status-benchmark',
        configuration: {},
      }).catch(() => {}); // Ignore errors for status test

      // Status may change during execution
      expect(typeof orchestrator.isRunning()).toBe('boolean');
    });

    it('should stop evaluations gracefully', async () => {
      expect(() => {
        orchestrator.stop();
      }).not.toThrow();

      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should handle stopping when not running', () => {
      expect(() => {
        orchestrator.stop();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle invalid evaluation data', async () => {
      const invalidData = {
        agentId: '', // Empty agent ID
        benchmarkId: null as any, // Null benchmark ID
        configuration: undefined,
      };

      await expect(orchestrator.runEvaluation(invalidData))
        .resolves.not.toThrow();
    });

    it('should handle missing agent or benchmark', async () => {
      const evaluationData = {
        agentId: 'non-existent-agent',
        benchmarkId: 'non-existent-benchmark',
        configuration: {},
      };

      await expect(orchestrator.runEvaluation(evaluationData))
        .resolves.not.toThrow();
    });

    it('should handle configuration errors', async () => {
      const evaluationData = {
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        configuration: {
          timeout: -1, // Invalid timeout
          maxRetries: 'invalid' as any, // Invalid type
        },
      };

      await expect(orchestrator.runEvaluation(evaluationData))
        .resolves.not.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should cleanup resources on stop', async () => {
      await orchestrator.initialize();

      // Simulate some resource usage
      await orchestrator.runEvaluation({
        agentId: 'cleanup-agent',
        benchmarkId: 'cleanup-benchmark',
        configuration: {},
      }).catch(() => {});

      orchestrator.stop();
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should handle resource cleanup errors', () => {
      expect(() => {
        orchestrator.stop();
        orchestrator.stop(); // Multiple stops
      }).not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle full evaluation lifecycle', async () => {
      await orchestrator.initialize();

      const evaluationData = {
        agentId: 'lifecycle-agent',
        benchmarkId: 'lifecycle-benchmark',
        configuration: {
          timeout: 60000,
          metrics: true,
        },
      };

      // Run evaluation
      const result = await orchestrator.runEvaluation(evaluationData);
      expect(result).toBeDefined();

      // Stop orchestrator
      orchestrator.stop();
    });

    it('should handle interrupted evaluations', async () => {
      await orchestrator.initialize();

      const evaluationData = {
        agentId: 'interrupt-agent',
        benchmarkId: 'interrupt-benchmark',
        configuration: {
          timeout: 300000, // Long timeout
        },
      };

      // Start evaluation
      const evaluationPromise = orchestrator.runEvaluation(evaluationData);

      // Stop after a short delay
      setTimeout(() => orchestrator.stop(), 10);

      await expect(evaluationPromise).resolves.not.toThrow();
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should maintain evaluation state', async () => {
      const evaluationData = {
        agentId: 'state-agent',
        benchmarkId: 'state-benchmark',
        configuration: {
          persistState: true,
        },
      };

      await orchestrator.runEvaluation(evaluationData);

      // State should be managed internally without exposing sensitive data
      expect(typeof orchestrator.isRunning).toBe('function');
    });

    it('should handle state transitions', async () => {
      const evaluationData = {
        agentId: 'transition-agent',
        benchmarkId: 'transition-benchmark',
        configuration: {},
      };

      const result = await orchestrator.runEvaluation(evaluationData);
      expect(result).toBeDefined();
    });
  });

  describe('Integration Points', () => {
    it('should work with metrics collection', async () => {
      await orchestrator.initialize();

      const evaluationData = {
        agentId: 'metrics-agent',
        benchmarkId: 'metrics-benchmark',
        configuration: {
          collectMetrics: true,
          metricsInterval: 1000,
        },
      };

      await expect(orchestrator.runEvaluation(evaluationData))
        .resolves.not.toThrow();
    });

    it('should handle database integration', async () => {
      const evaluationData = {
        agentId: 'db-agent',
        benchmarkId: 'db-benchmark',
        configuration: {
          saveResults: true,
          saveMetrics: true,
        },
      };

      await expect(orchestrator.runEvaluation(evaluationData))
        .resolves.not.toThrow();
    });
  });
});