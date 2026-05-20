import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { EvaluationOrchestrator as EvaluationOrchestratorType } from '@/orchestrator/EvaluationOrchestrator';

// ROOT CAUSE of the original "SyntaxError: Unexpected token 'export'": importing
// the orchestrator statically pulls in the real `@langchain/langgraph`, whose
// nested dependency `@langchain/langgraph/node_modules/uuid/dist/esm-browser/index.js`
// ships untransformed ESM that reaches ts-jest unparsed. Under native ESM,
// `jest.mock(...)` does NOT prevent the real module from being linked. The
// ESM-correct fix is `jest.unstable_mockModule` + a dynamic `import()` of the
// module under test AFTER the mocks are registered, which fully replaces the
// real langgraph runtime so its broken transitive ESM is never loaded.

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// In-memory metrics orchestrator double. Captures the metrics that the graph
// nodes record so we can keep the orchestrator's real logic exercised.
const metricsInstance = {
  initialize: jest.fn(async () => undefined),
  start: jest.fn(async () => undefined),
  stop: jest.fn(async () => undefined),
  cleanup: jest.fn(async () => undefined),
  getCurrentMetrics: jest.fn(async () => ({
    performance: { taskSuccessRate: 0.9 },
    efficiency: { executionTime: 100, latencyPerStep: 10, totalSteps: 5 },
    cost: { totalTokens: 1000, estimatedCost: 0.05 },
    robustness: { toolCallErrorRate: 0.01, recoveryRate: 0.99 },
    quality: { toolSelectionAccuracy: 0.95, parameterAccuracy: 0.93 },
  })),
  getCollectorSummaries: jest.fn(async () => ({ summary: 'ok' })),
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
};

const MetricsOrchestratorCtor = jest.fn(() => metricsInstance);

jest.unstable_mockModule('@/services/metrics/index', () => ({
  MetricsOrchestrator: MetricsOrchestratorCtor,
}));

const mockEvalCreate = jest.fn(async () => ({ id: 'eval-db-id' }));
const mockEvalUpdateStatusWithTime = jest.fn(async () => true);
const mockEvalUpdateMetrics = jest.fn(async () => true);

jest.unstable_mockModule('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: mockEvalCreate,
    updateStatusWithTime: mockEvalUpdateStatusWithTime,
    updateMetrics: mockEvalUpdateMetrics,
    findById: jest.fn(),
  },
}));

const mockBenchmarkFindById = jest.fn(async () => ({ id: 'b1', name: 'Bench' }));
jest.unstable_mockModule('@/database/models/Benchmark', () => ({
  BenchmarkModel: { findById: mockBenchmarkFindById },
}));

const mockAgentFindById = jest.fn(async () => ({ id: 'a1', name: 'Agent' }));
jest.unstable_mockModule('@/database/models/Agent', () => ({
  AgentModel: { findById: mockAgentFindById },
}));

// Replace the LangGraph runtime entirely. The orchestrator builds a fluent
// graph (new StateGraph(...).addNode(...).addEdge(...).compile()) and calls
// Annotation.Root(...) at module load time. The compiled graph's invoke() runs
// each registered node in sequence over the initial state, so the
// orchestrator's real node logic (and its metrics recording) is still tested.
jest.unstable_mockModule('@langchain/langgraph', () => {
  const START = '__start__';

  class StateGraph {
    private nodes: Record<string, (s: any) => Promise<any>> = {};
    constructor(_annotation: unknown) {}
    addNode(name: string, fn: (s: any) => Promise<any>) {
      this.nodes[name] = fn;
      return this;
    }
    addEdge() {
      return this;
    }
    compile() {
      const nodes = this.nodes;
      return {
        invoke: async (initialState: any) => {
          // Execute nodes in insertion order, threading state through, mirroring
          // the sequential edges the orchestrator wires up.
          let state = initialState;
          for (const name of Object.keys(nodes)) {
            state = (await nodes[name](state)) ?? state;
          }
          return state;
        },
      };
    }
  }

  const Annotation: any = () => undefined;
  Annotation.Root = (_shape: unknown) => ({ State: {} });

  return { StateGraph, Annotation, START };
});

const { EvaluationOrchestrator } = await import('@/orchestrator/EvaluationOrchestrator');

