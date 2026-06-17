import { EvaluationOrchestrator } from '@/orchestrator/EvaluationOrchestrator';
import { SWE_Bench_Agent } from '@/agents/SWE_Bench_Agent';
import { GUI_Automation_Agent } from '@/agents/GUI_Automation_Agent';
import { General_Reasoning_Agent } from '@/agents/General_Reasoning_Agent';
import { EvaluationModel } from '@/database/models/Evaluation';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('../../src/database/models/Evaluation');
jest.mock('../../src/database/models/Agent');
jest.mock('../../src/database/models/Benchmark');
jest.mock('../../src/utils/logger');

const mockEvaluationModel = EvaluationModel as jest.Mocked<typeof EvaluationModel>;
const mockAgentModel = AgentModel as jest.Mocked<typeof AgentModel>;
const mockBenchmarkModel = BenchmarkModel as jest.Mocked<typeof BenchmarkModel>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Multi-Agent Workflow Integration Tests', () => {
  let orchestrator: any;
  let mockAgents: any[];
  let mockBenchmarks: any[];

  beforeEach(async () => {
    jest.clearAllMocks();

    orchestrator = new EvaluationOrchestrator();

    // Mock agents
    mockAgents = [
      {
        id: 'swe-agent-1',
        name: 'SWE Expert Agent',
        type: 'swe',
        status: 'active',
        capabilities: ['code-generation', 'debugging', 'testing'],
        configuration: { model: 'gpt-4', temperature: 0.1 }
      },
      {
        id: 'gui-agent-1',
        name: 'GUI Automation Agent',
        type: 'gui',
        status: 'active',
        capabilities: ['web-automation', 'desktop-automation', 'visual-recognition'],
        configuration: { browser: 'chromium', headless: true }
      },
      {
        id: 'reasoning-agent-1',
        name: 'General Reasoning Agent',
        type: 'reasoning',
        status: 'active',
        capabilities: ['logical-reasoning', 'problem-solving', 'analysis'],
        configuration: { model: 'gpt-4', maxSteps: 10 }
      }
    ];

    // Mock benchmarks
    mockBenchmarks = [
      {
        id: 'swe-bench-1',
        name: 'SWE-Bench Sample',
        type: 'swe-bench',
        description: 'Software engineering benchmark',
        dataset: 'test-dataset',
        evaluationCriteria: ['correctness', 'efficiency'],
        configuration: { timeout: 300000 },
        isActive: true
      },
      {
        id: 'webarena-1',
        name: 'WebArena Sample',
        type: 'webarena',
        description: 'Web automation benchmark',
        dataset: 'web-tasks',
        evaluationCriteria: ['task-completion', 'efficiency'],
        configuration: { timeout: 180000 },
        isActive: true
      },
      {
        id: 'gaia-1',
        name: 'GAIA Sample',
        type: 'gaia',
        description: 'General intelligence benchmark',
        dataset: 'reasoning-tasks',
        evaluationCriteria: ['accuracy', 'reasoning-quality'],
        configuration: { timeout: 120000 },
        isActive: true
      }
    ];

    // Mock database methods
    mockAgentModel.findById = jest.fn().mockImplementation((id) => {
      return Promise.resolve(mockAgents.find(agent => agent.id === id));
    });

    mockBenchmarkModel.findById = jest.fn().mockImplementation((id) => {
      return Promise.resolve(mockBenchmarks.find(benchmark => benchmark.id === id));
    });

    mockEvaluationModel.create = jest.fn().mockResolvedValue({
      id: 'eval-123',
      agentId: 'test-agent',
      benchmarkId: 'test-benchmark',
      status: 'pending',
      configuration: {},
      logs: [],
      metrics: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    mockEvaluationModel.updateStatus = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.updateStatusWithTime = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.updateMetrics = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.addLogs = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.findById = jest.fn().mockResolvedValue({
      id: 'eval-123',
      agentId: 'test-agent',
      benchmarkId: 'test-benchmark',
      status: 'completed',
      configuration: {},
      logs: [],
      metrics: {
        taskSuccessRate: 0.85,
        executionTime: 120000,
        latencyPerStep: 5000,
        totalSteps: 24,
        totalTokens: 5000,
        estimatedCost: 0.15,
        toolCallErrorRate: 0.05,
        recoveryRate: 0.95,
        toolSelectionAccuracy: 0.90,
        parameterAccuracy: 0.88
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  describe('Agent Factory Pattern', () => {
    it('should create correct agent type for SWE-Bench benchmark', async () => {
      const agent = await orchestrator.createAgent('swe-agent-1', 'swe-bench-1', {
        timeout: 300000,
        maxRetries: 2
      });

      expect(agent).toBeInstanceOf(SWE_Bench_Agent);
      expect(agent.getConfiguration()).toEqual({
        timeout: 300000,
        maxRetries: 2
      });
    });

    it('should create correct agent type for GUI automation benchmark', async () => {
      const agent = await orchestrator.createAgent('gui-agent-1', 'webarena-1', {
        timeout: 180000,
        maxRetries: 1
      });

      expect(agent).toBeInstanceOf(GUI_Automation_Agent);
      expect(agent.getConfiguration()).toEqual({
        timeout: 180000,
        maxRetries: 1
      });
    });

    it('should create correct agent type for general reasoning benchmark', async () => {
      const agent = await orchestrator.createAgent('reasoning-agent-1', 'gaia-1', {
        timeout: 120000,
        maxRetries: 3
      });

      expect(agent).toBeInstanceOf(General_Reasoning_Agent);
      expect(agent.getConfiguration()).toEqual({
        timeout: 120000,
        maxRetries: 3
      });
    });

    it('should throw error for unsupported agent-benchmark combination', async () => {
      await expect(
        orchestrator.createAgent('swe-agent-1', 'gaia-1')
      ).rejects.toThrow('Unsupported agent type for benchmark');
    });
  });

  describe('Concurrent Execution', () => {
    it('should execute multiple agents concurrently', async () => {
      const evaluations = [
        {
          id: 'eval-1',
          agentId: 'swe-agent-1',
          benchmarkId: 'swe-bench-1',
          configuration: { timeout: 60000 }
        },
        {
          id: 'eval-2',
          agentId: 'gui-agent-1',
          benchmarkId: 'webarena-1',
          configuration: { timeout: 60000 }
        },
        {
          id: 'eval-3',
          agentId: 'reasoning-agent-1',
          benchmarkId: 'gaia-1',
          configuration: { timeout: 60000 }
        }
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        evaluations.map((evaluation) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(results.every(result => result.success)).toBe(true);

      // Should complete faster than sequential execution
      expect(endTime - startTime).toBeLessThan(90000); // Less than 1.5 minutes
    });

    it('should handle resource limits during concurrent execution', async () => {
      // Mock orchestrator with limited resources
      const limitedOrchestrator: any = new EvaluationOrchestrator();
      limitedOrchestrator.setMaxConcurrentEvaluations(2);

      const evaluations = Array.from({ length: 5 }, (_, i) => ({
        id: `eval-${i}`,
        agentId: 'swe-agent-1',
        benchmarkId: 'swe-bench-1',
        configuration: { timeout: 30000 }
      }));

      const promises = evaluations.map((evaluation) =>
        limitedOrchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
      );

      const results = await Promise.allSettled(promises);

      // Some should succeed, some should be queued/rejected due to resource limits
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBeGreaterThan(0);
      expect(results.length).toBe(5);
    });
  });

  describe('Metrics Collection Integration', () => {
    it('should collect comprehensive metrics across all agent types', async () => {
      const evaluations = [
        {
          agentId: 'swe-agent-1',
          benchmarkId: 'swe-bench-1',
          configuration: { collectMetrics: true }
        },
        {
          agentId: 'gui-agent-1',
          benchmarkId: 'webarena-1',
          configuration: { collectMetrics: true }
        },
        {
          agentId: 'reasoning-agent-1',
          benchmarkId: 'gaia-1',
          configuration: { collectMetrics: true }
        }
      ];

      const results = await Promise.all(
        evaluations.map((evaluation) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      results.forEach((result, index) => {
        expect(result.metrics).toBeDefined();
        expect(result.metrics.performance).toBeDefined();
        expect(result.metrics.efficiency).toBeDefined();
        expect(result.metrics.cost).toBeDefined();
        expect(result.metrics.robustness).toBeDefined();
        expect(result.metrics.quality).toBeDefined();

        // Verify metric values are reasonable
        expect(result.metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.performance.taskSuccessRate).toBeLessThanOrEqual(1);
        expect(result.metrics.efficiency.executionTime).toBeGreaterThan(0);
        expect(result.metrics.cost.totalTokens).toBeGreaterThanOrEqual(0);
        expect(result.metrics.cost.estimatedCost).toBeGreaterThanOrEqual(0);
      });
    });

    it('should aggregate metrics across multiple evaluations', async () => {
      const evaluations = Array.from({ length: 3 }, (_, i) => ({
        agentId: 'swe-agent-1',
        benchmarkId: 'swe-bench-1',
        configuration: { iteration: i }
      }));

      await Promise.all(
        evaluations.map((evaluation) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      const aggregatedMetrics = await orchestrator.getAggregatedMetrics('swe-agent-1', 'swe-bench-1');

      expect(aggregatedMetrics).toBeDefined();
      expect(aggregatedMetrics.totalEvaluations).toBe(3);
      expect(aggregatedMetrics.averageSuccessRate).toBeGreaterThanOrEqual(0);
      expect(aggregatedMetrics.averageExecutionTime).toBeGreaterThan(0);
      expect(aggregatedMetrics.totalCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle agent failure gracefully', async () => {
      // Mock agent failure
      mockAgentModel.findById = jest.fn().mockResolvedValueOnce(null);

      const result = await orchestrator.executeEvaluation('invalid-agent', 'swe-bench-1', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('should handle benchmark failure gracefully', async () => {
      // Mock benchmark failure
      mockBenchmarkModel.findById = jest.fn().mockResolvedValueOnce(null);

      const result = await orchestrator.executeEvaluation('swe-agent-1', 'invalid-benchmark', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('BENCHMARK_NOT_FOUND');
    });

    it('should retry failed evaluations according to configuration', async () => {
      const evaluationConfig = {
        timeout: 5000,
        maxRetries: 3
      };

      // Mock execution that fails twice then succeeds
      let executionCount = 0;
      const originalCreate = SWE_Bench_Agent.prototype.execute;
      SWE_Bench_Agent.prototype.execute = jest.fn().mockImplementation(async function() {
        executionCount++;
        if (executionCount <= 2) {
          throw new Error('Simulated failure');
        }
        return { success: true, evaluationId: 'eval-success' };
      });

      const result = await orchestrator.executeEvaluation('swe-agent-1', 'swe-bench-1', evaluationConfig);

      expect(result.success).toBe(true);
      expect(executionCount).toBe(3); // Initial attempt + 2 retries

      // Restore original method
      SWE_Bench_Agent.prototype.execute = originalCreate;
    });
  });

  describe('Real-time Updates', () => {
    it('should emit progress events during evaluation', async () => {
      const progressEvents: any[] = [];

      orchestrator.on('progress', (event: any) => {
        progressEvents.push(event);
      });

      await orchestrator.executeEvaluation('swe-agent-1', 'swe-bench-1', {
        emitProgress: true
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('evaluationId');
      expect(progressEvents[0]).toHaveProperty('progress');
      expect(progressEvents[0]).toHaveProperty('status');
    });

    it('should emit metrics updates during evaluation', async () => {
      const metricsEvents: any[] = [];

      orchestrator.on('metrics', (event: any) => {
        metricsEvents.push(event);
      });

      await orchestrator.executeEvaluation('gui-agent-1', 'webarena-1', {
        emitMetrics: true
      });

      expect(metricsEvents.length).toBeGreaterThan(0);
      expect(metricsEvents[0]).toHaveProperty('evaluationId');
      expect(metricsEvents[0]).toHaveProperty('metrics');
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources after evaluation completion', async () => {
      const result = await orchestrator.executeEvaluation('swe-agent-1', 'swe-bench-1', {});

      expect(result.success).toBe(true);

      // Verify orchestrator state is clean
      const activeEvaluations = orchestrator.getActiveEvaluations();
      expect(activeEvaluations).not.toContain(result.evaluationId);
    });

    it('should limit memory usage during large-scale evaluation', async () => {
      const evaluations = Array.from({ length: 10 }, (_, i) => ({
        agentId: 'swe-agent-1',
        benchmarkId: 'swe-bench-1',
        configuration: { iteration: i }
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      await Promise.all(
        evaluations.map((evaluation) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  afterEach(async () => {
    // Clean up orchestrator resources
    await orchestrator.shutdown();
  });
});