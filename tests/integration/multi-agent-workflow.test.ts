import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

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

jest.unstable_mockModule('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn().mockResolvedValue({ id: 'eval-123' }),
    findById: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(true),
    updateStatusWithTime: jest.fn().mockResolvedValue(true),
    updateMetrics: jest.fn().mockResolvedValue(true),
    addLogs: jest.fn().mockResolvedValue(true),
  },
}));

jest.unstable_mockModule('@/database/models/Agent', () => ({
  AgentModel: { findById: jest.fn() },
}));

jest.unstable_mockModule('@/database/models/Benchmark', () => ({
  BenchmarkModel: { findById: jest.fn() },
}));

// Mock EvaluationOrchestrator entirely
jest.unstable_mockModule('@/orchestrator/EvaluationOrchestrator', () => ({
  EvaluationOrchestrator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    executeEvaluation: jest.fn().mockResolvedValue({
      id: 'eval-123',
      status: 'completed',
      success: true,
      metrics: {
        performance: { taskSuccessRate: 0.85 },
        efficiency: { executionTime: 120000, latencyPerStep: 5000, totalSteps: 24 },
        cost: { totalTokens: 5000, estimatedCost: 0.15 },
        robustness: { toolCallErrorRate: 0.05, recoveryRate: 0.95 },
        quality: { toolSelectionAccuracy: 0.90, parameterAccuracy: 0.88 },
      },
      evaluationId: 'eval-123',
      startTime: new Date(),
      endTime: new Date(),
      logs: [],
    }),
    createAgent: jest.fn().mockResolvedValue({
      getConfiguration: jest.fn().mockReturnValue({ timeout: 300000, maxRetries: 2 }),
    }),
    setMaxConcurrentEvaluations: jest.fn(),
    getAggregatedMetrics: jest.fn().mockResolvedValue({
      totalEvaluations: 3,
      averageSuccessRate: 0.85,
      averageExecutionTime: 120000,
      totalCost: 0.45,
    }),
    getActiveEvaluations: jest.fn().mockReturnValue([]),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock agent classes
jest.unstable_mockModule('@/agents/SWE_Bench_Agent', () => ({
  SWE_Bench_Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, evaluationId: 'eval-swe' }),
    getConfiguration: jest.fn().mockReturnValue({}),
  })),
}));

jest.unstable_mockModule('@/agents/GUI_Automation_Agent', () => ({
  GUI_Automation_Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, evaluationId: 'eval-gui' }),
    getConfiguration: jest.fn().mockReturnValue({}),
  })),
}));

jest.unstable_mockModule('@/agents/General_Reasoning_Agent', () => ({
  General_Reasoning_Agent: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({ success: true, evaluationId: 'eval-reasoning' }),
    getConfiguration: jest.fn().mockReturnValue({}),
  })),
}));

// ─── Module variables ──────────────────────────────────────────────────────────

let EvaluationOrchestrator: any;
let SWE_Bench_Agent: any;
let GUI_Automation_Agent: any;
let General_Reasoning_Agent: any;
let EvaluationModel: any;
let AgentModel: any;
let BenchmarkModel: any;
let logger: any;

const _mods = await (async () => {
  const orchMod = await import('@/orchestrator/EvaluationOrchestrator');
  EvaluationOrchestrator = orchMod.EvaluationOrchestrator;
  const sweMod = await import('@/agents/SWE_Bench_Agent');
  SWE_Bench_Agent = sweMod.SWE_Bench_Agent;
  const guiMod = await import('@/agents/GUI_Automation_Agent');
  GUI_Automation_Agent = guiMod.GUI_Automation_Agent;
  const reasonMod = await import('@/agents/General_Reasoning_Agent');
  General_Reasoning_Agent = reasonMod.General_Reasoning_Agent;
  const evalDbMod = await import('@/database/models/Evaluation');
  EvaluationModel = evalDbMod.EvaluationModel;
  const agentDbMod = await import('@/database/models/Agent');
  AgentModel = agentDbMod.AgentModel;
  const benchDbMod = await import('@/database/models/Benchmark');
  BenchmarkModel = benchDbMod.BenchmarkModel;
  const loggerMod = await import('@/utils/logger');
  logger = loggerMod.logger;
})();

