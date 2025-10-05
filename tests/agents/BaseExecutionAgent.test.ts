import { BaseExecutionAgent, BaseAgentConfig, AgentMetrics } from '@/agents/BaseExecutionAgent';
import { EvaluationModel } from '@/database/models/Evaluation';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('../../src/database/models/Evaluation');
jest.mock('../../src/utils/logger');

const mockEvaluationModel = EvaluationModel as jest.Mocked<typeof EvaluationModel>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Test implementation of BaseExecutionAgent
class TestExecutionAgent extends BaseExecutionAgent {
  protected async executeTasks(): Promise<void> {
    // Mock implementation
    this.updateProgress(25, 'Starting test tasks');
    this.log('Test task executed');
    this.recordTaskCompletion(true, 100, 0.01);
    this.updateProgress(50, 'Task completed');
    this.recordTaskCompletion(true, 150, 0.015);
    this.updateProgress(75, 'Second task completed');
    this.recordTaskCompletion(false, 50, 0.005);
    this.updateProgress(100, 'All tasks completed');
  }
}

describe('BaseExecutionAgent', () => {
  let agent: TestExecutionAgent;
  let mockConfig: BaseAgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      agentId: 'test-agent-1',
      benchmarkId: 'test-benchmark-1',
      configuration: { testParam: 'testValue' },
      timeout: 60000,
      maxRetries: 3
    };

    // Mock EvaluationModel methods
    mockEvaluationModel.create = jest.fn().mockResolvedValue({
      id: 'eval-123',
      agentId: mockConfig.agentId,
      benchmarkId: mockConfig.benchmarkId,
      status: 'pending',
      configuration: mockConfig.configuration,
      logs: [],
      metrics: null,
      startTime: new Date(),
      endTime: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    mockEvaluationModel.updateStatus = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.updateStatusWithTime = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.updateMetrics = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.addLogs = jest.fn().mockResolvedValue(true);
    mockEvaluationModel.findById = jest.fn().mockResolvedValue({
      id: 'eval-123',
      agentId: mockConfig.agentId,
      benchmarkId: mockConfig.benchmarkId,
      status: 'completed',
      configuration: mockConfig.configuration,
      logs: [],
      metrics: {
        taskSuccessRate: 1.0,
        executionTime: 100,
        latencyPerStep: 50,
        totalSteps: 2,
        totalTokens: 100,
        estimatedCost: 0.01,
        toolCallErrorRate: 0,
        recoveryRate: 1.0,
        toolSelectionAccuracy: 1.0,
        parameterAccuracy: 1.0
      },
      startTime: new Date(),
      endTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    agent = new TestExecutionAgent(mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.getStatus()).toBe('pending');
      expect(agent.getConfiguration()).toEqual(mockConfig.configuration);
    });

    it('should initialize metrics with default values', () => {
      const metrics = agent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBe(0);
      expect(metrics.performance.totalTasks).toBe(0);
      expect(metrics.efficiency.executionTime).toBe(0);
      expect(metrics.cost.totalTokens).toBe(0);
    });

    it('should use default timeout and retries when not provided', () => {
      const configWithoutDefaults: BaseAgentConfig = {
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        configuration: {}
      };

      const agentWithoutDefaults = new TestExecutionAgent(configWithoutDefaults);
      expect(agentWithoutDefaults.getStatus()).toBe('pending');
    });
  });

  describe('Execution', () => {
    it('should execute successfully and create evaluation', async () => {
      const result = await agent.execute();

      expect(mockEvaluationModel.create).toHaveBeenCalledWith({
        agentId: mockConfig.agentId,
        benchmarkId: mockConfig.benchmarkId,
        status: 'pending',
        configuration: mockConfig.configuration,
        logs: [],
        metrics: null,
        startTime: expect.any(Date),
        endTime: undefined
      });

      expect(mockEvaluationModel.updateStatus).toHaveBeenCalledWith('eval-123', 'running', expect.any(Date));
      expect(mockEvaluationModel.updateStatusWithTime).toHaveBeenCalledWith(
        'eval-123',
        'completed',
        expect.any(Date),
        expect.any(Date)
      );

      expect(result.id).toBe('eval-123');
      expect(result.status).toBe('completed');
    });

    it('should handle execution failure', async () => {
      class FailingAgent extends TestExecutionAgent {
        protected async executeTasks(): Promise<void> {
          throw new Error('Test execution failed');
        }
      }

      const failingAgent = new FailingAgent(mockConfig);

      await expect(failingAgent.execute()).rejects.toThrow('Test execution failed');

      expect(mockEvaluationModel.updateStatusWithTime).toHaveBeenCalledWith(
        'eval-123',
        'failed',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should emit events during execution', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      const progressSpy = jest.fn();
      const logSpy = jest.fn();

      agent.on('started', startedSpy);
      agent.on('completed', completedSpy);
      agent.on('progress', progressSpy);
      agent.on('log', logSpy);

      await agent.execute();

      expect(startedSpy).toHaveBeenCalledWith({
        evaluationId: 'eval-123',
        agentId: mockConfig.agentId
      });

      expect(completedSpy).toHaveBeenCalledWith({
        evaluationId: 'eval-123',
        metrics: expect.any(Object),
        duration: expect.any(Number)
      });

      expect(progressSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
    });

    it('should respect timeout', async () => {
      const configWithShortTimeout = {
        ...mockConfig,
        timeout: 100 // 100ms timeout
      };

      class SlowAgent extends TestExecutionAgent {
        protected async executeTasks(): Promise<void> {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms execution
        }
      }

      const slowAgent = new SlowAgent(configWithShortTimeout);

      await expect(slowAgent.execute()).rejects.toThrow('timeout');
    });
  });

  describe('Metrics Tracking', () => {
    it('should record task completion correctly', () => {
      agent['recordTaskCompletion'](true, 150, 0.015);

      const metrics = agent.getMetrics();
      expect(metrics.performance.totalTasks).toBe(1);
      expect(metrics.performance.completedTasks).toBe(1);
      expect(metrics.performance.failedTasks).toBe(0);
      expect(metrics.cost.totalTokens).toBe(150);
      expect(metrics.cost.estimatedCost).toBe(0.015);
    });

    it('should record task failure correctly', () => {
      agent['recordTaskCompletion'](false, 50, 0.005);

      const metrics = agent.getMetrics();
      expect(metrics.performance.totalTasks).toBe(1);
      expect(metrics.performance.completedTasks).toBe(0);
      expect(metrics.performance.failedTasks).toBe(1);
      expect(metrics.robustness.errorCount).toBe(1);
    });

    it('should calculate success rate correctly', () => {
      agent['recordTaskCompletion'](true, 100, 0.01);
      agent['recordTaskCompletion'](false, 100, 0.01);
      agent['recordTaskCompletion'](true, 100, 0.01);

      // Manually trigger success rate calculation by simulating execution completion
      agent['startTime'] = new Date(Date.now() - 1000);
      agent['endTime'] = new Date();
      agent['calculateFinalMetrics']();

      const metrics = agent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBe(2/3);
    });

    it('should record step execution time', () => {
      const stepTime = 1500; // 1.5 seconds
      agent['recordStepExecution'](stepTime);

      const metrics = agent.getMetrics();
      expect(metrics.efficiency.totalSteps).toBe(1);
      expect(metrics.efficiency.latencyPerStep).toBe(stepTime);
    });

    it('should record error recovery', () => {
      agent['recordErrorRecovery']();

      const metrics = agent.getMetrics();
      expect(metrics.robustness.recoveryCount).toBe(1);
    });
  });

  describe('Logging', () => {
    it('should add logs to the log array', () => {
      const logMessage = 'Test log message';
      agent['log'](logMessage);

      const logs = agent.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain(logMessage);
      expect(logs[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/); // Timestamp format
    });

    it('should emit log events', () => {
      const logSpy = jest.fn();
      agent.on('log', logSpy);

      const logMessage = 'Test log message';
      agent['log'](logMessage);

      expect(logSpy).toHaveBeenCalledWith({
        message: expect.stringContaining(logMessage),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Progress Updates', () => {
    it('should emit progress events', () => {
      const progressSpy = jest.fn();
      agent.on('progress', progressSpy);

      const progress = 50;
      const message = 'Half way there';

      agent['updateProgress'](progress, message);

      expect(progressSpy).toHaveBeenCalledWith({
        progress,
        message
      });
    });
  });

  describe('Cancellation', () => {
    it('should cancel running agent', async () => {
      // Create a slow agent for cancellation testing
      class SlowTestAgent extends TestExecutionAgent {
        protected async executeTasks(): Promise<void> {
          this.updateProgress(10, 'Starting slow task');
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          this.updateProgress(50, 'Mid-task');
          await new Promise(resolve => setTimeout(resolve, 100)); // Another 100ms delay
          this.updateProgress(100, 'Task completed');
          this.recordTaskCompletion(true, 100, 0.01);
        }
      }

      const slowAgent = new SlowTestAgent(mockConfig);

      // Start execution in background
      const executionPromise = slowAgent.execute();

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cancel the agent
      slowAgent.cancel();

      expect(slowAgent.getStatus()).toBe('cancelled');

      // The execution should complete without error (cancellation is graceful)
      await executionPromise;
    });

    it('should emit cancellation event', async () => {
      const cancelSpy = jest.fn();

      // Create a slow agent
      class SlowTestAgent extends TestExecutionAgent {
        protected async executeTasks(): Promise<void> {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          this.recordTaskCompletion(true, 100, 0.01);
        }
      }

      const slowAgent = new SlowTestAgent(mockConfig);
      slowAgent.on('cancelled', cancelSpy);

      // Start execution
      const executionPromise = slowAgent.execute();

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cancel the agent
      slowAgent.cancel();

      expect(cancelSpy).toHaveBeenCalledWith({
        evaluationId: expect.any(String)
      });

      // Wait for execution to complete
      await executionPromise;
    });

    it('should update evaluation status when cancelled', async () => {
      // Create a slow agent
      class SlowTestAgent extends TestExecutionAgent {
        protected async executeTasks(): Promise<void> {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          this.recordTaskCompletion(true, 100, 0.01);
        }
      }

      const slowAgent = new SlowTestAgent(mockConfig);

      // Start execution
      const executionPromise = slowAgent.execute();

      // Wait for evaluation to be created
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cancel the agent
      slowAgent.cancel();

      await executionPromise;

      expect(mockEvaluationModel.updateStatusWithTime).toHaveBeenCalledWith(
        expect.any(String),
        'cancelled',
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  describe('Status and State', () => {
    it('should return correct status', () => {
      expect(agent.getStatus()).toBe('pending');
      expect(agent.isExecutionRunning()).toBe(false);
    });

    it('should return configuration', () => {
      const config = agent.getConfiguration();
      expect(config).toEqual(mockConfig.configuration);
    });

    it('should return deep copy of metrics', () => {
      const metrics1 = agent.getMetrics();
      const metrics2 = agent.getMetrics();

      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2); // Different object references
    });

    it('should return deep copy of logs', () => {
      agent['log']('Test log');
      const logs1 = agent.getLogs();
      const logs2 = agent.getLogs();

      expect(logs1).toEqual(logs2);
      expect(logs1).not.toBe(logs2); // Different object references
    });
  });

  describe('Error Handling', () => {
    it('should handle evaluation creation failure', async () => {
      mockEvaluationModel.create.mockRejectedValue(new Error('Database error'));

      await expect(agent.execute()).rejects.toThrow('Database error');
    });

    it('should handle evaluation update failures gracefully', async () => {
      mockEvaluationModel.updateStatus.mockRejectedValue(new Error('Update failed'));

      // Should fail when status update fails
      await expect(agent.execute()).rejects.toThrow('Update failed');
    });
  });

  describe('Final Metrics Calculation', () => {
    it('should calculate final metrics correctly', () => {
      // Create a test agent with no task execution for metrics testing
      class NoTaskAgent extends BaseExecutionAgent {
        protected async executeTasks(): Promise<void> {
          // No tasks executed
        }
      }

      const noTaskAgent = new NoTaskAgent(mockConfig);

      // Add some test data
      noTaskAgent['recordTaskCompletion'](true, 100, 0.01);
      noTaskAgent['recordTaskCompletion'](false, 50, 0.005);
      noTaskAgent['recordTaskCompletion'](true, 150, 0.015);
      noTaskAgent['recordStepExecution'](1000);
      noTaskAgent['recordStepExecution'](2000);

      // Manually set start and end times to simulate execution
      noTaskAgent['startTime'] = new Date(Date.now() - 1000);
      noTaskAgent['endTime'] = new Date();

      // Calculate final metrics manually
      noTaskAgent['calculateFinalMetrics']();

      const metrics = noTaskAgent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBe(2/3);
      expect(metrics.efficiency.executionTime).toBeGreaterThan(0);
      expect(metrics.cost.tokenCostPerTask).toBeGreaterThan(0);
    });

    it('should handle division by zero in metrics calculation', () => {
      // Create a test agent with no task execution for metrics testing
      class NoTaskAgent extends BaseExecutionAgent {
        protected async executeTasks(): Promise<void> {
          // No tasks executed
        }
      }

      const noTaskAgent = new NoTaskAgent(mockConfig);

      // Manually set start and end times to simulate execution
      noTaskAgent['startTime'] = new Date(Date.now() - 1000);
      noTaskAgent['endTime'] = new Date();

      // Calculate final metrics manually
      noTaskAgent['calculateFinalMetrics']();

      const metrics = noTaskAgent.getMetrics();
      expect(metrics.performance.taskSuccessRate).toBe(0);
      expect(metrics.efficiency.averageTaskTime).toBe(0);
      expect(metrics.cost.tokenCostPerTask).toBe(0);
    });
  });
});