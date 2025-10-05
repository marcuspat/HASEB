import { describe, it, expect } from '@jest/globals';
import type {
  Agent,
  Evaluation,
  EvaluationMetrics,
  EvaluationLog,
  PerformanceMetrics,
  Benchmark,
  LeaderboardEntry,
  FilterState,
  ChartData,
  ParetoPoint,
  ApiResponse,
  DatabaseConfig,
} from '@/types/index';

describe('Type Definitions', () => {
  describe('Agent', () => {
    it('should accept valid Agent data', () => {
      const agent: Agent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'language-model',
        status: 'active',
        capabilities: ['code-generation', 'text-analysis'],
        performance: {
          taskSuccessRate: 0.95,
          executionTime: 5000,
          latencyPerStep: 500,
          totalSteps: 10,
          totalTokens: 1000,
          estimatedCost: 0.05,
          toolCallErrorRate: 0.02,
          recoveryRate: 0.98,
          toolSelectionAccuracy: 0.92,
          parameterAccuracy: 0.88,
        },
        lastActive: '2024-01-15T10:30:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(agent.id).toBe('agent-123');
      expect(agent.name).toBe('Test Agent');
      expect(agent.status).toBe('active');
    });

    it('should accept all valid status values', () => {
      const validStatuses: Agent['status'][] = ['active', 'idle', 'busy', 'error'];

      validStatuses.forEach(status => {
        const agent: Agent = {
          id: 'agent-123',
          name: 'Test Agent',
          type: 'test',
          status,
          capabilities: [],
          performance: {
            taskSuccessRate: 0.5,
            executionTime: 1000,
            latencyPerStep: 100,
            totalSteps: 1,
            totalTokens: 100,
            estimatedCost: 0.01,
            toolCallErrorRate: 0.1,
            recoveryRate: 0.9,
            toolSelectionAccuracy: 0.8,
            parameterAccuracy: 0.8,
          },
          lastActive: '2024-01-15T10:30:00Z',
          createdAt: '2024-01-01T00:00:00Z',
        };
        expect(agent.status).toBe(status);
      });
    });
  });

  describe('Evaluation', () => {
    it('should accept valid Evaluation data', () => {
      const evaluation: Evaluation = {
        id: 'eval-123',
        agentId: 'agent-123',
        benchmarkId: 'benchmark-456',
        status: 'running',
        startTime: new Date('2024-01-15T10:00:00Z'),
        configuration: {
          timeout: 30000,
          environment: 'test',
        },
        logs: [],
        metrics: {
          taskSuccessRate: 0.8,
          executionTime: 10000,
          latencyPerStep: 1000,
          totalSteps: 10,
          totalTokens: 2000,
          estimatedCost: 0.1,
          toolCallErrorRate: 0.05,
          recoveryRate: 0.95,
          toolSelectionAccuracy: 0.9,
          parameterAccuracy: 0.85,
        },
      };

      expect(evaluation.id).toBe('eval-123');
      expect(evaluation.status).toBe('running');
      expect(evaluation.configuration.timeout).toBe(30000);
    });

    it('should accept all valid status values', () => {
      const validStatuses: Evaluation['status'][] = ['pending', 'running', 'completed', 'failed', 'cancelled'];

      validStatuses.forEach(status => {
        const evaluation: Evaluation = {
          id: 'eval-123',
          agentId: 'agent-123',
          benchmarkId: 'benchmark-456',
          status,
          configuration: {},
          logs: [],
        };
        expect(evaluation.status).toBe(status);
      });
    });

    it('should handle optional fields', () => {
      const evaluation: Evaluation = {
        id: 'eval-123',
        agentId: 'agent-123',
        benchmarkId: 'benchmark-456',
        status: 'pending',
        configuration: {},
        logs: [],
      };

      expect(evaluation.startTime).toBeUndefined();
      expect(evaluation.endTime).toBeUndefined();
      expect(evaluation.metrics).toBeUndefined();
    });
  });

  describe('EvaluationLog', () => {
    it('should accept valid EvaluationLog data', () => {
      const log: EvaluationLog = {
        id: 'log-123',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        level: 'info',
        message: 'Task completed successfully',
        source: 'execution-engine',
        metadata: {
          taskId: 'task-456',
          duration: 5000,
        },
      };

      expect(log.id).toBe('log-123');
      expect(log.level).toBe('info');
      expect(log.metadata?.taskId).toBe('task-456');
    });

    it('should accept all valid log levels', () => {
      const validLevels: EvaluationLog['level'][] = ['debug', 'info', 'warn', 'error'];

      validLevels.forEach(level => {
        const log: EvaluationLog = {
          id: 'log-123',
          timestamp: new Date(),
          level,
          message: 'Test message',
          source: 'test',
        };
        expect(log.level).toBe(level);
      });
    });

    it('should handle optional metadata', () => {
      const log: EvaluationLog = {
        id: 'log-123',
        timestamp: new Date(),
        level: 'info',
        message: 'Simple log message',
        source: 'test',
      };

      expect(log.metadata).toBeUndefined();
    });
  });

  describe('Benchmark', () => {
    it('should accept valid Benchmark data', () => {
      const benchmark: Benchmark = {
        id: 'benchmark-123',
        name: 'SWE-bench Test Suite',
        type: 'swe-bench',
        description: 'Software engineering benchmark',
        totalTasks: 100,
        completedTasks: 75,
        difficulty: 'medium',
        isActive: true,
        lastRun: '2024-01-15T08:00:00Z',
      };

      expect(benchmark.id).toBe('benchmark-123');
      expect(benchmark.type).toBe('swe-bench');
      expect(benchmark.completedTasks).toBe(75);
      expect(benchmark.totalTasks).toBe(100);
    });

    it('should accept all valid benchmark types', () => {
      const validTypes: Benchmark['type'][] = ['swe-bench', 'gaia', 'osworld', 'webarena', 'agentbench'];

      validTypes.forEach(type => {
        const benchmark: Benchmark = {
          id: 'benchmark-123',
          name: 'Test Benchmark',
          type,
          description: 'Test description',
          totalTasks: 10,
          completedTasks: 5,
          difficulty: 'easy',
          isActive: false,
        };
        expect(benchmark.type).toBe(type);
      });
    });

    it('should accept all valid difficulty levels', () => {
      const validDifficulties: Benchmark['difficulty'][] = ['easy', 'medium', 'hard', 'expert'];

      validDifficulties.forEach(difficulty => {
        const benchmark: Benchmark = {
          id: 'benchmark-123',
          name: 'Test Benchmark',
          type: 'swe-bench',
          description: 'Test description',
          totalTasks: 10,
          completedTasks: 5,
          difficulty,
          isActive: false,
        };
        expect(benchmark.difficulty).toBe(difficulty);
      });
    });

    it('should handle optional lastRun', () => {
      const benchmark: Benchmark = {
        id: 'benchmark-123',
        name: 'Test Benchmark',
        type: 'swe-bench',
        description: 'Test description',
        totalTasks: 10,
        completedTasks: 5,
        difficulty: 'easy',
        isActive: false,
      };

      expect(benchmark.lastRun).toBeUndefined();
    });
  });

  describe('LeaderboardEntry', () => {
    it('should accept valid LeaderboardEntry data', () => {
      const agent: Agent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'language-model',
        status: 'active',
        capabilities: [],
        performance: {
          taskSuccessRate: 0.9,
          executionTime: 5000,
          latencyPerStep: 500,
          totalSteps: 10,
          totalTokens: 1000,
          estimatedCost: 0.05,
          toolCallErrorRate: 0.02,
          recoveryRate: 0.98,
          toolSelectionAccuracy: 0.92,
          parameterAccuracy: 0.88,
        },
        lastActive: '2024-01-15T10:30:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const benchmark: Benchmark = {
        id: 'benchmark-456',
        name: 'Test Benchmark',
        type: 'swe-bench',
        description: 'Test description',
        totalTasks: 100,
        completedTasks: 80,
        difficulty: 'medium',
        isActive: true,
      };

      const entry: LeaderboardEntry = {
        rank: 1,
        agent,
        metrics: agent.performance,
        benchmark,
        overallScore: 92.5,
        trend: 'up',
      };

      expect(entry.rank).toBe(1);
      expect(entry.overallScore).toBe(92.5);
      expect(entry.trend).toBe('up');
    });

    it('should accept all valid trend values', () => {
      const validTrends: LeaderboardEntry['trend'][] = ['up', 'down', 'stable'];

      validTrends.forEach(trend => {
        const entry: LeaderboardEntry = {
          rank: 1,
          agent: {} as Agent,
          metrics: {} as PerformanceMetrics,
          benchmark: {} as Benchmark,
          overallScore: 85,
          trend,
        };
        expect(entry.trend).toBe(trend);
      });
    });
  });

  describe('FilterState', () => {
    it('should accept valid FilterState data', () => {
      const filterState: FilterState = {
        benchmarkType: 'swe-bench',
        agentType: 'language-model',
        status: 'completed',
        difficulty: 'medium',
        dateRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      expect(filterState.benchmarkType).toBe('swe-bench');
      expect(filterState.dateRange.start).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('ChartData', () => {
    it('should accept valid ChartData', () => {
      const chartData: ChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [
          {
            label: 'Success Rate',
            data: [85, 88, 92, 90],
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            tension: 0.4,
          },
          {
            label: 'Efficiency',
            data: [75, 82, 85, 88],
          },
        ],
      };

      expect(chartData.labels).toHaveLength(4);
      expect(chartData.datasets).toHaveLength(2);
      expect(chartData.datasets[0].data[0]).toBe(85);
    });
  });

  describe('ParetoPoint', () => {
    it('should accept valid ParetoPoint', () => {
      const point: ParetoPoint = {
        accuracy: 0.92,
        cost: 0.15,
        agentName: 'Test Agent',
        agentId: 'agent-123',
        isParetoOptimal: true,
      };

      expect(point.accuracy).toBe(0.92);
      expect(point.cost).toBe(0.15);
      expect(point.isParetoOptimal).toBe(true);
    });
  });

  describe('ApiResponse', () => {
    it('should accept successful response', () => {
      const response: ApiResponse<string> = {
        success: true,
        data: 'Operation completed successfully',
        metadata: {
          timestamp: new Date(),
          requestId: 'req-123',
          version: '1.0.0',
        },
      };

      expect(response.success).toBe(true);
      expect(response.data).toBe('Operation completed successfully');
      expect(response.metadata?.requestId).toBe('req-123');
    });

    it('should accept error response', () => {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          timestamp: new Date(),
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'req-123',
        },
      };

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.data).toBeUndefined();
    });

    it('should handle minimal response', () => {
      const response: ApiResponse = {
        success: true,
      };

      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
      expect(response.error).toBeUndefined();
      expect(response.metadata).toBeUndefined();
    });
  });

  describe('DatabaseConfig', () => {
    it('should accept complete DatabaseConfig', () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'haseb_test',
        username: 'test_user',
        password: 'test_password',
        ssl: true,
        connectionTimeout: 30000,
        maxConnections: 20,
      };

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.ssl).toBe(true);
      expect(config.maxConnections).toBe(20);
    });

    it('should accept minimal DatabaseConfig', () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'haseb_test',
        username: 'test_user',
        password: 'test_password',
      };

      expect(config.ssl).toBeUndefined();
      expect(config.connectionTimeout).toBeUndefined();
      expect(config.maxConnections).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('should enforce number ranges for metrics', () => {
      const validMetrics: PerformanceMetrics = {
        taskSuccessRate: 0.95, // Valid: 0-1
        executionTime: 5000, // Valid: positive number
        latencyPerStep: 500, // Valid: positive number
        totalSteps: 10, // Valid: positive integer
        totalTokens: 1000, // Valid: positive integer
        estimatedCost: 0.05, // Valid: positive number
        toolCallErrorRate: 0.02, // Valid: 0-1
        recoveryRate: 0.98, // Valid: 0-1
        toolSelectionAccuracy: 0.92, // Valid: 0-1
        parameterAccuracy: 0.88, // Valid: 0-1
      };

      expect(validMetrics.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(validMetrics.taskSuccessRate).toBeLessThanOrEqual(1);
    });

    it('should handle complex nested objects', () => {
      const complexEvaluation: Evaluation = {
        id: 'eval-complex',
        agentId: 'agent-123',
        benchmarkId: 'benchmark-456',
        status: 'completed',
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T10:30:00Z'),
        configuration: {
          timeout: 3600000,
          maxRetries: 3,
          environment: {
            name: 'test-env',
            version: '1.0.0',
            resources: {
              cpu: '2 cores',
              memory: '4GB',
              storage: '10GB',
            },
          },
          features: ['feature1', 'feature2'],
        },
        logs: [
          {
            id: 'log-1',
            timestamp: new Date('2024-01-15T09:00:00Z'),
            level: 'info',
            message: 'Evaluation started',
            source: 'orchestrator',
            metadata: {
              evaluationId: 'eval-complex',
              configurationHash: 'abc123',
            },
          },
          {
            id: 'log-2',
            timestamp: new Date('2024-01-15T10:30:00Z'),
            level: 'info',
            message: 'Evaluation completed',
            source: 'orchestrator',
            metadata: {
              evaluationId: 'eval-complex',
              duration: 5400000,
            },
          },
        ],
      };

      expect(complexEvaluation.configuration.environment?.resources.cpu).toBe('2 cores');
      expect(complexEvaluation.logs).toHaveLength(2);
      expect(complexEvaluation.logs[0].metadata?.evaluationId).toBe('eval-complex');
    });
  });
});