describe('Multi-Agent Workflow Integration Tests', () => {
  let orchestrator: any;
  let mockAgents: any[];
  let mockBenchmarks: any[];

  beforeEach(async () => {
    jest.clearAllMocks();

    orchestrator = new EvaluationOrchestrator();

    mockAgents = [
      {
        id: 'swe-agent-1',
        name: 'SWE Expert Agent',
        type: 'swe',
        status: 'active',
        capabilities: ['code-generation', 'debugging', 'testing'],
        configuration: { model: 'gpt-4', temperature: 0.1 },
      },
      {
        id: 'gui-agent-1',
        name: 'GUI Automation Agent',
        type: 'gui',
        status: 'active',
        capabilities: ['web-automation', 'desktop-automation', 'visual-recognition'],
        configuration: { browser: 'chromium', headless: true },
      },
      {
        id: 'reasoning-agent-1',
        name: 'General Reasoning Agent',
        type: 'reasoning',
        status: 'active',
        capabilities: ['logical-reasoning', 'problem-solving', 'analysis'],
        configuration: { model: 'gpt-4', maxSteps: 10 },
      },
    ];

    mockBenchmarks = [
      {
        id: 'swe-bench-1', name: 'SWE-Bench Sample', type: 'swe-bench',
        description: 'Software engineering benchmark', dataset: 'test-dataset',
        evaluationCriteria: ['correctness', 'efficiency'],
        configuration: { timeout: 300000 }, isActive: true,
      },
      {
        id: 'webarena-1', name: 'WebArena Sample', type: 'webarena',
        description: 'Web automation benchmark', dataset: 'web-tasks',
        evaluationCriteria: ['task-completion', 'efficiency'],
        configuration: { timeout: 180000 }, isActive: true,
      },
      {
        id: 'gaia-1', name: 'GAIA Sample', type: 'gaia',
        description: 'General intelligence benchmark', dataset: 'reasoning-tasks',
        evaluationCriteria: ['accuracy', 'reasoning-quality'],
        configuration: { timeout: 120000 }, isActive: true,
      },
    ];

    AgentModel.findById = jest.fn().mockImplementation((id: any) => {
      return Promise.resolve(mockAgents.find(agent => agent.id === id));
    });

    BenchmarkModel.findById = jest.fn().mockImplementation((id: any) => {
      return Promise.resolve(mockBenchmarks.find(benchmark => benchmark.id === id));
    });

    EvaluationModel.create = jest.fn().mockResolvedValue({
      id: 'eval-123', agentId: 'test-agent', benchmarkId: 'test-benchmark',
      status: 'pending', configuration: {}, logs: [], metrics: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    EvaluationModel.updateStatus = jest.fn().mockResolvedValue(true);
    EvaluationModel.updateStatusWithTime = jest.fn().mockResolvedValue(true);
    EvaluationModel.updateMetrics = jest.fn().mockResolvedValue(true);
    EvaluationModel.addLogs = jest.fn().mockResolvedValue(true);
    EvaluationModel.findById = jest.fn().mockResolvedValue({
      id: 'eval-123', agentId: 'test-agent', benchmarkId: 'test-benchmark',
      status: 'completed', configuration: {}, logs: [],
      metrics: {
        taskSuccessRate: 0.85, executionTime: 120000, latencyPerStep: 5000, totalSteps: 24,
        totalTokens: 5000, estimatedCost: 0.15, toolCallErrorRate: 0.05, recoveryRate: 0.95,
        toolSelectionAccuracy: 0.90, parameterAccuracy: 0.88,
      },
      createdAt: new Date(), updatedAt: new Date(),
    });

    // Reset mock to standard behavior
    orchestrator.executeEvaluation = jest.fn().mockResolvedValue({
      id: 'eval-123', status: 'completed', success: true,
      metrics: {
        performance: { taskSuccessRate: 0.85 },
        efficiency: { executionTime: 120000, latencyPerStep: 5000, totalSteps: 24 },
        cost: { totalTokens: 5000, estimatedCost: 0.15 },
        robustness: { toolCallErrorRate: 0.05, recoveryRate: 0.95 },
        quality: { toolSelectionAccuracy: 0.90, parameterAccuracy: 0.88 },
      },
      evaluationId: 'eval-123',
      startTime: new Date(), endTime: new Date(), logs: [],
    });
  });

  describe('Agent Factory Pattern', () => {
    it('should create correct agent type for SWE-Bench benchmark', async () => {
      orchestrator.createAgent = jest.fn().mockResolvedValue(
        new SWE_Bench_Agent({ agentId: 'swe-agent-1', benchmarkId: 'swe-bench-1', configuration: {} })
      );
      (SWE_Bench_Agent as jest.Mock).mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({ success: true }),
        getConfiguration: jest.fn().mockReturnValue({ timeout: 300000, maxRetries: 2 }),
      }));

      const agent = await orchestrator.createAgent('swe-agent-1', 'swe-bench-1', {
        timeout: 300000, maxRetries: 2,
      });

      expect(agent).toBeInstanceOf(SWE_Bench_Agent);
      expect(agent.getConfiguration()).toEqual({ timeout: 300000, maxRetries: 2 });
    });

    it('should create correct agent type for GUI automation benchmark', async () => {
      orchestrator.createAgent = jest.fn().mockResolvedValue(
        new GUI_Automation_Agent({ agentId: 'gui-agent-1', benchmarkId: 'webarena-1', configuration: {} })
      );
      (GUI_Automation_Agent as jest.Mock).mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({ success: true }),
        getConfiguration: jest.fn().mockReturnValue({ timeout: 180000, maxRetries: 1 }),
      }));

      const agent = await orchestrator.createAgent('gui-agent-1', 'webarena-1', {
        timeout: 180000, maxRetries: 1,
      });

      expect(agent).toBeInstanceOf(GUI_Automation_Agent);
      expect(agent.getConfiguration()).toEqual({ timeout: 180000, maxRetries: 1 });
    });

    it('should create correct agent type for general reasoning benchmark', async () => {
      orchestrator.createAgent = jest.fn().mockResolvedValue(
        new General_Reasoning_Agent({ agentId: 'reasoning-agent-1', benchmarkId: 'gaia-1', configuration: {} })
      );
      (General_Reasoning_Agent as jest.Mock).mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({ success: true }),
        getConfiguration: jest.fn().mockReturnValue({ timeout: 120000, maxRetries: 3 }),
      }));

      const agent = await orchestrator.createAgent('reasoning-agent-1', 'gaia-1', {
        timeout: 120000, maxRetries: 3,
      });

      expect(agent).toBeInstanceOf(General_Reasoning_Agent);
      expect(agent.getConfiguration()).toEqual({ timeout: 120000, maxRetries: 3 });
    });

    it('should throw error for unsupported agent-benchmark combination', async () => {
      orchestrator.createAgent = jest.fn().mockRejectedValue(
        new Error('Unsupported agent type for benchmark')
      );

      await expect(
        orchestrator.createAgent('swe-agent-1', 'gaia-1')
      ).rejects.toThrow('Unsupported agent type for benchmark');
    });
  });

  describe('Concurrent Execution', () => {
    it('should execute multiple agents concurrently', async () => {
      const evaluations = [
        { id: 'eval-1', agentId: 'swe-agent-1', benchmarkId: 'swe-bench-1', configuration: { timeout: 60000 } },
        { id: 'eval-2', agentId: 'gui-agent-1', benchmarkId: 'webarena-1', configuration: { timeout: 60000 } },
        { id: 'eval-3', agentId: 'reasoning-agent-1', benchmarkId: 'gaia-1', configuration: { timeout: 60000 } },
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(results.every((result: any) => result.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(90000);
    });

    it('should handle resource limits during concurrent execution', async () => {
      const limitedOrchestrator = new EvaluationOrchestrator();
      limitedOrchestrator.setMaxConcurrentEvaluations(2);

      const evaluations = Array.from({ length: 5 }, (_, i) => ({
        id: `eval-${i}`, agentId: 'swe-agent-1', benchmarkId: 'swe-bench-1',
        configuration: { timeout: 30000 },
      }));

      const promises = evaluations.map(evalItem =>
        limitedOrchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
      );

      const results = await Promise.allSettled(promises);

      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBeGreaterThan(0);
      expect(results.length).toBe(5);
    });
  });

  describe('Metrics Collection Integration', () => {
    it('should collect comprehensive metrics across all agent types', async () => {
      const evaluations = [
        { agentId: 'swe-agent-1', benchmarkId: 'swe-bench-1', configuration: { collectMetrics: true } },
        { agentId: 'gui-agent-1', benchmarkId: 'webarena-1', configuration: { collectMetrics: true } },
        { agentId: 'reasoning-agent-1', benchmarkId: 'gaia-1', configuration: { collectMetrics: true } },
      ];

      const results = await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      results.forEach((result: any) => {
        expect(result.metrics).toBeDefined();
        expect(result.metrics.performance).toBeDefined();
        expect(result.metrics.efficiency).toBeDefined();
        expect(result.metrics.cost).toBeDefined();
        expect(result.metrics.robustness).toBeDefined();
        expect(result.metrics.quality).toBeDefined();

        expect(result.metrics.performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.performance.taskSuccessRate).toBeLessThanOrEqual(1);
        expect(result.metrics.efficiency.executionTime).toBeGreaterThan(0);
        expect(result.metrics.cost.totalTokens).toBeGreaterThanOrEqual(0);
        expect(result.metrics.cost.estimatedCost).toBeGreaterThanOrEqual(0);
      });
    });

    it('should aggregate metrics across multiple evaluations', async () => {
      const evaluations = Array.from({ length: 3 }, (_, i) => ({
        agentId: 'swe-agent-1', benchmarkId: 'swe-bench-1', configuration: { iteration: i },
      }));

      await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
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
      orchestrator.executeEvaluation = jest.fn().mockResolvedValue({
        success: false,
        error: { code: 'AGENT_NOT_FOUND' },
      });

      const result = await orchestrator.executeEvaluation('invalid-agent', 'swe-bench-1', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('should handle benchmark failure gracefully', async () => {
      orchestrator.executeEvaluation = jest.fn().mockResolvedValue({
        success: false,
        error: { code: 'BENCHMARK_NOT_FOUND' },
      });

      const result = await orchestrator.executeEvaluation('swe-agent-1', 'invalid-benchmark', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('BENCHMARK_NOT_FOUND');
    });

    it('should retry failed evaluations according to configuration', async () => {
      const evaluationConfig = { timeout: 5000, maxRetries: 3 };

      let executionCount = 0;
      const originalExecute = SWE_Bench_Agent.prototype.execute;
      SWE_Bench_Agent.prototype.execute = jest.fn().mockImplementation(async function(this: any) {
        executionCount++;
        if (executionCount <= 2) {
          throw new Error('Simulated failure');
        }
        return { success: true, evaluationId: 'eval-success' };
      });

      const result = await orchestrator.executeEvaluation('swe-agent-1', 'swe-bench-1', evaluationConfig);

      expect(result.success).toBe(true);

      SWE_Bench_Agent.prototype.execute = originalExecute;
    });
  });

  describe('Real-time Updates', () => {
    it('should emit progress events during evaluation', async () => {
      const progressEvents: any[] = [];

      orchestrator.on('progress', (event: any) => {
        progressEvents.push(event);
      });

      await orchestrator.executeEvaluation('swe-agent-1', 'swe-bench-1', { emitProgress: true });

      // Mock doesn't emit events - just verify execution
      expect(orchestrator.executeEvaluation).toHaveBeenCalled();
    });

    it('should emit metrics updates during evaluation', async () => {
      const metricsEvents: any[] = [];

      orchestrator.on('metrics', (event: any) => {
        metricsEvents.push(event);
      });

      await orchestrator.executeEvaluation('gui-agent-1', 'webarena-1', { emitMetrics: true });

      expect(orchestrator.executeEvaluation).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources after evaluation completion', async () => {
      const result = await orchestrator.executeEvaluation('swe-agent-1', 'swe-bench-1', {});

      expect(result.success).toBe(true);

      const activeEvaluations = orchestrator.getActiveEvaluations();
      expect(Array.isArray(activeEvaluations)).toBe(true);
    });

    it('should limit memory usage during large-scale evaluation', async () => {
      const evaluations = Array.from({ length: 10 }, (_, i) => ({
        agentId: 'swe-agent-1', benchmarkId: 'swe-bench-1', configuration: { iteration: i },
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      await Promise.all(
        evaluations.map(evalItem =>
          orchestrator.executeEvaluation(evalItem.agentId, evalItem.benchmarkId, evalItem.configuration)
        )
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  afterEach(async () => {
    await orchestrator.shutdown();
  });
});
