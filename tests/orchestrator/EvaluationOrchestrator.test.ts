import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EvaluationOrchestrator } from '@/orchestrator/EvaluationOrchestrator';
import { EvaluationQueue } from '@/orchestrator/EvaluationQueue';
import { WebSocketManager } from '@/orchestrator/WebSocketManager';
import { EnvironmentManager } from '@/orchestrator/EnvironmentManager';
import { MetricsCollector } from '@/orchestrator/MetricsCollector';
import { ExecutionEngine } from '@/orchestrator/ExecutionEngine';
import { ErrorHandler } from '@/orchestrator/ErrorHandler';
import { EvaluationModel } from '@/database/models/Evaluation';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';

// Mock dependencies
jest.mock('../../src/database/models/Evaluation'));
jest.mock('../../src/database/models/Agent'));
jest.mock('../../src/database/models/Benchmark'));
jest.mock('../../src/orchestrator/EvaluationQueue'));
jest.mock('../../src/orchestrator/WebSocketManager'));
jest.mock('../../src/orchestrator/EnvironmentManager'));
jest.mock('../../src/orchestrator/MetricsCollector'));
jest.mock('../../src/orchestrator/ExecutionEngine'));
jest.mock('../../src/orchestrator/ErrorHandler'));

describe('EvaluationOrchestrator', () => {
  let orchestrator: EvaluationOrchestrator;
  let mockQueue: jest.Mocked<EvaluationQueue>;
  let mockWsManager: jest.Mocked<WebSocketManager>;
  let mockEnvManager: jest.Mocked<EnvironmentManager>;
  let mockMetricsCollector: jest.Mocked<MetricsCollector>;
  let mockExecutionEngine: jest.Mocked<ExecutionEngine>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockQueue = new EvaluationQueue() as jest.Mocked<EvaluationQueue>;
    mockWsManager = new WebSocketManager() as jest.Mocked<WebSocketManager>;
    mockEnvManager = new EnvironmentManager() as jest.Mocked<EnvironmentManager>;
    mockMetricsCollector = new MetricsCollector() as jest.Mocked<MetricsCollector>;
    mockExecutionEngine = new ExecutionEngine() as jest.Mocked<ExecutionEngine>;
    mockErrorHandler = new ErrorHandler() as jest.Mocked<ErrorHandler>;

    // Mock the constructors
    (EvaluationQueue as jest.Mock).mockImplementation(() => mockQueue);
    (WebSocketManager as jest.Mock).mockImplementation(() => mockWsManager);
    (EnvironmentManager as jest.Mock).mockImplementation(() => mockEnvManager);
    (MetricsCollector as jest.Mock).mockImplementation(() => mockMetricsCollector);
    (ExecutionEngine as jest.Mock).mockImplementation(() => mockExecutionEngine);
    (ErrorHandler as jest.Mock).mockImplementation(() => mockErrorHandler);

    // Create orchestrator instance
    orchestrator = new EvaluationOrchestrator({
      maxConcurrentEvaluations: 2,
      defaultTimeout: 30000,
      enableRealTimeUpdates: true
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
      expect(EvaluationQueue).toHaveBeenCalledTimes(1);
      expect(WebSocketManager).toHaveBeenCalledTimes(1);
      expect(EnvironmentManager).toHaveBeenCalledTimes(1);
      expect(MetricsCollector).toHaveBeenCalledTimes(1);
      expect(ExecutionEngine).toHaveBeenCalledTimes(1);
      expect(ErrorHandler).toHaveBeenCalledTimes(1);
    });

    it('should initialize with custom configuration', () => {
      const customOrchestrator = new EvaluationOrchestrator({
        maxConcurrentEvaluations: 10,
        defaultTimeout: 60000,
        enableAutoRetry: false
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
      endTime: undefined
    };

    const mockAgent = {
      id: 'agent-123',
      name: 'Test Agent',
      type: 'test',
      capabilities: ['code-generation'],
      status: 'active',
      configuration: {},
      createdAt: new Date()
    };

    const mockBenchmark = {
      id: 'benchmark-123',
      name: 'Test Benchmark',
      type: 'swe-bench',
      description: 'Test benchmark',
      dataset: 'test-dataset',
      configuration: {},
      isActive: true,
      createdAt: new Date()
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

      // Mock active evaluation
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
        metadata: {}
      };

      // Add to active evaluations
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

      // Mock failed state
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
        metadata: {}
      };

      orchestrator['activeEvaluations'].set(evaluationId, mockState);

      // Mock database evaluation
      (EvaluationModel.findById as jest.Mock).mockResolvedValue({
        id: evaluationId,
        agentId: 'agent-123',
        benchmarkId: 'benchmark-123',
        status: 'failed',
        configuration: {},
        logs: [],
        startTime: new Date(),
        endTime: new Date()
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
        endTime: new Date()
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
        status: 'completed', // Already completed
        configuration: {},
        logs: [],
        startTime: new Date(),
        endTime: new Date()
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
        metadata: {}
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
        metrics: { taskSuccessRate: 90 }
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
        avg_execution_time: 1800000 // 30 minutes
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
        name: 'Test Benchmark'
      });

      const result = await orchestrator.estimateDuration(agentId, benchmarkId);

      expect(result).toBe(1800000); // 30 minutes * 3 (complexity factor)
    });

    it('should return default duration if benchmark not found', async () => {
      const agentId = 'agent-123';
      const benchmarkId = 'benchmark-123';

      (EvaluationModel.getAverageMetrics as jest.Mock).mockResolvedValue(null);
      (BenchmarkModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await orchestrator.estimateDuration(agentId, benchmarkId);

      expect(result).toBe(3600000); // 1 hour default
    });
  });

  describe('getMetrics', () => {
    it('should return orchestrator metrics', async () => {
      // Mock active evaluations
      orchestrator['activeEvaluations'].set('eval-1', { status: 'execute' });
      orchestrator['activeEvaluations'].set('eval-2', { status: 'setup' });

      (EvaluationModel.list as jest.Mock).mockResolvedValue({
        evaluations: [
          { status: 'completed', metrics: { taskSuccessRate: 90 } },
          { status: 'completed', metrics: { taskSuccessRate: 80 } },
          { status: 'completed', metrics: { taskSuccessRate: 85 } }
        ],
        total: 3
      });

      (mockQueue.getLength as jest.Mock).mockResolvedValue(5);
      (mockWsManager.getConnectionCount as jest.Mock).mockReturnValue(10);

      const result = await orchestrator.getMetrics();

      expect(result).toEqual({
        totalEvaluations: 2,
        runningEvaluations: 1,
        successRate: 100, // All completed evaluations have success rate > 80%
        averageDuration: expect.any(Number),
        systemLoad: expect.any(Number),
        activeConnections: 10,
        queueLength: 5
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
        startTime: new Date()
      });

      (AgentModel.findById as jest.Mock).mockResolvedValue({
        id: 'agent-123',
        name: 'Test Agent',
        type: 'test',
        capabilities: [],
        status: 'active',
        configuration: {},
        createdAt: new Date()
      });

      (BenchmarkModel.findById as jest.Mock).mockResolvedValue({
        id: 'benchmark-123',
        name: 'Test Benchmark',
        type: 'swe-bench',
        description: 'Test',
        dataset: 'test',
        configuration: {},
        isActive: true,
        createdAt: new Date()
      });

      (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);

      // Mock environment manager to throw error
      mockEnvManager.createEnvironment.mockRejectedValue(new Error('Environment creation failed'));

      const result = await orchestrator.startEvaluation(evaluationId);

      expect(result).toBe(true); // Should still return true as it starts asynchronously
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
        startTime: new Date()
      });

      (AgentModel.findById as jest.Mock).mockResolvedValue({
        id: 'agent-123',
        name: 'Test Agent',
        type: 'test',
        capabilities: [],
        status: 'active',
        configuration: {},
        createdAt: new Date()
      });

      (BenchmarkModel.findById as jest.Mock).mockResolvedValue({
        id: 'benchmark-123',
        name: 'Test Benchmark',
        type: 'swe-bench',
        description: 'Test',
        dataset: 'test',
        configuration: {},
        isActive: true,
        createdAt: new Date()
      });

      (EvaluationModel.updateStatusWithTime as jest.Mock).mockResolvedValue(true);
      (EvaluationModel.updateMetrics as jest.Mock).mockResolvedValue(true);

      // Mock successful environment creation
      mockEnvManager.createEnvironment.mockResolvedValue({
        id: 'env-123',
        type: 'docker',
        status: 'ready',
        resources: { cpu: 2, memory: 4096, disk: 10240, network: true },
        configuration: {}
      });

      // Mock successful task execution
      mockExecutionEngine.loadTasks.mockResolvedValue([
        {
          id: 'task-1',
          type: 'code-generation',
          description: 'Test task',
          input: {},
          expectedOutput: {},
          difficulty: 'medium',
          category: 'test',
          tags: []
        }
      ]);

      mockExecutionEngine.executeTask.mockResolvedValue({
        id: 'task-1',
        type: 'code-generation',
        description: 'Test task',
        input: {},
        expectedOutput: {},
        actualOutput: { result: 'success' },
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 5000,
        tokensUsed: 100,
        cost: 0.01,
        errors: [],
        metrics: {}
      });

      // Mock successful metrics collection
      mockMetricsCollector.collectPerformanceMetrics.mockResolvedValue({
        taskSuccessRate: 100,
        averageTaskTime: 5000,
        totalExecutionTime: 5000,
        tasksCompleted: 1,
        tasksTotal: 1,
        accuracy: 95,
        precision: 90,
        recall: 92,
        f1Score: 91
      });

      mockMetricsCollector.collectEfficiencyMetrics.mockResolvedValue({
        executionTime: 5000,
        latencyPerStep: 1000,
        totalSteps: 5,
        throughput: 0.2,
        resourceUtilization: 60,
        cpuUsage: 50,
        memoryUsage: 2048,
        diskUsage: 512,
        networkIO: 1024
      });

      mockMetricsCollector.collectCostMetrics.mockResolvedValue({
        totalTokens: 100,
        inputTokens: 50,
        outputTokens: 50,
        estimatedCost: 0.01,
        costPerTask: 0.01,
        costPerSuccess: 0.01,
        costPerToken: 0.0001
      });

      mockMetricsCollector.collectRobustnessMetrics.mockResolvedValue({
        toolCallErrorRate: 0,
        recoveryRate: 100,
        errorCount: 0,
        retryCount: 0,
        timeoutCount: 0,
        systemStability: 100,
        faultTolerance: 100
      });

      mockMetricsCollector.collectQualityMetrics.mockResolvedValue({
        toolSelectionAccuracy: 95,
        parameterAccuracy: 90,
        outputQuality: 92,
        codeQuality: 88,
        documentationQuality: 85,
        testCoverage: 80,
        securityScore: 90,
        maintainability: 87
      });

      mockMetricsCollector.analyzeResults.mockResolvedValue({
        overallScore: 92,
        insights: ['Excellent performance'],
        recommendations: ['Maintain current approach']
      });

      // Mock successful cleanup
      mockEnvManager.cleanupEnvironment.mockResolvedValue();

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