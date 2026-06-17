import { performance } from 'perf_hooks';
import { EvaluationOrchestrator } from '@/orchestrator/EvaluationOrchestrator';
import { SWE_Bench_Agent } from '@/agents/SWE_Bench_Agent';
import { GUI_Automation_Agent } from '@/agents/GUI_Automation_Agent';
import { General_Reasoning_Agent } from '@/agents/General_Reasoning_Agent';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';
import { EvaluationModel } from '@/database/models/Evaluation';

// Mock dependencies
jest.mock('../../src/database/models/Agent');
jest.mock('../../src/database/models/Benchmark');
jest.mock('../../src/database/models/Evaluation');

const mockAgentModel = AgentModel as jest.Mocked<typeof AgentModel>;
const mockBenchmarkModel = BenchmarkModel as jest.Mocked<typeof BenchmarkModel>;
const mockEvaluationModel = EvaluationModel as jest.Mocked<typeof EvaluationModel>;

describe('Agent Performance Benchmarks', () => {
  let orchestrator: any;
  let mockAgent: any;
  let mockBenchmark: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    orchestrator = new EvaluationOrchestrator();

    // Mock agent
    mockAgent = {
      id: 'benchmark-agent',
      name: 'Benchmark Agent',
      type: 'swe',
      status: 'active',
      capabilities: ['code-generation', 'debugging'],
      configuration: { model: 'gpt-4', temperature: 0.1 }
    };

    // Mock benchmark
    mockBenchmark = {
      id: 'benchmark-test',
      name: 'Performance Benchmark',
      type: 'swe-bench',
      description: 'Performance testing benchmark',
      dataset: 'perf-dataset',
      evaluationCriteria: ['speed', 'accuracy'],
      configuration: { timeout: 30000 },
      isActive: true
    };

    // Mock database methods
    mockAgentModel.findById = jest.fn().mockResolvedValue(mockAgent);
    mockBenchmarkModel.findById = jest.fn().mockResolvedValue(mockBenchmark);
    mockEvaluationModel.create = jest.fn().mockResolvedValue({
      id: 'eval-perf',
      agentId: mockAgent.id,
      benchmarkId: mockBenchmark.id,
      status: 'pending',
      configuration: {},
      logs: [],
      metrics: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mockEvaluationModel.updateStatus = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.updateMetrics = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.findById = jest.fn().mockResolvedValue({
      id: 'eval-perf',
      agentId: mockAgent.id,
      benchmarkId: mockBenchmark.id,
      status: 'completed',
      configuration: {},
      logs: [],
      metrics: {
        taskSuccessRate: 1.0,
        executionTime: 1000,
        latencyPerStep: 100,
        totalSteps: 10,
        totalTokens: 1000,
        estimatedCost: 0.01,
        toolCallErrorRate: 0,
        recoveryRate: 1.0,
        toolSelectionAccuracy: 1.0,
        parameterAccuracy: 1.0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  describe('Execution Speed Benchmarks', () => {
    it('should complete single evaluation within acceptable time', async () => {
      const startTime = performance.now();

      const result = await orchestrator.executeEvaluation(
        mockAgent.id,
        mockBenchmark.id,
        { timeout: 5000 }
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(executionTime).toBeGreaterThan(0); // Should take some measurable time
    });

    it('should handle concurrent evaluations efficiently', async () => {
      const numEvaluations = 10;
      const startTime = performance.now();

      const evaluations = Array.from({ length: numEvaluations }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 3000 }
      }));

      const results = await Promise.all(
        evaluations.map((evaluation: any) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTimePerEvaluation = totalTime / numEvaluations;

      expect(results.every(r => r.success)).toBe(true);
      expect(averageTimePerEvaluation).toBeLessThan(5000); // Average under 5 seconds per evaluation
      expect(totalTime).toBeLessThan(20000); // Total under 20 seconds for 10 evaluations
    });

    it('should scale linearly with increasing load', async () => {
      const loads = [1, 5, 10, 15];
      const results: { load: number; time: number; avgTime: number }[] = [];

      for (const load of loads) {
        const startTime = performance.now();

        const evaluations = Array.from({ length: load }, (_, i) => ({
          agentId: mockAgent.id,
          benchmarkId: mockBenchmark.id,
          configuration: { iteration: i, timeout: 2000 }
        }));

        await Promise.all(
          evaluations.map((evaluation: any) =>
            orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
          )
        );

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / load;

        results.push({ load, time: totalTime, avgTime });
      }

      // Check that average time per evaluation doesn't increase dramatically with load
      const firstAvg = results[0].avgTime;
      const lastAvg = results[results.length - 1].avgTime;
      const scalingFactor = lastAvg / firstAvg;

      expect(scalingFactor).toBeLessThan(3); // Average time shouldn't triple with 15x load
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage during evaluations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const numEvaluations = 20;

      const evaluations = Array.from({ length: numEvaluations }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 1000 }
      }));

      await Promise.all(
        evaluations.map((evaluation: any) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerEvaluation = memoryIncrease / numEvaluations;

      expect(memoryPerEvaluation).toBeLessThan(5 * 1024 * 1024); // Less than 5MB per evaluation
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Total increase less than 50MB
    });

    it('should clean up memory after evaluation completion', async () => {
      const memorySnapshots: number[] = [];

      // Baseline
      memorySnapshots.push(process.memoryUsage().heapUsed);

      // Execute evaluation
      await orchestrator.executeEvaluation(mockAgent.id, mockBenchmark.id, { timeout: 2000 });
      memorySnapshots.push(process.memoryUsage().heapUsed);

      // Wait for garbage collection
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (global.gc) global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));

      memorySnapshots.push(process.memoryUsage().heapUsed);

      // Memory should not grow indefinitely
      const peakMemory = Math.max(...memorySnapshots);
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryReduction = peakMemory - finalMemory;

      expect(memoryReduction).toBeGreaterThan(0); // Some memory should be freed
      expect(finalMemory - memorySnapshots[0]).toBeLessThan(20 * 1024 * 1024); // Net increase < 20MB
    });
  });

  describe('Resource Utilization Benchmarks', () => {
    it('should efficiently use CPU resources during concurrent execution', async () => {
      const startTime = performance.now();
      const startCPU = process.cpuUsage();

      const numEvaluations = 8;
      const evaluations = Array.from({ length: numEvaluations }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 2000 }
      }));

      await Promise.all(
        evaluations.map((evaluation: any) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      const endTime = performance.now();
      const endCPU = process.cpuUsage(startCPU);

      const wallTime = endTime - startTime;
      const cpuTime = endCPU.user + endCPU.system;
      const cpuUtilization = cpuTime / (wallTime * 1000); // Convert to ratio

      // CPU utilization should be reasonable (not too low, not excessive)
      expect(cpuUtilization).toBeGreaterThan(0.1); // At least 10% CPU usage
      expect(cpuUtilization).toBeLessThan(2.0); // Less than 200% (accounting for multiple cores)
    });

    it('should handle I/O operations efficiently', async () => {
      const startTime = performance.now();

      // Create I/O intensive evaluation
      const ioIntensiveConfig = {
        timeout: 5000,
        mockIOOperations: 100, // Simulate many I/O operations
        mockIODelay: 10 // 10ms per operation
      };

      const result = await orchestrator.executeEvaluation(
        mockAgent.id,
        mockBenchmark.id,
        ioIntensiveConfig
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);

      // Should complete faster than sequential I/O operations would take
      const sequentialTime = ioIntensiveConfig.mockIOOperations * ioIntensiveConfig.mockIODelay;
      expect(executionTime).toBeLessThan(sequentialTime * 0.8); // At least 20% faster due to concurrency
    });
  });

  describe('Agent-Specific Benchmarks', () => {
    it('should benchmark SWE-Bench agent performance', async () => {
      const agent = new SWE_Bench_Agent({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { timeout: 3000 }
      });

      const startTime = performance.now();
      const result: any = await agent.execute();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      const metrics = agent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.efficiency.executionTime).toBeGreaterThan(0);
      expect(metrics.cost.totalTokens).toBeGreaterThanOrEqual(0);
    });

    it('should benchmark GUI Automation agent performance', async () => {
      mockAgent.type = 'gui';
      const agent = new GUI_Automation_Agent({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { timeout: 3000 }
      });

      const startTime = performance.now();
      const result: any = await agent.execute();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000);

      const metrics = agent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.efficiency.executionTime).toBeGreaterThan(0);
    });

    it('should benchmark General Reasoning agent performance', async () => {
      mockAgent.type = 'reasoning';
      const agent = new General_Reasoning_Agent({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { timeout: 3000 }
      });

      const startTime = performance.now();
      const result: any = await agent.execute();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000);

      const metrics = agent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.efficiency.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high-load stress testing', async () => {
      const highLoad = 50;
      const startTime = performance.now();

      const evaluations = Array.from({ length: highLoad }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 1000 }
      }));

      const results = await Promise.allSettled(
        evaluations.map((evaluation: any) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Most should succeed even under high load
      expect(successful).toBeGreaterThan(highLoad * 0.8); // At least 80% success rate
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute

      // System should remain responsive
      expect(totalTime / highLoad).toBeLessThan(2000); // Average < 2 seconds per evaluation
    });

    it('should recover from resource exhaustion', async () => {
      // Push system to resource limits
      const resourceIntensiveEvals = Array.from({ length: 20 }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: {
          iteration: i,
          timeout: 1000,
          memoryIntensive: true,
          cpuIntensive: true
        }
      }));

      const initialResults = await Promise.allSettled(
        resourceIntensiveEvals.map((evaluation: any) =>
          orchestrator.executeEvaluation(evaluation.agentId, evaluation.benchmarkId, evaluation.configuration)
        )
      );

      // Allow system to recover
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test normal operations still work
      const recoveryResult = await orchestrator.executeEvaluation(
        mockAgent.id,
        mockBenchmark.id,
        { timeout: 3000 }
      );

      expect(recoveryResult.success).toBe(true);
    });
  });

  afterEach(async () => {
    await orchestrator.shutdown();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });
});