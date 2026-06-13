import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EvaluationOrchestrator } from '@/orchestrator/EvaluationOrchestrator';
import { MetricsOrchestrator } from '@/services/metrics/MetricsOrchestrator';
import { MetricsCollectionContext } from '@/types/metrics';
import { EvaluationModel } from '@/database/models/Evaluation';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';

// Mock the database models
jest.mock('../../src/database/models/Evaluation');
jest.mock('../../src/database/models/Agent');
jest.mock('../../src/database/models/Benchmark');

describe('Evaluation Metrics Integration Tests', () => {
  let evaluationOrchestrator: EvaluationOrchestrator;
  let metricsOrchestrator: MetricsOrchestrator;
  let context: MetricsCollectionContext;
  let mockEvaluation: any;
  let mockAgent: any;
  let mockBenchmark: any;

  beforeEach(async () => {
    // Setup test context
    context = {
      evaluationId: 'test-eval-123',
      agentId: 'test-agent-456',
      benchmarkId: 'test-benchmark-789',
      sessionId: 'test-session-001',
      startTime: new Date(),
      configuration: { timeout: 30000 },
      environment: {
        platform: 'linux',
        version: '18.0.0',
        resources: { cpu: '4 cores', memory: '8GB', storage: '100GB' }
      }
    };

    // Create mock data
    mockAgent = {
      id: 'test-agent-456',
      name: 'Test Agent',
      type: 'swe',
      status: 'active',
      capabilities: ['code-generation', 'debugging'],
      performance: {
        taskSuccessRate: 0.95,
        executionTime: 1200,
        latencyPerStep: 150,
        totalSteps: 8,
        totalTokens: 2500,
        estimatedCost: 0.025,
        toolCallErrorRate: 0.05,
        recoveryRate: 0.98,
        toolSelectionAccuracy: 0.92,
        parameterAccuracy: 0.89,
      },
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    mockBenchmark = {
      id: 'test-benchmark-789',
      name: 'SWE-Bench Test',
      type: 'swe-bench',
      description: 'Test benchmark for software engineering',
      totalTasks: 50,
      completedTasks: 45,
      difficulty: 'medium',
      isActive: true,
      lastRun: new Date().toISOString()
    };

    mockEvaluation = {
      id: 'test-eval-123',
      agentId: 'test-agent-456',
      benchmarkId: 'test-benchmark-789',
      status: 'completed',
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      configuration: { timeout: 30000 },
      logs: ['Evaluation completed successfully'],
      metrics: {
        performance: {
          taskSuccessRate: 0.85,
          tasksCompleted: 42,
          tasksTotal: 50,
          executionTime: 45000
        },
        efficiency: {
          totalSteps: 15,
          latencyPerStep: 3000,
          averageMemoryUsage: 256
        },
        cost: {
          totalTokens: 8000,
          estimatedCost: 0.15
        },
        robustness: {
          toolCallErrorRate: 0.05,
          recoveryRate: 0.92
        },
        quality: {
          toolSelectionAccuracy: 0.88,
          parameterAccuracy: 0.85
        }
      }
    };

    // Mock database methods
    (AgentModel.findById as jest.Mock).mockResolvedValue(mockAgent);
    (BenchmarkModel.findById as jest.Mock).mockResolvedValue(mockBenchmark);
    (EvaluationModel.create as jest.Mock).mockResolvedValue(mockEvaluation);
    (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);
    (EvaluationModel.updateMetrics as jest.Mock).mockResolvedValue(true);

    // Create orchestrators
    evaluationOrchestrator = new EvaluationOrchestrator();
    metricsOrchestrator = new MetricsOrchestrator(context);

    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();

    // Initialize orchestrators
    await evaluationOrchestrator.initialize();
    await metricsOrchestrator.start();
  });

  afterEach(async () => {
    await evaluationOrchestrator.cleanup();
    await metricsOrchestrator.cleanup();
    jest.restoreAllMocks();
  });

  describe('Evaluation with Metrics Integration', () => {
    it('should execute evaluation with comprehensive metrics collection', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 30000 }
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.agentId).toBe('test-agent-456');
      expect(result.benchmarkId).toBe('test-benchmark-789');
      expect(result.status).toMatch(/completed|failed/);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.logs).toBeDefined();
      expect(result.metrics).toBeDefined();

      // Verify database interactions
      expect(AgentModel.findById).toHaveBeenCalledWith('test-agent-456');
      expect(BenchmarkModel.findById).toHaveBeenCalledWith('test-benchmark-789');
      expect(EvaluationModel.create).toHaveBeenCalled();
      expect(EvaluationModel.updateStatusWithTime).toHaveBeenCalled();
      expect(EvaluationModel.updateMetrics).toHaveBeenCalled();
    });

    it('should collect metrics throughout evaluation lifecycle', async () => {
      // Mock metrics collection methods
      const mockCollectMetrics = jest.spyOn(evaluationOrchestrator as any, 'collectMetrics');
      const mockGetMetricsSummary = jest.spyOn(evaluationOrchestrator, 'getMetricsSummary');

      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 } // Short timeout for faster test
      );

      expect(result).toBeDefined();
      expect(mockCollectMetrics).toHaveBeenCalled();
      expect(mockGetMetricsSummary).toHaveBeenCalled();
    });

    it('should handle evaluation failures with metrics collection', async () => {
      // Mock agent not found
      (AgentModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        evaluationOrchestrator.executeEvaluation('invalid-agent', 'test-benchmark-789')
      ).rejects.toThrow('Agent not found: invalid-agent');

      // Verify database was still used
      expect(AgentModel.findById).toHaveBeenCalledWith('invalid-agent');
    });

    it('should record metrics for evaluation steps', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);

      // Check that evaluation steps were logged
      const stepLogs = result.logs.filter((log: string) =>
        log.includes('Setup completed') ||
        log.includes('Evaluation executed') ||
        log.includes('Metrics collected') ||
        log.includes('Results analyzed') ||
        log.includes('Cleanup completed')
      );

      expect(stepLogs.length).toBeGreaterThan(0);
    });

    it('should validate evaluation results', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result).toBeDefined();

      // Validate result structure
      expect(typeof result.id).toBe('string');
      expect(typeof result.agentId).toBe('string');
      expect(typeof result.benchmarkId).toBe('string');
      expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(result.status);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(Array.isArray(result.logs)).toBe(true);
      expect(typeof result.metrics).toBe('object');
    });
  });

  describe('Metrics Collection During Evaluation', () => {
    it('should track performance metrics during evaluation', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics.performance).toBeDefined();
      expect(result.metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.performance.taskSuccessRate).toBeLessThanOrEqual(1);
    });

    it('should track efficiency metrics during evaluation', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics.efficiency).toBeDefined();
      expect(result.metrics.efficiency.executionTime).toBeGreaterThan(0);
      expect(result.metrics.efficiency.totalSteps).toBeGreaterThan(0);
    });

    it('should track cost metrics during evaluation', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics.cost).toBeDefined();
      expect(result.metrics.cost.totalTokens).toBeGreaterThanOrEqual(0);
      expect(result.metrics.cost.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('should track robustness metrics during evaluation', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics.robustness).toBeDefined();
      expect(result.metrics.robustness.toolCallErrorRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.robustness.recoveryRate).toBeGreaterThanOrEqual(0);
    });

    it('should track quality metrics during evaluation', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics.quality).toBeDefined();
      expect(result.metrics.quality.toolSelectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(result.metrics.quality.parameterAccuracy).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-time Metrics Updates', () => {
    it('should provide real-time metrics during evaluation', async () => {
      // Start evaluation in background
      const evaluationPromise = evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 5000 }
      );

      // Check status during evaluation
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentEvaluation = evaluationOrchestrator.getCurrentEvaluation();
      expect(currentEvaluation).toBeDefined();
      expect(currentEvaluation?.status).toMatch(/running|completed|failed/);

      // Get metrics summary
      const metricsSummary = await evaluationOrchestrator.getMetricsSummary();
      expect(metricsSummary).toBeDefined();

      // Wait for completion
      const result = await evaluationPromise;
      expect(result).toBeDefined();
    });

    it('should handle concurrent metrics requests', async () => {
      const evaluationPromise = evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 3000 }
      );

      // Make concurrent requests
      const metricsRequests = Array.from({ length: 5 }, () =>
        evaluationOrchestrator.getMetricsSummary()
      );

      const results = await Promise.all(metricsRequests);
      results.forEach(summary => {
        expect(summary).toBeDefined();
      });

      await evaluationPromise;
    });

    it('should force metrics collection on demand', async () => {
      const evaluationPromise = evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 3000 }
      );

      // Force metrics collection
      await evaluationOrchestrator.collectMetrics();

      const metricsSummary = await evaluationOrchestrator.getMetricsSummary();
      expect(metricsSummary).toBeDefined();

      await evaluationPromise;
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      (EvaluationModel.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        evaluationOrchestrator.executeEvaluation('test-agent-456', 'test-benchmark-789')
      ).rejects.toThrow('Database connection failed');

      // Should still clean up properly
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);
    });

    it('should handle metrics collection errors', async () => {
      // Mock metrics collection error
      const mockError = new Error('Metrics collection failed');
      jest.spyOn(evaluationOrchestrator as any, 'simulateEvaluationStep').mockImplementation(() => {
        throw mockError;
      });

      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('failed');
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain(mockError.message);
    });

    it('should handle concurrent evaluation attempts', async () => {
      const evaluationPromise1 = evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 2000 }
      );

      // Second evaluation should be rejected
      await expect(
        evaluationOrchestrator.executeEvaluation('test-agent-456', 'test-benchmark-789')
      ).rejects.toThrow('Another evaluation is already running');

      await evaluationPromise1;
    });

    it('should cleanup resources on evaluation failure', async () => {
      // Mock evaluation failure
      (AgentModel.findById as jest.Mock).mockRejectedValue(new Error('Agent lookup failed'));

      await expect(
        evaluationOrchestrator.executeEvaluation('test-agent-456', 'test-benchmark-789')
      ).rejects.toThrow();

      // Should cleanup properly
      expect(evaluationOrchestrator.getCurrentEvaluation()).toBeUndefined();
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple sequential evaluations', async () => {
      const evaluations = [];

      for (let i = 0; i < 3; i++) {
        const result = await evaluationOrchestrator.executeEvaluation(
          'test-agent-456',
          'test-benchmark-789',
          { timeout: 500 }
        );
        evaluations.push(result);
      }

      expect(evaluations).toHaveLength(3);
      evaluations.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.agentId).toBe('test-agent-456');
        expect(result.benchmarkId).toBe('test-benchmark-789');
      });
    });

    it('should handle large configuration objects', async () => {
      const largeConfig = {
        timeout: 1000,
        parameters: {
          ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`param${i}`, `value${i}`]))
        },
        settings: {
          nested: {
            ...Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`nested${i}`, i]))
          }
        }
      };

      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        largeConfig
      );

      expect(result).toBeDefined();
      expect(result.configuration).toBeDefined();
    });

    it('should handle evaluation timeouts', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1 } // Very short timeout
      );

      expect(result).toBeDefined();
      // Should complete quickly due to timeout
      expect(result.endTime!.getTime() - result.startTime!.getTime()).toBeLessThan(1000);
    });
  });

  describe('Data Validation and Integrity', () => {
    it('should validate evaluation inputs', async () => {
      // Test invalid agent ID
      (AgentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        evaluationOrchestrator.executeEvaluation('', 'test-benchmark-789')
      ).rejects.toThrow();

      // Test invalid benchmark ID
      (AgentModel.findById as jest.Mock).mockResolvedValue(mockAgent);
      (BenchmarkModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        evaluationOrchestrator.executeEvaluation('test-agent-456', '')
      ).rejects.toThrow();
    });

    it('should validate metrics data', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result.metrics).toBeDefined();

      // Validate performance metrics
      if (result.metrics.performance) {
        expect(result.metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.performance.taskSuccessRate).toBeLessThanOrEqual(1);
        expect(result.metrics.performance.tasksCompleted).toBeGreaterThanOrEqual(0);
        expect(result.metrics.performance.tasksTotal).toBeGreaterThanOrEqual(0);
      }

      // Validate efficiency metrics
      if (result.metrics.efficiency) {
        expect(result.metrics.efficiency.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metrics.efficiency.totalSteps).toBeGreaterThanOrEqual(0);
      }

      // Validate cost metrics
      if (result.metrics.cost) {
        expect(result.metrics.cost.totalTokens).toBeGreaterThanOrEqual(0);
        expect(result.metrics.cost.estimatedCost).toBeGreaterThanOrEqual(0);
      }

      // Validate robustness metrics
      if (result.metrics.robustness) {
        expect(result.metrics.robustness.toolCallErrorRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.robustness.toolCallErrorRate).toBeLessThanOrEqual(1);
        expect(result.metrics.robustness.recoveryRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.robustness.recoveryRate).toBeLessThanOrEqual(1);
      }

      // Validate quality metrics
      if (result.metrics.quality) {
        expect(result.metrics.quality.toolSelectionAccuracy).toBeGreaterThanOrEqual(0);
        expect(result.metrics.quality.toolSelectionAccuracy).toBeLessThanOrEqual(1);
        expect(result.metrics.quality.parameterAccuracy).toBeGreaterThanOrEqual(0);
        expect(result.metrics.quality.parameterAccuracy).toBeLessThanOrEqual(1);
      }
    });

    it('should maintain data consistency across evaluation lifecycle', async () => {
      const result = await evaluationOrchestrator.executeEvaluation(
        'test-agent-456',
        'test-benchmark-789',
        { timeout: 1000 }
      );

      expect(result).toBeDefined();

      // Verify consistent data
      expect(result.id).toMatch(/^eval_/);
      expect(result.agentId).toBe('test-agent-456');
      expect(result.benchmarkId).toBe('test-benchmark-789');
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.endTime!.getTime()).toBeGreaterThan(result.startTime!.getTime());

      // Verify logs are properly formatted
      result.logs.forEach((log: string) => {
        expect(typeof log).toBe('string');
        expect(log.length).toBeGreaterThan(0);
      });
    });
  });
});