describe('EvaluationOrchestrator', () => {
  let orchestrator: EvaluationOrchestratorType;
  let setTimeoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    // The real graph nodes call `await new Promise(r => setTimeout(r, duration))`
    // with multi-second delays to simulate work. Collapse those delays to 0 so
    // the suite stays fast while still exercising the real node logic.
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      cb: (...args: any[]) => void
    ) => {
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as any);

    // resetMocks/clearMocks wipes implementations, so reinstall them each test.
    MetricsOrchestratorCtor.mockImplementation(() => metricsInstance);
    metricsInstance.initialize.mockResolvedValue(undefined as any);
    metricsInstance.start.mockResolvedValue(undefined as any);
    metricsInstance.stop.mockResolvedValue(undefined as any);
    metricsInstance.cleanup.mockResolvedValue(undefined as any);
    metricsInstance.getCurrentMetrics.mockResolvedValue({
      performance: { taskSuccessRate: 0.9 },
      efficiency: { executionTime: 100, latencyPerStep: 10, totalSteps: 5 },
      cost: { totalTokens: 1000, estimatedCost: 0.05 },
      robustness: { toolCallErrorRate: 0.01, recoveryRate: 0.99 },
      quality: { toolSelectionAccuracy: 0.95, parameterAccuracy: 0.93 },
    } as any);
    metricsInstance.getCollectorSummaries.mockResolvedValue({ summary: 'ok' } as any);

    mockEvalCreate.mockResolvedValue({ id: 'eval-db-id' } as any);
    mockEvalUpdateStatusWithTime.mockResolvedValue(true);
    mockEvalUpdateMetrics.mockResolvedValue(true);
    mockBenchmarkFindById.mockResolvedValue({ id: 'b1', name: 'Bench' } as any);
    mockAgentFindById.mockResolvedValue({ id: 'a1', name: 'Agent' } as any);

    orchestrator = new EvaluationOrchestrator();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
    setTimeoutSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('should construct and expose the real public API', () => {
      expect(orchestrator).toBeDefined();
      expect(typeof orchestrator.initialize).toBe('function');
      expect(typeof orchestrator.executeEvaluation).toBe('function');
      expect(typeof orchestrator.isEvaluationRunning).toBe('function');
      expect(typeof orchestrator.shutdown).toBe('function');
    });

    it('should not be running before any evaluation starts', () => {
      expect(orchestrator.isEvaluationRunning()).toBe(false);
    });

    it('should initialize without throwing', async () => {
      await expect(orchestrator.initialize()).resolves.toBeUndefined();
    });

    it('should support being initialized more than once', async () => {
      await orchestrator.initialize();
      await expect(orchestrator.initialize()).resolves.toBeUndefined();
    });
  });

  describe('executeEvaluation', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should run a full evaluation and return a completed state', async () => {
      const result = await orchestrator.executeEvaluation('a1', 'b1', { timeout: 1000 });

      expect(result).toBeDefined();
      expect(result.agentId).toBe('a1');
      expect(result.benchmarkId).toBe('b1');
      expect(result.status).toBe('completed');
      expect(Array.isArray(result.logs)).toBe(true);
      expect(result.logs.length).toBeGreaterThan(0);
    });

    it('should look up the agent and benchmark during setup', async () => {
      await orchestrator.executeEvaluation('a1', 'b1', {});
      expect(mockAgentFindById).toHaveBeenCalledWith('a1');
      expect(mockBenchmarkFindById).toHaveBeenCalledWith('b1');
    });

    it('should persist the evaluation and its final metrics', async () => {
      await orchestrator.executeEvaluation('a1', 'b1', {});

      expect(mockEvalCreate).toHaveBeenCalled();
      expect(mockEvalUpdateStatusWithTime).toHaveBeenCalled();
      expect(mockEvalUpdateMetrics).toHaveBeenCalled();
    });

    it('should drive the metrics orchestrator lifecycle', async () => {
      await orchestrator.executeEvaluation('a1', 'b1', {});

      expect(metricsInstance.initialize).toHaveBeenCalled();
      expect(metricsInstance.start).toHaveBeenCalled();
      expect(metricsInstance.stop).toHaveBeenCalled();
    });

    it('should reset the running flag after completion', async () => {
      await orchestrator.executeEvaluation('a1', 'b1', {});
      expect(orchestrator.isEvaluationRunning()).toBe(false);
    });

    it('should reject a concurrent evaluation while one is running', async () => {
      const first = orchestrator.executeEvaluation('a1', 'b1', {});
      // While the first is in-flight, the second should be rejected.
      await expect(orchestrator.executeEvaluation('a2', 'b2', {})).rejects.toThrow(
        'Another evaluation is already running'
      );
      await first;
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should fail and reset state when the agent is not found', async () => {
      mockAgentFindById.mockResolvedValueOnce(null as any);

      await expect(orchestrator.executeEvaluation('missing', 'b1', {})).rejects.toThrow(
        /Agent not found/
      );
      expect(orchestrator.isEvaluationRunning()).toBe(false);
    });

    it('should fail when the benchmark is not found', async () => {
      mockBenchmarkFindById.mockResolvedValueOnce(null as any);

      await expect(orchestrator.executeEvaluation('a1', 'missing', {})).rejects.toThrow(
        /Benchmark not found/
      );
    });
  });

  describe('shutdown', () => {
    it('should shut down cleanly and clear running state', async () => {
      await orchestrator.initialize();
      await expect(orchestrator.shutdown()).resolves.toBeUndefined();
      expect(orchestrator.isEvaluationRunning()).toBe(false);
    });

    it('should be safe to shut down without initializing', async () => {
      await expect(orchestrator.shutdown()).resolves.toBeUndefined();
    });

    it('should release the metrics orchestrator on shutdown after an evaluation', async () => {
      await orchestrator.initialize();
      await orchestrator.executeEvaluation('a1', 'b1', {});
      await orchestrator.shutdown();
      expect(orchestrator.getMetricsSummary()).resolves.toBeNull();
    });
  });
});
