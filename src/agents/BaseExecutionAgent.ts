import { Evaluation, EvaluationMetrics, Agent } from '../types/index';
import { EvaluationModel } from '../database/models/Evaluation';
import { AgentModel } from '../database/models/Agent';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface BaseAgentConfig {
  agentId: string;
  benchmarkId: string;
  configuration: Record<string, any>;
  timeout?: number;
  maxRetries?: number;
}

export interface TaskExecution {
  taskId: string;
  type: string;
  input: any;
  expectedOutput?: any;
  metadata?: Record<string, any>;
}

export interface AgentMetrics {
  performance: {
    taskSuccessRate: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
  };
  efficiency: {
    executionTime: number;
    latencyPerStep: number;
    totalSteps: number;
    averageTaskTime: number;
  };
  cost: {
    totalTokens: number;
    estimatedCost: number;
    tokenCostPerTask: number;
  };
  robustness: {
    toolCallErrorRate: number;
    recoveryRate: number;
    errorCount: number;
    recoveryCount: number;
  };
  quality: {
    toolSelectionAccuracy: number;
    parameterAccuracy: number;
    outputQualityScore: number;
  };
}

export abstract class BaseExecutionAgent extends EventEmitter {
  protected agentId: string;
  protected benchmarkId: string;
  protected evaluationId: string;
  protected configuration: Record<string, any>;
  protected status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  protected startTime?: Date;
  protected endTime?: Date;
  protected metrics: AgentMetrics;
  protected logs: string[] = [];
  protected isRunning: boolean = false;
  protected timeout: number;
  protected maxRetries: number;
  protected currentRetries: number = 0;

  constructor(config: BaseAgentConfig) {
    super();
    this.agentId = config.agentId;
    this.benchmarkId = config.benchmarkId;
    this.evaluationId = '';
    this.configuration = config.configuration;
    this.status = 'pending';
    this.timeout = config.timeout || 3600000; // 1 hour default
    this.maxRetries = config.maxRetries || 3;

    this.metrics = this.initializeMetrics();
  }

  protected initializeMetrics(): AgentMetrics {
    return {
      performance: {
        taskSuccessRate: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0
      },
      efficiency: {
        executionTime: 0,
        latencyPerStep: 0,
        totalSteps: 0,
        averageTaskTime: 0
      },
      cost: {
        totalTokens: 0,
        estimatedCost: 0,
        tokenCostPerTask: 0
      },
      robustness: {
        toolCallErrorRate: 0,
        recoveryRate: 0,
        errorCount: 0,
        recoveryCount: 0
      },
      quality: {
        toolSelectionAccuracy: 0,
        parameterAccuracy: 0,
        outputQualityScore: 0
      }
    };
  }

  public async execute(): Promise<Evaluation> {
    try {
      logger.info(`Starting execution for agent ${this.agentId} on benchmark ${this.benchmarkId}`);

      // Create evaluation record
      const evaluation = await EvaluationModel.create({
        agentId: this.agentId,
        benchmarkId: this.benchmarkId,
        status: 'pending',
        configuration: this.configuration,
        logs: [],
        metrics: undefined,
        startTime: new Date(),
        endTime: undefined
      });

      this.evaluationId = evaluation.id;
      this.status = 'running';
      this.startTime = new Date();
      this.isRunning = true;

      await EvaluationModel.updateStatusWithTime(this.evaluationId, 'running', this.startTime);

      this.emit('started', { evaluationId: this.evaluationId, agentId: this.agentId });
      this.log(`Execution started for evaluation ${this.evaluationId}`);

      // Setup timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Execution timeout after ${this.timeout}ms`)), this.timeout);
      });

      // Execute with timeout
      await Promise.race([
        this.executeTasks(),
        timeoutPromise
      ]);

      this.endTime = new Date();
      this.status = 'completed';
      this.isRunning = false;

      // Calculate final metrics
      await this.calculateFinalMetrics();

      // Update evaluation with results
      await EvaluationModel.updateStatusWithTime(
        this.evaluationId,
        'completed',
        this.startTime,
        this.endTime
      );
      await EvaluationModel.updateMetrics(this.evaluationId, this.toEvaluationMetrics());
      await EvaluationModel.addLogs(this.evaluationId, this.logs);

      this.emit('completed', {
        evaluationId: this.evaluationId,
        metrics: this.metrics,
        duration: this.endTime.getTime() - this.startTime!.getTime()
      });

      logger.info(`Execution completed for evaluation ${this.evaluationId}`);

      const finalEvaluation = await EvaluationModel.findById(this.evaluationId);
      if (!finalEvaluation) {
        throw new Error('Failed to retrieve completed evaluation');
      }

