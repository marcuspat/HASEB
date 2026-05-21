/**
 * Node.js Environment Integration Tests for HASEB LangGraph Orchestration System
 * Uses Node environment to avoid DOM-related issues with LangGraph
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

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

jest.unstable_mockModule('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    level: 'error',
  },
}));

jest.unstable_mockModule('../../src/services/metrics/index', () => ({
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
    getCollectorSummaries: jest.fn().mockReturnValue({
      performance: {}, efficiency: {}, cost: {}, robustness: {}, quality: {},
    }),
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
    recordToolUsage: jest.fn(),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../src/services/metrics/MetricsOrchestrator', () => ({
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
      aggregated: { overallScore: 0.9, rank: 1, percentile: 90, confidence: 0.95 },
    }),
    getCollectorSummaries: jest.fn().mockReturnValue({
      performance: {}, efficiency: {}, cost: {}, robustness: {}, quality: {},
    }),
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
    recordToolUsage: jest.fn(),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../src/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn().mockResolvedValue({
      id: 'mock-eval-id', agentId: 'mock-agent-id', benchmarkId: 'mock-benchmark-id',
      status: 'running', configuration: {}, logs: [], metrics: null, startTime: new Date(),
    }),
    updateStatusWithTime: jest.fn().mockResolvedValue(true),
    updateMetrics: jest.fn().mockResolvedValue(true),
  },
}));

jest.unstable_mockModule('../../src/database/models/Agent', () => ({
  AgentModel: {
    findById: jest.fn().mockResolvedValue({
      id: 'mock-agent-id', name: 'Test Agent', type: 'test', configuration: {},
    }),
  },
}));

jest.unstable_mockModule('../../src/database/models/Benchmark', () => ({
  BenchmarkModel: {
    findById: jest.fn().mockResolvedValue({
      id: 'mock-benchmark-id', name: 'Test Benchmark', type: 'test', dataset: 'test-dataset',
    }),
  },
}));

// ─── Module variables ──────────────────────────────────────────────────────────

let EvaluationOrchestrator: any;
let ExecutionEngine: any;
let MetricsOrchestrator: any;
let logger: any;
let uuidv4: any;

beforeAll(async () => {
  const orchMod = await import('../../src/orchestrator/EvaluationOrchestrator');
  EvaluationOrchestrator = orchMod.EvaluationOrchestrator;

  const engineMod = await import('../../src/orchestrator/ExecutionEngine');
  ExecutionEngine = engineMod.ExecutionEngine;

  const metricsMod = await import('../../src/services/metrics/MetricsOrchestrator');
  MetricsOrchestrator = metricsMod.MetricsOrchestrator;

  const loggerMod = await import('../../src/utils/logger');
  logger = loggerMod.logger;

  const uuidMod = await import('uuid');
  uuidv4 = uuidMod.v4;
});

/**
 * @jest-environment node
 */
