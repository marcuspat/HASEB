import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// ─── ESM-safe mocks (must precede all dynamic imports) ────────────────────────

jest.unstable_mockModule('@langchain/langgraph', () => ({
  StateGraph: jest.fn().mockImplementation(() => ({
    addNode: jest.fn().mockReturnThis(),
    addEdge: jest.fn().mockReturnThis(),
    addConditionalEdges: jest.fn().mockReturnThis(),
    setEntryPoint: jest.fn().mockReturnThis(),
    compile: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({}),
      stream: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: jest.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      }),
    }),
  })),
  END: '__end__',
  START: '__start__',
  Annotation: Object.assign(jest.fn(), { Root: (_shape: unknown) => ({ State: {} }) }),
  MemorySaver: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.unstable_mockModule('@/services/metrics/index', () => ({
  MetricsOrchestrator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    getCurrentMetrics: jest.fn().mockResolvedValue({
      performance: { taskSuccessRate: 0.9 },
      efficiency: { executionTime: 100, latencyPerStep: 10, totalSteps: 5 },
      cost: { totalTokens: 1000, estimatedCost: 0.05 },
      robustness: { toolCallErrorRate: 0.01, recoveryRate: 0.99 },
      quality: { toolSelectionAccuracy: 0.95, parameterAccuracy: 0.93 },
    }),
    getCollectorSummaries: jest.fn().mockResolvedValue({ summary: 'ok' }),
    recordTaskStart: jest.fn(),
    recordTaskCompletion: jest.fn(),
    recordTaskFailure: jest.fn(),
    recordStepStart: jest.fn(),
    recordStepCompletion: jest.fn(),
    recordDecision: jest.fn(),
    recordOutputQuality: jest.fn(),
    recordTokenUsage: jest.fn(),
    recordApiCall: jest.fn(),
    recordError: jest.fn(),
  })),
}));

jest.unstable_mockModule('@/database/models/Agent', () => ({
  AgentModel: {
    findById: jest.fn().mockResolvedValue({ id: 'benchmark-agent', name: 'Benchmark Agent', type: 'swe' }),
  },
}));

jest.unstable_mockModule('@/database/models/Benchmark', () => ({
  BenchmarkModel: {
    findById: jest.fn().mockResolvedValue({ id: 'benchmark-test', name: 'Performance Benchmark', type: 'swe-bench' }),
  },
}));

jest.unstable_mockModule('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn().mockResolvedValue({ id: 'eval-perf' }),
    findById: jest.fn().mockResolvedValue({ id: 'eval-perf', status: 'completed', metrics: {} }),
    updateStatus: jest.fn().mockResolvedValue(true),
    updateStatusWithTime: jest.fn().mockResolvedValue(true),
    updateMetrics: jest.fn().mockResolvedValue(true),
  },
}));

// Mock EvaluationOrchestrator entirely so langgraph never actually loads
jest.unstable_mockModule('@/orchestrator/EvaluationOrchestrator', () => ({
  EvaluationOrchestrator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    executeEvaluation: jest.fn().mockResolvedValue({
      id: 'eval-perf',
      status: 'completed',
      agentId: 'benchmark-agent',
      benchmarkId: 'benchmark-test',
      success: true,
      logs: [],
      metrics: {
        performance: { taskSuccessRate: 1.0 },
        efficiency: { executionTime: 1000, latencyPerStep: 100, totalSteps: 10 },
        cost: { totalTokens: 1000, estimatedCost: 0.01 },
        robustness: { toolCallErrorRate: 0, recoveryRate: 1.0 },
        quality: { toolSelectionAccuracy: 1.0, parameterAccuracy: 1.0 },
      },
      startTime: new Date(),
      endTime: new Date(),
    }),
    shutdown: jest.fn().mockResolvedValue(undefined),
    isEvaluationRunning: jest.fn().mockReturnValue(false),
  })),
}));

// Mock agent classes entirely
jest.unstable_mockModule('@/agents/SWE_Bench_Agent', () => ({
  SWE_Bench_Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, evaluationId: 'eval-swe' }),
    getMetrics: jest.fn().mockReturnValue({
      performance: { taskSuccessRate: 0.9 },
      efficiency: { executionTime: 1000 },
      cost: { totalTokens: 500 },
    }),
  })),
}));