      return finalEvaluation;

    } catch (error) {
      this.isRunning = false;
      this.status = 'failed';
      this.endTime = new Date();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Execution failed: ${errorMessage}`);

      logger.error(`Execution failed for evaluation ${this.evaluationId}:`, error);

      // Update evaluation with error
      if (this.evaluationId) {
        await EvaluationModel.updateStatusWithTime(
          this.evaluationId,
          'failed',
          this.startTime,
          this.endTime
        );
        await EvaluationModel.addLogs(this.evaluationId, this.logs);
      }

      this.emit('failed', {
        evaluationId: this.evaluationId,
        error: errorMessage,
        logs: this.logs
      });

      throw error;
    }
  }

  protected toEvaluationMetrics(): EvaluationMetrics {
    return {
      taskSuccessRate: this.metrics.performance.taskSuccessRate,
      executionTime: this.metrics.efficiency.executionTime,
      latencyPerStep: this.metrics.efficiency.latencyPerStep,
      totalSteps: this.metrics.efficiency.totalSteps,
      totalTokens: this.metrics.cost.totalTokens,
      estimatedCost: this.metrics.cost.estimatedCost,
      toolCallErrorRate: this.metrics.robustness.toolCallErrorRate,
      recoveryRate: this.metrics.robustness.recoveryRate,
      toolSelectionAccuracy: this.metrics.quality.toolSelectionAccuracy,
      parameterAccuracy: this.metrics.quality.parameterAccuracy
    };
  }

  protected abstract executeTasks(): Promise<void>;

  protected log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    logger.info(logEntry);
    this.emit('log', { message: logEntry, timestamp });
  }

  protected updateProgress(progress: number, message?: string): void {
    this.emit('progress', { progress, message });
    if (message) {
      this.log(message);
    }
  }

  protected async calculateFinalMetrics(): Promise<void> {
    const executionTime = this.endTime!.getTime() - this.startTime!.getTime();
    this.metrics.efficiency.executionTime = executionTime;

    if (this.metrics.performance.totalTasks > 0) {
      this.metrics.performance.taskSuccessRate =
        this.metrics.performance.completedTasks / this.metrics.performance.totalTasks;
      this.metrics.efficiency.averageTaskTime =
        executionTime / this.metrics.performance.totalTasks;
      this.metrics.cost.tokenCostPerTask =
        this.metrics.cost.totalTokens / this.metrics.performance.totalTasks;
    }

    if (this.metrics.robustness.errorCount > 0) {
      this.metrics.robustness.recoveryRate =
        this.metrics.robustness.recoveryCount / this.metrics.robustness.errorCount;
      this.metrics.robustness.toolCallErrorRate =
        this.metrics.robustness.errorCount / (this.metrics.robustness.errorCount + this.metrics.performance.completedTasks);
    }
  }

  protected recordTaskCompletion(success: boolean, tokens: number = 0, cost: number = 0): void {
    this.metrics.performance.totalTasks++;

    if (success) {
      this.metrics.performance.completedTasks++;
    } else {
      this.metrics.performance.failedTasks++;
      this.metrics.robustness.errorCount++;
    }

    this.metrics.cost.totalTokens += tokens;
    this.metrics.cost.estimatedCost += cost;
  }

  protected recordStepExecution(stepTime: number): void {
    this.metrics.efficiency.totalSteps++;
    this.metrics.efficiency.latencyPerStep =
      (this.metrics.efficiency.latencyPerStep * (this.metrics.efficiency.totalSteps - 1) + stepTime) /
      this.metrics.efficiency.totalSteps;
  }

  protected recordErrorRecovery(): void {
    this.metrics.robustness.recoveryCount++;
  }

  public cancel(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.status = 'cancelled';
      this.endTime = new Date();

      this.log('Execution cancelled by user');
      this.emit('cancelled', { evaluationId: this.evaluationId });

      if (this.evaluationId) {
        EvaluationModel.updateStatusWithTime(
          this.evaluationId,
          'cancelled',
          this.startTime,
          this.endTime
        ).catch(error => {
          logger.error('Failed to update cancelled status:', error);
        });
      }
    }
  }

  public getStatus(): string {
    return this.status;
  }

  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  public getConfiguration(): Record<string, any> {
    return { ...this.configuration };
  }

  public getLogs(): string[] {
    return [...this.logs];
  }

  public isExecutionRunning(): boolean {
    return this.isRunning;
  }

  protected async retryExecution(): Promise<void> {
    if (this.currentRetries < this.maxRetries) {
      this.currentRetries++;
      this.log(`Retrying execution (attempt ${this.currentRetries}/${this.maxRetries})`);

      // Reset some state for retry
      this.status = 'running';
      this.isRunning = true;

      await this.executeTasks();
    } else {
      throw new Error(`Maximum retries (${this.maxRetries}) exceeded`);
    }
  }
}