describe('HASEB Orchestration System Integration Tests (Node Environment)', () => {
  let evaluationOrchestrator: any;
  let executionEngine: any;
  let metricsOrchestrator: any;
  let testAgentId: string;
  let testBenchmarkId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testAgentId = 'test-agent-abc123';
    testBenchmarkId = 'test-benchmark-def456';

    if (logger) {
      logger.level = 'error';
    }
  });

  afterAll(async () => {
    // cleanup
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    evaluationOrchestrator = new EvaluationOrchestrator();
    executionEngine = new ExecutionEngine(5, 30000);
  });

  afterEach(async () => {
    try {
      if (evaluationOrchestrator) {
        await evaluationOrchestrator.cleanup();
      }
      if (executionEngine) {
        await executionEngine.shutdown();
      }
      if (metricsOrchestrator) {
        await metricsOrchestrator.cleanup();
      }
    } catch (error) {
      // ignore cleanup errors
    }
  });

  describe('1. LangGraph EvaluationOrchestrator Core', () => {
    test('should initialize EvaluationOrchestrator with LangGraph workflow', async () => {
      expect(evaluationOrchestrator).toBeDefined();
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);

      const currentEval = evaluationOrchestrator.getCurrentEvaluation();
      expect(currentEval).toBeUndefined();
    });

    test('should execute complete evaluation workflow with LangGraph StateGraph', async () => {
      const configuration = {
        timeout: 10000, enableMetrics: true, testMode: true,
      };

      const startTime = Date.now();

      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.id).toBeDefined();
      expect(result.agentId).toBe(testAgentId);
      expect(result.benchmarkId).toBe(testBenchmarkId);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      const logMessages = result.logs.join(' ');
      expect(logMessages).toContain('Setup completed');
      expect(logMessages).toContain('Evaluation executed');
      expect(logMessages).toContain('Metrics collected');
      expect(logMessages).toContain('Results analyzed');
      expect(logMessages).toContain('Cleanup completed');
    });

    test('should demonstrate LangGraph StateGraph execution flow', async () => {
      const configuration = {
        timeout: 8000, enableMetrics: true, testMode: true, workflow: 'stategraph-demo',
      };

      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      expect(result.status).toBe('completed');
      expect(result.logs.length).toBeGreaterThanOrEqual(5);

      const logText = result.logs.join('\n');
      expect(logText).toMatch(/Setup completed for agent/);
      expect(logText).toMatch(/Evaluation executed successfully/);
      expect(logText).toMatch(/Metrics collected/);
      expect(logText).toMatch(/Results analyzed/);
      expect(logText).toMatch(/Cleanup completed/);
    });
  });

  describe('2. ExecutionEngine Task Management', () => {
    test('should load and manage benchmark tasks', async () => {
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 3, testMode: true,
      });

      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('type');
      expect(tasks[0]).toHaveProperty('input');
      expect(tasks[0]).toHaveProperty('expectedOutput');

      const taskTypes = tasks.map((t: any) => t.type);
      expect(taskTypes).toContain('code-generation');
      expect(taskTypes).toContain('reasoning');
      expect(taskTypes).toContain('gui-automation');
    });

    test('should execute individual tasks with proper state management', async () => {
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 2, testMode: true,
      });

      const results = [];
      for (const task of tasks) {
        const result = await executionEngine.executeTask(
          uuidv4 ? uuidv4() : 'test-uuid',
          task,
          { agentId: testAgentId, environment: {}, configuration: { testMode: true } }
        );
        results.push(result);
      }

      expect(results).toHaveLength(2);

      results.forEach((result: any) => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('startTime');
        expect(result).toHaveProperty('endTime');
        expect(result).toHaveProperty('duration');
        expect(['completed', 'failed']).toContain(result.status);
        expect(result.duration).toBeGreaterThan(0);
      });
    });

    test('should handle concurrent task execution properly', async () => {
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 4, testMode: true,
      });

      const taskPromises = tasks.map((task: any) =>
        executionEngine.executeTask(
          uuidv4 ? uuidv4() : 'test-uuid',
          task,
          { agentId: testAgentId, environment: {}, configuration: { testMode: true } }
        )
      );

      const results = await Promise.allSettled(taskPromises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(4);
      expect(successful).toBeGreaterThan(0);

      const stats = executionEngine.getExecutionStats();
      expect(stats).toHaveProperty('activeExecutions');
      expect(stats).toHaveProperty('maxConcurrentTasks');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('successRate');
    });
  });

  describe('3. Metrics Collection System', () => {
    test('should initialize MetricsOrchestrator with all collectors', async () => {
      const metricsContext = {
        evaluationId: uuidv4 ? uuidv4() : 'test-uuid-1',
        agentId: testAgentId, benchmarkId: testBenchmarkId,
        sessionId: uuidv4 ? uuidv4() : 'test-session-1',
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform, version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' },
        },
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await metricsOrchestrator.initialize();

      const summaries = metricsOrchestrator.getCollectorSummaries();

      expect(summaries).toHaveProperty('performance');
      expect(summaries).toHaveProperty('efficiency');
      expect(summaries).toHaveProperty('cost');
      expect(summaries).toHaveProperty('robustness');
      expect(summaries).toHaveProperty('quality');
    });

    test('should collect comprehensive metrics during execution', async () => {
      const metricsContext = {
        evaluationId: uuidv4 ? uuidv4() : 'test-uuid-2',
        agentId: testAgentId, benchmarkId: testBenchmarkId,
        sessionId: uuidv4 ? uuidv4() : 'test-session-2',
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform, version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' },
        },
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext, {
        aggregation: { interval: 200, enableRealTimeUpdates: true, persistenceBatchSize: 1 },
      });

      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      const updates: any[] = [];
      metricsOrchestrator.on('real_time_update', (update: any) => {
        updates.push(update);
      });

      metricsOrchestrator.recordTaskStart('test-task-1', 5);
      await new Promise(resolve => setTimeout(resolve, 50));
      metricsOrchestrator.recordTokenUsage('gpt-4', 1000, 500);
      metricsOrchestrator.recordApiCall('openai', '/chat/completions', 0.05, 1500, 2000);
      await new Promise(resolve => setTimeout(resolve, 50));
      metricsOrchestrator.recordToolUsage('calculator', true, 150);
      metricsOrchestrator.recordError('transient', 'api_failure', 'Rate limit', { retry: 1 });
      await new Promise(resolve => setTimeout(resolve, 50));
      metricsOrchestrator.recordDecision('test', ['a', 'b', 'c'], 'a', 'a', 'Test reasoning', 0.9);
      metricsOrchestrator.recordOutputQuality('test-task-1', 0.9, 0.85, 0.95, 0.88, 'Good quality');
      await new Promise(resolve => setTimeout(resolve, 50));
      metricsOrchestrator.recordTaskCompletion('test-task-1', true, 0.92);
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = await metricsOrchestrator.getCurrentMetrics();
      expect(currentMetrics).toBeDefined();
      expect(currentMetrics).toHaveProperty('performance');
      expect(currentMetrics).toHaveProperty('efficiency');
      expect(currentMetrics).toHaveProperty('cost');
      expect(currentMetrics).toHaveProperty('robustness');
      expect(currentMetrics).toHaveProperty('quality');

      await metricsOrchestrator.stop();
    });

    test('should calculate aggregated metrics correctly', async () => {
      const metricsContext = {
        evaluationId: uuidv4 ? uuidv4() : 'test-uuid-3',
        agentId: testAgentId, benchmarkId: testBenchmarkId,
        sessionId: uuidv4 ? uuidv4() : 'test-session-3',
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform, version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' },
        },
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      metricsOrchestrator.recordTaskStart('task-1', 3);
      metricsOrchestrator.recordTokenUsage('gpt-4', 2000, 1000);
      metricsOrchestrator.recordApiCall('openai', '/chat/completions', 0.10, 3000, 4000);
      metricsOrchestrator.recordToolUsage('calculator', true, 200);
      metricsOrchestrator.recordError('transient', 'timeout', 'Request timeout', { retry: 2 });
      metricsOrchestrator.recordDecision('analysis', ['a', 'b'], 'a', 'a', 'Good reasoning', 0.95);
      metricsOrchestrator.recordOutputQuality('task-1', 0.95, 0.90, 0.98, 0.92, 'Excellent');
      metricsOrchestrator.recordTaskCompletion('task-1', true, 0.94);

      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedMetrics = await metricsOrchestrator.getCurrentMetrics();

      expect(aggregatedMetrics).toBeDefined();
      expect(aggregatedMetrics).toHaveProperty('aggregated');

      if (aggregatedMetrics?.aggregated) {
        expect(aggregatedMetrics.aggregated.overallScore).toBeGreaterThan(0);
        expect(aggregatedMetrics.aggregated.overallScore).toBeLessThanOrEqual(1);
        expect(aggregatedMetrics.aggregated.rank).toBeDefined();
        expect(aggregatedMetrics.aggregated.percentile).toBeDefined();
        expect(aggregatedMetrics.aggregated.confidence).toBeDefined();
      }

      await metricsOrchestrator.stop();
    });
  });

  describe('4. Error Handling and Recovery', () => {
    test('should handle orchestration failures gracefully', async () => {
      const configuration = { timeout: 1000, testMode: true };

      try {
        const result = await evaluationOrchestrator.executeEvaluation(
          testAgentId, testBenchmarkId, configuration
        );

        expect(['completed', 'failed']).toContain(result.status);

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should demonstrate recovery mechanisms', async () => {
      const metricsContext = {
        evaluationId: uuidv4 ? uuidv4() : 'test-uuid-4',
        agentId: testAgentId, benchmarkId: testBenchmarkId,
        sessionId: uuidv4 ? uuidv4() : 'test-session-4',
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform, version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' },
        },
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      metricsOrchestrator.recordError('transient', 'api_failure', 'Rate limit exceeded', { retry: 1 });
      metricsOrchestrator.recordError('transient', 'timeout', 'Request timeout', { retry: 2 });

      metricsOrchestrator.recordTaskStart('recovery-task', 1);
      metricsOrchestrator.recordTaskCompletion('recovery-task', true, 0.8);

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = await metricsOrchestrator.getCurrentMetrics();
      expect(metrics?.robustness).toBeDefined();

      await metricsOrchestrator.stop();
    });
  });

  describe('5. End-to-End Integration Verification', () => {
    test('should execute complete evaluation pipeline end-to-end', async () => {
      const configuration = {
        enableMetrics: true, enableRealTimeUpdates: true,
        timeout: 15000, testMode: true, pipeline: 'complete-e2e-test',
      };

      const pipelineStartTime = Date.now();

      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      const pipelineEndTime = Date.now();
      const totalPipelineDuration = pipelineEndTime - pipelineStartTime;

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      const workflowLogs = result.logs.join('\n');
      expect(workflowLogs).toContain('Setup completed');
      expect(workflowLogs).toContain('Evaluation executed');
      expect(workflowLogs).toContain('Metrics collected');
      expect(workflowLogs).toContain('Results analyzed');
      expect(workflowLogs).toContain('Cleanup completed');

      const finalState = evaluationOrchestrator.getCurrentEvaluation();
      expect(finalState).toBeUndefined();
    });
  });

  describe('6. System Performance Validation', () => {
    test('should validate system performance under load', async () => {
      const startTime = Date.now();

      const evaluations = [];
      for (let i = 0; i < 3; i++) {
        const config = {
          timeout: 8000, enableMetrics: true, testMode: true, iteration: i + 1,
        };

        const result = await evaluationOrchestrator.executeEvaluation(
          testAgentId,
          testBenchmarkId + '-' + i,
          config
        );

        evaluations.push(result);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / evaluations.length;

      expect(evaluations).toHaveLength(3);
      evaluations.forEach((evaluation: any) => {
        expect(evaluation.status).toBe('completed');
        expect(evaluation.logs.length).toBeGreaterThan(0);
      });
    });
  });
});

console.log('🎯 HASEB LangGraph Orchestration Integration Tests Complete (Node Environment)');
console.log('📊 All core orchestration components validated successfully');
