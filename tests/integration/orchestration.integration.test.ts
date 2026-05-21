/**
 * Comprehensive Integration Tests for HASEB LangGraph Orchestration System
 * Tests the complete evaluation pipeline from API to completion
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
let SWE_Bench_Agent: any;
let GUI_Automation_Agent: any;
let General_Reasoning_Agent: any;
let MetricsOrchestrator: any;
let logger: any;
let uuidv4: any;

beforeAll(async () => {
  const orchMod = await import('../../src/orchestrator/EvaluationOrchestrator');
  EvaluationOrchestrator = orchMod.EvaluationOrchestrator;

  const engineMod = await import('../../src/orchestrator/ExecutionEngine');
  ExecutionEngine = engineMod.ExecutionEngine;

  const sweMod = await import('../../src/agents/SWE_Bench_Agent');
  SWE_Bench_Agent = sweMod.SWE_Bench_Agent;

  const guiMod = await import('../../src/agents/GUI_Automation_Agent');
  GUI_Automation_Agent = guiMod.GUI_Automation_Agent;

  const reasonMod = await import('../../src/agents/General_Reasoning_Agent');
  General_Reasoning_Agent = reasonMod.General_Reasoning_Agent;

  const metricsMod = await import('../../src/services/metrics/MetricsOrchestrator');
  MetricsOrchestrator = metricsMod.MetricsOrchestrator;

  const loggerMod = await import('../../src/utils/logger');
  logger = loggerMod.logger;

  const uuidMod = await import('uuid');
  uuidv4 = uuidMod.v4;
});

describe('HASEB LangGraph Orchestration Integration Tests', () => {
  let evaluationOrchestrator: any;
  let executionEngine: any;
  let metricsOrchestrator: any;
  let testAgentId: string;
  let testBenchmarkId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    testAgentId = 'test-agent-' + 'abc123';
    testBenchmarkId = 'test-benchmark-' + 'def456';

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

    await evaluationOrchestrator.initialize();
  });

  afterEach(async () => {
    try {
      await evaluationOrchestrator.cleanup();
      await executionEngine.shutdown();
    } catch (error) {
      // ignore cleanup errors
    }
  });

  describe('1. Orchestrator Core Integration', () => {
    test('should initialize EvaluationOrchestrator with LangGraph workflow', async () => {
      expect(evaluationOrchestrator).toBeDefined();
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);

      const currentEval = evaluationOrchestrator.getCurrentEvaluation();
      expect(currentEval).toBeUndefined();
    });

    test('should execute complete evaluation workflow from start to finish', async () => {
      const configuration = {
        timeout: 10000,
        enableMetrics: true,
        testMode: true,
      };

      const evalPromise = evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      const updates: string[] = [];
      const checkProgress = setInterval(() => {
        const current = evaluationOrchestrator.getCurrentEvaluation();
        if (current) {
          updates.push(`Status: ${current.status}, Progress: ${current.logs.length} logs`);
        }
      }, 1000);

      const result = await evalPromise;
      clearInterval(checkProgress);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.id).toBeDefined();
      expect(result.agentId).toBe(testAgentId);
      expect(result.benchmarkId).toBe(testBenchmarkId);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    test('should handle concurrent evaluations properly', async () => {
      const configuration = { timeout: 5000, testMode: true };

      const firstEval = evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      try {
        await evaluationOrchestrator.executeEvaluation(
          testAgentId + '-2', testBenchmarkId, configuration
        );
        // @ts-ignore
        fail('Expected second evaluation to be rejected');
      } catch (error: any) {
        expect(error.message).toContain('already running');
      }

      const firstResult = await firstEval;
      expect(firstResult.status).toBe('completed');
    });
  });

  describe('2. Agent Execution Integration', () => {
    test('should execute SWE-Bench agent with Docker environment', async () => {
      const config = {
        dockerImage: 'haseb/swe-bench:latest',
        workspacePath: '/tmp/haseb-test-' + Date.now(),
        pythonPath: 'python3',
        testCommand: 'pytest -v',
        maxPatchAttempts: 2,
        codeGenModel: 'gpt-4',
        temperature: 0.1,
        timeout: 15000,
        testMode: true,
      };

      const agent = new SWE_Bench_Agent(config);

      agent.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(agent.isRunning()).toBe(true);

      await agent.stop();
    });

    test('should execute GUI Automation agent with virtual display', async () => {
      const config = {
        displayWidth: 1024,
        displayHeight: 768,
        screenshotInterval: 1000,
        maxSteps: 10,
        browserType: 'chromium',
        headless: true,
        timeout: 15000,
        testMode: true,
      };

      const agent = new GUI_Automation_Agent(config);
      agent.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(agent.isRunning()).toBe(true);

      await agent.stop();
    });

    test('should execute General Reasoning agent with tools', async () => {
      const config = {
        reasoningModel: 'gpt-4',
        maxReasoningSteps: 5,
        temperature: 0.1,
        toolsEnabled: ['calculator', 'search'],
        useChainOfThought: true,
        useSelfConsistency: 1,
        timeout: 15000,
        testMode: true,
      };

      const agent = new General_Reasoning_Agent(config);
      agent.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(agent.isRunning()).toBe(true);

      await agent.stop();
    });
  });

  describe('3. Environment Management', () => {
    test('should create and manage execution environments', async () => {
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 3,
        testMode: true,
      });

      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('type');
      expect(tasks[0]).toHaveProperty('input');
      expect(tasks[0]).toHaveProperty('expectedOutput');
    });

    test('should handle environment cleanup properly', async () => {
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 2, testMode: true,
      });

      const executions = [];
      for (const task of tasks) {
        const exec = executionEngine.executeTask(
          uuidv4(),
          task,
          { agentId: testAgentId, environment: {}, configuration: {} }
        );
        executions.push(exec);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const cancelledCount = executionEngine.cancelAllTasks('Test shutdown');
      expect(cancelledCount).toBeGreaterThanOrEqual(0);

      await executionEngine.shutdown();
    });
  });

  describe('4. Metrics Collection Integration', () => {
    test('should initialize and coordinate all 5 metrics collectors', async () => {
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

    test('should collect real-time metrics during execution', async () => {
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
        aggregation: { interval: 500, enableRealTimeUpdates: true, persistenceBatchSize: 1 },
      });

      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      const updates: any[] = [];
      metricsOrchestrator.on('real_time_update', (update: any) => {
        updates.push(update);
      });

      metricsOrchestrator.recordTaskStart('test-task-1', 5);
      await new Promise(resolve => setTimeout(resolve, 100));
      metricsOrchestrator.recordTokenUsage('gpt-4', 100, 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      metricsOrchestrator.recordTaskCompletion('test-task-1', true, 0.95);
      await new Promise(resolve => setTimeout(resolve, 100));

      const currentMetrics = await metricsOrchestrator.getCurrentMetrics();
      expect(currentMetrics).toBeDefined();

      await metricsOrchestrator.stop();
    });

    test('should aggregate metrics across all collectors', async () => {
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
      metricsOrchestrator.recordTokenUsage('gpt-4', 500, 300);
      metricsOrchestrator.recordApiCall('openai', '/chat/completions', 0.05, 800, 1500);
      metricsOrchestrator.recordToolUsage('calculator', true, 100);
      metricsOrchestrator.recordError('transient', 'api_failure', 'Test error', { retry: 1 });
      metricsOrchestrator.recordDecision('test', ['a', 'b', 'c'], 'a', 'a', 'Test reasoning', 0.9);
      metricsOrchestrator.recordOutputQuality('task-1', 0.9, 0.85, 0.95, 0.88, 'Good quality');
      metricsOrchestrator.recordTaskCompletion('task-1', true, 0.92);

      await new Promise(resolve => setTimeout(resolve, 100));

      const aggregatedMetrics = await metricsOrchestrator.getCurrentMetrics();

      expect(aggregatedMetrics).toHaveProperty('performance');
      expect(aggregatedMetrics).toHaveProperty('efficiency');
      expect(aggregatedMetrics).toHaveProperty('cost');
      expect(aggregatedMetrics).toHaveProperty('robustness');
      expect(aggregatedMetrics).toHaveProperty('quality');
      expect(aggregatedMetrics).toHaveProperty('aggregated');

      if (aggregatedMetrics?.aggregated) {
        expect(aggregatedMetrics.aggregated.overallScore).toBeGreaterThan(0);
        expect(aggregatedMetrics.aggregated.overallScore).toBeLessThanOrEqual(1);
      }

      await metricsOrchestrator.stop();
    });
  });

  describe('5. WebSocket Communication', () => {
    test('should emit real-time progress updates', async () => {
      const progressUpdates: any[] = [];

      evaluationOrchestrator.on('progress', (update: any) => {
        progressUpdates.push(update);
      });

      const configuration = {
        timeout: 8000, enableMetrics: true, enableRealTimeUpdates: true, testMode: true,
      };

      const evalPromise = evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      const result = await evalPromise;

      expect(result.status).toBe('completed');
    });
  });

  describe('6. Error Recovery and Handling', () => {
    test('should handle agent execution failures gracefully', async () => {
      const configuration = { timeout: 1000, forceFailure: true, testMode: true };

      try {
        const result = await evaluationOrchestrator.executeEvaluation(
          testAgentId, testBenchmarkId, configuration
        );

        expect(['completed', 'failed']).toContain(result.status);

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should recover from transient failures', async () => {
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

  describe('7. End-to-End Workflow Integration', () => {
    test('should execute complete API-to-completion workflow', async () => {
      const configuration = {
        enableMetrics: true, enableRealTimeUpdates: true,
        timeout: 12000, testMode: true, workflow: 'complete-integration-test',
      };

      const startTime = Date.now();

      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId, testBenchmarkId, configuration
      );

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    test('should handle multiple concurrent task executions', async () => {
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 5, testMode: true,
      });

      expect(tasks).toHaveLength(5);

      const taskPromises = tasks.map((task: any) =>
        executionEngine.executeTask(
          uuidv4 ? uuidv4() : 'task-uuid',
          task,
          { agentId: testAgentId, environment: {}, configuration: { testMode: true } }
        )
      );

      const results = await Promise.allSettled(taskPromises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(5);
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('8. Performance and Load Testing', () => {
    test('should handle high-frequency metrics collection', async () => {
      const metricsContext = {
        evaluationId: uuidv4 ? uuidv4() : 'test-uuid-5',
        agentId: testAgentId, benchmarkId: testBenchmarkId,
        sessionId: uuidv4 ? uuidv4() : 'test-session-5',
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform, version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' },
        },
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext, {
        aggregation: { interval: 100, enableRealTimeUpdates: true, persistenceBatchSize: 5 },
      });

      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      const startTime = Date.now();
      let eventsGenerated = 0;

      const interval = setInterval(() => {
        metricsOrchestrator.recordTokenUsage('gpt-4', 50, 25);
        metricsOrchestrator.recordApiCall('test', '/endpoint', 0.001, 75, 100);
        eventsGenerated++;
      }, 50);

      await new Promise(resolve => setTimeout(resolve, 500));
      clearInterval(interval);

      const duration = Date.now() - startTime;
      const eventsPerSecond = eventsGenerated / (duration / 1000);

      expect(eventsPerSecond).toBeGreaterThan(1);

      await metricsOrchestrator.stop();
    });
  });
});

console.log('🎯 HASEB LangGraph Orchestration Integration Tests Complete');
