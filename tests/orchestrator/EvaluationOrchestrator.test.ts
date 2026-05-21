import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { EvaluationOrchestrator as EvaluationOrchestratorType } from '@/orchestrator/EvaluationOrchestrator';

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
    list: jest.fn(),
    findByStatus: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(true),
    updateStatusWithTime: jest.fn().mockResolvedValue(true),
    updateMetrics: jest.fn().mockResolvedValue(true),
    getAverageMetrics: jest.fn(),
  },
}));

jest.unstable_mockModule('@/database/models/Agent', () => ({
  AgentModel: { findById: jest.fn() },
}));

jest.unstable_mockModule('@/database/models/Benchmark', () => ({
  BenchmarkModel: { findById: jest.fn() },
}));

// Mock the orchestrator sub-components so they don't pull in DB/langgraph
jest.unstable_mockModule('@/orchestrator/EvaluationQueue', () => ({
  EvaluationQueue: jest.fn().mockImplementation(() => ({
    getLength: jest.fn().mockResolvedValue(0),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

jest.unstable_mockModule('@/orchestrator/WebSocketManager', () => ({
  WebSocketManager: jest.fn().mockImplementation(() => ({
    getConnectionCount: jest.fn().mockReturnValue(0),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('@/orchestrator/EnvironmentManager', () => ({
  EnvironmentManager: jest.fn().mockImplementation(() => ({
    createEnvironment: jest.fn().mockResolvedValue({ id: 'env-123', type: 'docker', status: 'ready', resources: {}, configuration: {} }),
    cleanupEnvironment: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('@/orchestrator/MetricsCollector', () => ({
  MetricsCollector: jest.fn().mockImplementation(() => ({
    collectPerformanceMetrics: jest.fn().mockResolvedValue({ taskSuccessRate: 100, averageTaskTime: 5000, totalExecutionTime: 5000, tasksCompleted: 1, tasksTotal: 1, accuracy: 95, precision: 90, recall: 92, f1Score: 91 }),
    collectEfficiencyMetrics: jest.fn().mockResolvedValue({ executionTime: 5000, latencyPerStep: 1000, totalSteps: 5, throughput: 0.2, resourceUtilization: 60, cpuUsage: 50, memoryUsage: 2048, diskUsage: 512, networkIO: 1024 }),
    collectCostMetrics: jest.fn().mockResolvedValue({ totalTokens: 100, inputTokens: 50, outputTokens: 50, estimatedCost: 0.01, costPerTask: 0.01, costPerSuccess: 0.01, costPerToken: 0.0001 }),
    collectRobustnessMetrics: jest.fn().mockResolvedValue({ toolCallErrorRate: 0, recoveryRate: 100, errorCount: 0, retryCount: 0, timeoutCount: 0, systemStability: 100, faultTolerance: 100 }),
    collectQualityMetrics: jest.fn().mockResolvedValue({ toolSelectionAccuracy: 95, parameterAccuracy: 90, outputQuality: 92, codeQuality: 88, documentationQuality: 85, testCoverage: 80, securityScore: 90, maintainability: 87 }),
    analyzeResults: jest.fn().mockResolvedValue({ overallScore: 92, insights: [], recommendations: [] }),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('@/orchestrator/ExecutionEngine', () => ({
  ExecutionEngine: jest.fn().mockImplementation(() => ({
    loadTasks: jest.fn().mockResolvedValue([{ id: 'task-1', type: 'code-generation', description: 'Test task', input: {}, expectedOutput: {}, difficulty: 'medium', category: 'test', tags: [] }]),
    executeTask: jest.fn().mockResolvedValue({ id: 'task-1', type: 'code-generation', description: 'Test task', input: {}, expectedOutput: {}, actualOutput: { result: 'success' }, status: 'completed', startTime: new Date(), endTime: new Date(), duration: 5000, tokensUsed: 100, cost: 0.01, errors: [], metrics: {} }),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('@/orchestrator/ErrorHandler', () => ({
  ErrorHandler: jest.fn().mockImplementation(() => ({
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

let EvaluationOrchestrator: any;
let EvaluationQueue: any;
let WebSocketManager: any;
let EnvironmentManager: any;
let MetricsCollector: any;
let ExecutionEngine: any;
let ErrorHandler: any;
let EvaluationModel: any;
let AgentModel: any;
let BenchmarkModel: any;

// Jest ESM top-level await is allowed in module scope
const _mods = await (async () => {
  const orchMod = await import('@/orchestrator/EvaluationOrchestrator');
  EvaluationOrchestrator = orchMod.EvaluationOrchestrator;
  const queueMod = await import('@/orchestrator/EvaluationQueue');
  EvaluationQueue = queueMod.EvaluationQueue;
  const wsMod = await import('@/orchestrator/WebSocketManager');
  WebSocketManager = wsMod.WebSocketManager;
  const envMod = await import('@/orchestrator/EnvironmentManager');
  EnvironmentManager = envMod.EnvironmentManager;
  const collMod = await import('@/orchestrator/MetricsCollector');
  MetricsCollector = collMod.MetricsCollector;
  const engMod = await import('@/orchestrator/ExecutionEngine');
  ExecutionEngine = engMod.ExecutionEngine;
  const errMod = await import('@/orchestrator/ErrorHandler');
  ErrorHandler = errMod.ErrorHandler;
  const evalDbMod = await import('@/database/models/Evaluation');
  EvaluationModel = evalDbMod.EvaluationModel;
  const agentDbMod = await import('@/database/models/Agent');
  AgentModel = agentDbMod.AgentModel;
  const benchDbMod = await import('@/database/models/Benchmark');
  BenchmarkModel = benchDbMod.BenchmarkModel;
})();

describe('EvaluationOrchestrator', () => {
  let orchestrator: any;
  let mockQueue: any;
  let mockWsManager: any;
  let mockEnvManager: any;
  let mockMetricsCollector: any;
  let mockExecutionEngine: any;
  let mockErrorHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueue = new EvaluationQueue() as any;
    mockWsManager = new WebSocketManager() as any;
    mockEnvManager = new EnvironmentManager() as any;
    mockMetricsCollector = new MetricsCollector() as any;
    mockExecutionEngine = new ExecutionEngine() as any;
    mockErrorHandler = new ErrorHandler() as any;

    (EvaluationQueue as jest.Mock).mockImplementation(() => mockQueue);
    (WebSocketManager as jest.Mock).mockImplementation(() => mockWsManager);
    (EnvironmentManager as jest.Mock).mockImplementation(() => mockEnvManager);
    (MetricsCollector as jest.Mock).mockImplementation(() => mockMetricsCollector);
    (ExecutionEngine as jest.Mock).mockImplementation(() => mockExecutionEngine);
    (ErrorHandler as jest.Mock).mockImplementation(() => mockErrorHandler);

    orchestrator = new EvaluationOrchestrator({
      maxConcurrentEvaluations: 2,
      defaultTimeout: 30000,
      enableRealTimeUpdates: true,
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(orchestrator).toBeDefined();
      // beforeEach creates each mock instance once (to capture it) and the constructor
      // creates another, so each mock constructor is called twice total.
      expect(EvaluationQueue).toHaveBeenCalledTimes(2);
      expect(WebSocketManager).toHaveBeenCalledTimes(2);
      expect(EnvironmentManager).toHaveBeenCalledTimes(2);
      expect(MetricsCollector).toHaveBeenCalledTimes(2);
      expect(ExecutionEngine).toHaveBeenCalledTimes(2);
      expect(ErrorHandler).toHaveBeenCalledTimes(2);
    });

    it('should initialize with custom configuration', () => {
      const customOrchestrator = new EvaluationOrchestrator({
        maxConcurrentEvaluations: 10,
        defaultTimeout: 60000,
        enableAutoRetry: false,
      });

      expect(customOrchestrator).toBeDefined();
    });

    it('should setup event handlers', () => {
      expect(mockErrorHandler.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockEnvManager.on).toHaveBeenCalledWith('environmentReady', expect.any(Function));
      expect(mockExecutionEngine.on).toHaveBeenCalledWith('taskCompleted', expect.any(Function));
    });
  });

  describe('startEvaluation', () => {
    const mockEvaluation = {
      id: 'eval-123',
      agentId: 'agent-123',
      benchmarkId: 'benchmark-123',
      status: 'pending',
      configuration: {},
      logs: [],
      startTime: new Date(),
      endTime: undefined,
    };

    const mockAgent = {
      id: 'agent-123',
      name: 'Test Agent',
      type: 'test',
      capabilities: ['code-generation'],
      status: 'active',
      configuration: {},
      createdAt: new Date(),
    };

    const mockBenchmark = {
      id: 'benchmark-123',
      name: 'Test Benchmark',
      type: 'swe-bench',
      description: 'Test benchmark',
      dataset: 'test-dataset',
      configuration: {},
      isActive: true,
      createdAt: new Date(),
    };

    beforeEach(() => {
      (EvaluationModel.findById as jest.Mock).mockResolvedValue(mockEvaluation);
      (AgentModel.findById as jest.Mock).mockResolvedValue(mockAgent);
      (BenchmarkModel.findById as jest.Mock).mockResolvedValue(mockBenchmark);
      (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);
    });

    it('should start an evaluation successfully', async () => {
      const evaluationId = 'eval-123';

      const result = await orchestrator.startEvaluation(evaluationId);

      expect(result).toBe(true);
      expect(EvaluationModel.findById).toHaveBeenCalledWith(evaluationId);
      expect(AgentModel.findById).toHaveBeenCalledWith(mockEvaluation.agentId);
      expect(BenchmarkModel.findById).toHaveBeenCalledWith(mockEvaluation.benchmarkId);
      expect(EvaluationModel.updateStatusWithTime).toHaveBeenCalledWith(
        evaluationId,
        'running',
        expect.any(Date)
      );
    });

    it('should fail if evaluation not found', async () => {
      (EvaluationModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await orchestrator.startEvaluation('invalid-id');

      expect(result).toBe(false);
    });

    it('should fail if agent not found', async () => {
      (AgentModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await orchestrator.startEvaluation('eval-123');

      expect(result).toBe(false);
    });

    it('should fail if benchmark not found', async () => {
      (BenchmarkModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await orchestrator.startEvaluation('eval-123');

      expect(result).toBe(false);
    });
  });

  describe('stopEvaluation', () => {
    it('should stop a running evaluation', async () => {
      const evaluationId = 'eval-123';

      const mockState = {
        id: evaluationId,
        status: 'execute',
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        currentStep: 'execute',
        progress: 50,
        startTime: new Date(),
        configuration: {},
        environment: { id: 'env-123', type: 'docker', status: 'ready' },
        execution: { tasks: [], currentTaskIndex: 0, completedTasks: 0, failedTasks: 0, totalTasks: 10, executionHistory: [] },
        metrics: {},
        logs: [],
        errors: [],
        metadata: {},
      };

      orchestrator['activeEvaluations'].set(evaluationId, mockState);

      (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);

      const result = await orchestrator.stopEvaluation(evaluationId);

      expect(result).toBe(true);
      expect(mockState.status).toBe('cancelled');
      expect(mockState.endTime).toBeDefined();
      expect(EvaluationModel.updateStatusWithTime).toHaveBeenCalledWith(
        evaluationId,
        'cancelled',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should return false if evaluation not found', async () => {
      const result = await orchestrator.stopEvaluation('invalid-id');

      expect(result).toBe(false);
    });
  });

  describe('retryEvaluation', () => {
    it('should retry a failed evaluation', async () => {
      const evaluationId = 'eval-123';

      const mockState = {
        id: evaluationId,
        status: 'failed',
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        currentStep: null,
        progress: 0,
        startTime: new Date(),
        endTime: new Date(),
        configuration: {},
        environment: { id: 'env-123', type: 'docker', status: 'destroyed' },
        execution: { tasks: [], currentTaskIndex: 0, completedTasks: 0, failedTasks: 5, totalTasks: 10, executionHistory: [] },
        metrics: {},
        logs: [],
        errors: [{ id: 'error-1', timestamp: new Date(), type: 'system', severity: 'high', message: 'Test error', recoverable: true, retryCount: 0, maxRetries: 3 }],
        metadata: {},
      };

      orchestrator['activeEvaluations'].set(evaluationId, mockState);

      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'failed',
        configuration: {},
        logs: [],
        startTime: new Date(),
        endTime: new Date(),
      });

      (EvaluationModel.updateStatus as jest.Mock).mockResolvedValue(true);

      const result = await orchestrator.retryEvaluation(evaluationId);

      expect(result).toBe(true);
      expect(mockState.retryCount).toBe(1);
    });

    it('should retry from database if not in active evaluations', async () => {
      const evaluationId = 'eval-123';

      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'failed',
        configuration: {},
        logs: [],
        startTime: new Date(),
        endTime: new Date(),
      });

      (EvaluationModel.updateStatus as jest.Mock).mockResolvedValue(true);

      const result = await orchestrator.retryEvaluation(evaluationId);

      expect(result).toBe(true);
      expect(EvaluationModel.findById).toHaveBeenCalledWith(evaluationId);
      expect(EvaluationModel.updateStatus).toHaveBeenCalledWith(evaluationId, 'pending');
    });

    it('should return false if evaluation cannot be retried', async () => {
      const evaluationId = 'eval-123';

      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'completed',
        configuration: {},
        logs: [],
        startTime: new Date(),
        endTime: new Date(),
      });

      const result = await orchestrator.retryEvaluation(evaluationId);

      expect(result).toBe(false);
    });
  });

  describe('getEvaluationStatus', () => {
    it('should return status for active evaluation', async () => {
      const evaluationId = 'eval-123';
      const mockState = {
        id: evaluationId,
        status: 'execute' as const,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        currentStep: 'execute' as const,
        progress: 75,
        startTime: new Date(),
        configuration: {},
        environment: { id: 'env-123', type: 'docker', status: 'ready' },
        execution: { tasks: [], currentTaskIndex: 7, completedTasks: 7, failedTasks: 0, totalTasks: 10, executionHistory: [] },
        metrics: { taskSuccessRate: 85 },
        logs: [],
        errors: [],
        metadata: {},
      };

      orchestrator['activeEvaluations'].set(evaluationId, mockState);

      const result = await orchestrator.getEvaluationStatus(evaluationId);

      expect(result).toEqual(mockState);
    });

    it('should return status from database for inactive evaluation', async () => {
      const evaluationId = 'eval-123';

      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        configuration: {},
        logs: [],
        metrics: { taskSuccessRate: 90 },
      });

      const result = await orchestrator.getEvaluationStatus(evaluationId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(evaluationId);
      expect(result!.status).toBe('completed');
    });

    it('should return null if evaluation not found', async () => {
      (EvaluationModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await orchestrator.getEvaluationStatus('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('estimateDuration', () => {
    it('should return estimated duration based on historical data', async () => {
      const agentId = 'agent-123';
      const benchmarkId = 'benchmark-123';

      (EvaluationModel.getAverageMetrics as jest.Mock).mockResolvedValue({
        avg_execution_time: 1800000,
      });

      const result = await orchestrator.estimateDuration(agentId, benchmarkId);

      expect(result).toBe(1800000);
      expect(EvaluationModel.getAverageMetrics).toHaveBeenCalledWith(agentId, benchmarkId);
    });

    it('should return default duration if no historical data', async () => {
      const agentId = 'agent-123';
      const benchmarkId = 'benchmark-123';

      (EvaluationModel.getAverageMetrics as jest.Mock).mockResolvedValue(null);
      (BenchmarkModel.findById as jest.Mock).mockResolvedValue({
        id: benchmarkId,
        type: 'swe-bench',
        name: 'Test Benchmark',
      });

      const result = await orchestrator.estimateDuration(agentId, benchmarkId);

      expect(result).toBe(1800000);
    });

    it('should return default duration if benchmark not found', async () => {
      const agentId = 'agent-123';
      const benchmarkId = 'benchmark-123';

      (EvaluationModel.getAverageMetrics as jest.Mock).mockResolvedValue(null);
      (BenchmarkModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await orchestrator.estimateDuration(agentId, benchmarkId);

      expect(result).toBe(3600000);
    });
  });

  describe('getMetrics', () => {
    it('should return orchestrator metrics', async () => {
      orchestrator['activeEvaluations'].set('eval-1', { status: 'execute' });
      orchestrator['activeEvaluations'].set('eval-2', { status: 'setup' });

      (EvaluationModel.list as jest.Mock).mockResolvedValue({
        evaluations: [
          { status: 'completed', metrics: { taskSuccessRate: 90 } },
          { status: 'completed', metrics: { taskSuccessRate: 80 } },
          { status: 'completed', metrics: { taskSuccessRate: 85 } },
        ],
        total: 3,
      });

      (mockQueue.getLength as jest.Mock).mockResolvedValue(5);
      (mockWsManager.getConnectionCount as jest.Mock).mockReturnValue(10);

      const result = await orchestrator.getMetrics();

      expect(result).toEqual({
        totalEvaluations: 2,
        runningEvaluations: 1,
        successRate: 100,
        averageDuration: expect.any(Number),
        systemLoad: expect.any(Number),
        activeConnections: 10,
        queueLength: 5,
      });
    });
  });

  describe('error handling', () => {
    it('should handle evaluation start errors gracefully', async () => {
      (EvaluationModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await orchestrator.startEvaluation('eval-123');

      expect(result).toBe(false);
    });

    it('should handle environment setup errors', async () => {
      const evaluationId = 'eval-123';

      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'pending',
        configuration: {},
        logs: [],
        startTime: new Date(),
      });

      (AgentModel.findById as jest.Mock).mockResolvedValue({
        id: 'agent-123',
        name: 'Test Agent',
        type: 'test',
        capabilities: [],
        status: 'active',
        configuration: {},
        createdAt: new Date(),
      });

      (BenchmarkModel.findById as jest.Mock).mockResolvedValue({
        id: 'benchmark-123',
        name: 'Test Benchmark',
        type: 'swe-bench',
        description: 'Test',
        dataset: 'test',
        configuration: {},
        isActive: true,
        createdAt: new Date(),
      });

      (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);

      mockEnvManager.createEnvironment.mockRejectedValue(new Error('Environment creation failed'));

      const result = await orchestrator.startEvaluation(evaluationId);

      expect(result).toBe(true);
    });
  });

  describe('workflow execution', () => {
    it('should execute complete workflow for successful evaluation', async () => {
      const evaluationId = 'eval-123';

      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'pending',
        configuration: {},
        logs: [],
        startTime: new Date(),
      });

      (AgentModel.findById as jest.Mock).mockResolvedValue({
        id: 'agent-123',
        name: 'Test Agent',
        type: 'test',
        capabilities: [],
        status: 'active',
        configuration: {},
        createdAt: new Date(),
      });

      (BenchmarkModel.findById as jest.Mock).mockResolvedValue({
        id: 'benchmark-123',
        name: 'Test Benchmark',
        type: 'swe-bench',
        description: 'Test',
        dataset: 'test',
        configuration: {},
        isActive: true,
        createdAt: new Date(),
      });

      (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);
      (EvaluationModel.updateMetrics as jest.Mock).mockResolvedValue(true);

      mockEnvManager.createEnvironment.mockResolvedValue({
        id: 'env-123',
        type: 'docker',
        status: 'ready',
        resources: { cpu: 2, memory: 4096, disk: 10240, network: true },
        configuration: {},
      });

      mockExecutionEngine.loadTasks.mockResolvedValue([
        { id: 'task-1', type: 'code-generation', description: 'Test task', input: {}, expectedOutput: {}, difficulty: 'medium', category: 'test', tags: [] },
      ]);

      mockExecutionEngine.executeTask.mockResolvedValue({
        id: 'task-1', type: 'code-generation', description: 'Test task', input: {}, expectedOutput: {}, actualOutput: { result: 'success' }, status: 'completed', startTime: new Date(), endTime: new Date(), duration: 5000, tokensUsed: 100, cost: 0.01, errors: [], metrics: {},
      });

      mockMetricsCollector.collectPerformanceMetrics.mockResolvedValue({ taskSuccessRate: 100, averageTaskTime: 5000, totalExecutionTime: 5000, tasksCompleted: 1, tasksTotal: 1, accuracy: 95, precision: 90, recall: 92, f1Score: 91 });
      mockMetricsCollector.collectEfficiencyMetrics.mockResolvedValue({ executionTime: 5000, latencyPerStep: 1000, totalSteps: 5, throughput: 0.2, resourceUtilization: 60, cpuUsage: 50, memoryUsage: 2048, diskUsage: 512, networkIO: 1024 });
      mockMetricsCollector.collectCostMetrics.mockResolvedValue({ totalTokens: 100, inputTokens: 50, outputTokens: 50, estimatedCost: 0.01, costPerTask: 0.01, costPerSuccess: 0.01, costPerToken: 0.0001 });
      mockMetricsCollector.collectRobustnessMetrics.mockResolvedValue({ toolCallErrorRate: 0, recoveryRate: 100, errorCount: 0, retryCount: 0, timeoutCount: 0, systemStability: 100, faultTolerance: 100 });
      mockMetricsCollector.collectQualityMetrics.mockResolvedValue({ toolSelectionAccuracy: 95, parameterAccuracy: 90, outputQuality: 92, codeQuality: 88, documentationQuality: 85, testCoverage: 80, securityScore: 90, maintainability: 87 });
      mockMetricsCollector.analyzeResults.mockResolvedValue({ overallScore: 92, insights: ['Excellent performance'], recommendations: ['Maintain current approach'] });
      mockEnvManager.cleanupEnvironment.mockResolvedValue(undefined);

      const result = await orchestrator.startEvaluation(evaluationId);

      expect(result).toBe(true);
      expect(mockEnvManager.createEnvironment).toHaveBeenCalled();
      expect(mockExecutionEngine.loadTasks).toHaveBeenCalled();
      expect(mockExecutionEngine.executeTask).toHaveBeenCalled();
      expect(mockMetricsCollector.collectPerformanceMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.collectEfficiencyMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.collectCostMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.collectRobustnessMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.collectQualityMetrics).toHaveBeenCalled();
      expect(mockMetricsCollector.analyzeResults).toHaveBeenCalled();
      expect(mockEnvManager.cleanupEnvironment).toHaveBeenCalled();
    });
  });
});