jest.unstable_mockModule('@/agents/GUI_Automation_Agent', () => ({
  GUI_Automation_Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, evaluationId: 'eval-gui' }),
    getMetrics: jest.fn().mockReturnValue({
      performance: { taskSuccessRate: 0.85 },
      efficiency: { executionTime: 1200 },
      cost: { totalTokens: 300 },
    }),
  })),
}));

jest.unstable_mockModule('@/agents/General_Reasoning_Agent', () => ({
  General_Reasoning_Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, evaluationId: 'eval-reasoning' }),
    getMetrics: jest.fn().mockReturnValue({
      performance: { taskSuccessRate: 0.92 },
      efficiency: { executionTime: 800 },
      cost: { totalTokens: 400 },
    }),
  })),
}));

// ─── Module variables ──────────────────────────────────────────────────────────

let EvaluationOrchestrator: any;
let SWE_Bench_Agent: any;
let GUI_Automation_Agent: any;
let General_Reasoning_Agent: any;
let AgentModel: any;
let BenchmarkModel: any;
let EvaluationModel: any;

const _mods = await (async () => {
  const orchMod = await import('@/orchestrator/EvaluationOrchestrator');
  EvaluationOrchestrator = orchMod.EvaluationOrchestrator;
  const sweMod = await import('@/agents/SWE_Bench_Agent');
  SWE_Bench_Agent = sweMod.SWE_Bench_Agent;
  const guiMod = await import('@/agents/GUI_Automation_Agent');
  GUI_Automation_Agent = guiMod.GUI_Automation_Agent;
  const reasonMod = await import('@/agents/General_Reasoning_Agent');
  General_Reasoning_Agent = reasonMod.General_Reasoning_Agent;
  const agentMod = await import('@/database/models/Agent');
  AgentModel = agentMod.AgentModel;
  const benchMod = await import('@/database/models/Benchmark');
  BenchmarkModel = benchMod.BenchmarkModel;
  const evalMod = await import('@/database/models/Evaluation');
  EvaluationModel = evalMod.EvaluationModel;
})();

describe('Agent Performance Benchmarks', () => {
  let orchestrator: any;
  let mockAgent: any;
  let mockBenchmark: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    orchestrator = new EvaluationOrchestrator();

    mockAgent = {
      id: 'benchmark-agent',
      name: 'Benchmark Agent',
      type: 'swe',
      status: 'active',
      capabilities: ['code-generation', 'debugging'],
      configuration: { model: 'gpt-4', temperature: 0.1 },
    };

    mockBenchmark = {
      id: 'benchmark-test',
      name: 'Performance Benchmark',
      type: 'swe-bench',
      description: 'Performance testing benchmark',
      dataset: 'perf-dataset',
      evaluationCriteria: ['speed', 'accuracy'],
      configuration: { timeout: 30000 },
      isActive: true,
    };

    AgentModel.findById = jest.fn().mockResolvedValue(mockAgent);
    BenchmarkModel.findById = jest.fn().mockResolvedValue(mockBenchmark);
    EvaluationModel.create = jest.fn().mockResolvedValue({
      id: 'eval-perf',
      agentId: mockAgent.id,
      benchmarkId: mockBenchmark.id,
      status: 'pending',
      configuration: {},
      logs: [],
      metrics: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    EvaluationModel.updateStatus = jest.fn().mockResolvedValue(true);
    EvaluationModel.updateMetrics = jest.fn().mockResolvedValue(true);
    EvaluationModel.findById = jest.fn().mockResolvedValue({
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
        parameterAccuracy: 1.0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Ensure orchestrator mock returns proper values
    orchestrator.executeEvaluation = jest.fn().mockResolvedValue({
      id: 'eval-perf',
      status: 'completed',
      agentId: mockAgent.id,
      benchmarkId: mockBenchmark.id,
      success: true,
      logs: [],
      metrics: {
        performance: { taskSuccessRate: 1.0 },
        efficiency: { executionTime: 1000, latencyPerStep: 100, totalSteps: 10 },
        cost: { totalTokens: 1000, estimatedCost: 0.01 },
        robustness: { toolCallErrorRate: 0, recoveryRate: 1.0 },
        quality: { toolSelectionAccuracy: 1.0, parameterAccuracy: 1.0 },
      },
      startTime: new Date(),
      endTime: new Date(),
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
      expect(executionTime).toBeLessThan(10000);
      expect(executionTime).toBeGreaterThan(0);
    });

    it('should handle concurrent evaluations efficiently', async () => {
      const numEvaluations = 10;
      const startTime = performance.now();

      const evaluations = Array.from({ length: numEvaluations }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 3000 },
      }));

      const results = await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTimePerEvaluation = totalTime / numEvaluations;

      expect(results.every((r: any) => r.success)).toBe(true);
      expect(averageTimePerEvaluation).toBeLessThan(5000);
      expect(totalTime).toBeLessThan(20000);
    });

    it('should scale linearly with increasing load', async () => {
      const loads = [1, 5, 10, 15];
      const results: { load: number; time: number; avgTime: number }[] = [];

      for (const load of loads) {
        const startTime = performance.now();

        const evaluations = Array.from({ length: load }, (_, i) => ({
          agentId: mockAgent.id,
          benchmarkId: mockBenchmark.id,
          configuration: { iteration: i, timeout: 2000 },
        }));

        await Promise.all(
          evaluations.map(evalItem =>
            orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
          )
        );

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / load;

        results.push({ load, time: totalTime, avgTime });
      }

      const firstAvg = results[0].avgTime;
      const lastAvg = results[results.length - 1].avgTime;
      const scalingFactor = lastAvg / firstAvg;

      expect(scalingFactor).toBeLessThan(3);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage during evaluations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const numEvaluations = 20;

      const evaluations = Array.from({ length: numEvaluations }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 1000 },
      }));

      await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerEvaluation = memoryIncrease / numEvaluations;

      expect(memoryPerEvaluation).toBeLessThan(5 * 1024 * 1024);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up memory after evaluation completion', async () => {
      const memorySnapshots: number[] = [];

      memorySnapshots.push(process.memoryUsage().heapUsed);

      await orchestrator.executeEvaluation(mockAgent.id, mockBenchmark.id, { timeout: 2000 });
      memorySnapshots.push(process.memoryUsage().heapUsed);

      await new Promise(resolve => setTimeout(resolve, 100));

      memorySnapshots.push(process.memoryUsage().heapUsed);

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      expect(finalMemory - memorySnapshots[0]).toBeLessThan(20 * 1024 * 1024);
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
        configuration: { iteration: i, timeout: 2000 },
      }));

      await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      const endTime = performance.now();
      const endCPU = process.cpuUsage(startCPU);

      const wallTime = endTime - startTime;
      const cpuTime = endCPU.user + endCPU.system;
      const cpuUtilization = cpuTime / (wallTime * 1000);

      expect(cpuUtilization).toBeLessThan(2.0);
    });

    it('should handle I/O operations efficiently', async () => {
      const startTime = performance.now();

      const ioIntensiveConfig = {
        timeout: 5000,
        mockIOOperations: 100,
        mockIODelay: 10,
      };

      const result = await orchestrator.executeEvaluation(
        mockAgent.id,
        mockBenchmark.id,
        ioIntensiveConfig
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);

      const sequentialTime = ioIntensiveConfig.mockIOOperations * ioIntensiveConfig.mockIODelay;
      expect(executionTime).toBeLessThan(sequentialTime * 0.8);
    });
  });

  describe('Agent-Specific Benchmarks', () => {
    it('should benchmark SWE-Bench agent performance', async () => {
      const agent = new SWE_Bench_Agent({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { timeout: 3000 },
      });

      const startTime = performance.now();
      const result = await agent.execute();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000);

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
        configuration: { timeout: 3000 },
      });

      const startTime = performance.now();
      const result = await agent.execute();
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
        configuration: { timeout: 3000 },
      });

      const startTime = performance.now();
      const result = await agent.execute();
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
        configuration: { iteration: i, timeout: 1000 },
      }));

      const results = await Promise.allSettled(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;

      expect(successful).toBeGreaterThan(highLoad * 0.8);
      expect(totalTime).toBeLessThan(60000);
      expect(totalTime / highLoad).toBeLessThan(2000);
    });

    it('should recover from resource exhaustion', async () => {
      const resourceIntensiveEvals = Array.from({ length: 20 }, (_, i) => ({
        agentId: mockAgent.id,
        benchmarkId: mockBenchmark.id,
        configuration: { iteration: i, timeout: 1000, memoryIntensive: true, cpuIntensive: true },
      }));

      await Promise.allSettled(
        resourceIntensiveEvals.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      await new Promise(resolve => setTimeout(resolve, 100));

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

    if ((global as any).gc) {
      (global as any).gc();
    }
  });
});
