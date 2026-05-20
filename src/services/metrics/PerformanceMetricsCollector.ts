/**
 * Performance Metrics Collector
 * Tracks task success rates, completion validation, and result accuracy
 */

import { BaseMetricCollector } from './BaseMetricCollector';
import { BaseMetrics, PerformanceMetrics, MetricsCollectionContext, MetricValidationError } from '../../types/metrics';
import { logger } from '../../utils/logger';
import { EvaluationModel } from '../../database/models/Evaluation';

interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  success: boolean;
  validationPassed: boolean;
  accuracy?: number;
  error?: string;
}

interface PerformanceState {
  tasks: Map<string, TaskResult>;
  totalTasks: number;
  completedTasks: number;
  successfulTasks: number;
  validationResults: {
    passed: number;
    failed: number;
    skipped: number;
  };
  accuracySum: number;
  accuracyCount: number;
}

export class PerformanceMetricsCollector extends BaseMetricCollector {
  private state: PerformanceState;

  constructor(context: MetricsCollectionContext, config?: any) {
    super(context, config);
    this.state = {
      tasks: new Map(),
      totalTasks: 0,
      completedTasks: 0,
      successfulTasks: 0,
      validationResults: {
        passed: 0,
        failed: 0,
        skipped: 0,
      },
      accuracySum: 0,
      accuracyCount: 0,
    };
  }

  protected async initialize(): Promise<void> {
    logger.debug('Initializing PerformanceMetricsCollector');

    // Load existing evaluation data if available
    try {
      const evaluation = await EvaluationModel.findById(this.context.evaluationId);
      if (evaluation && evaluation.metrics) {
        // Initialize state from existing (flat) metrics. The persisted
        // EvaluationMetrics shape only carries an aggregate success rate, so
        // task counts are seeded from any existing totals tracked in state.
        const successRate = evaluation.metrics.taskSuccessRate;
        if (typeof successRate === 'number') {
          this.state.successfulTasks =
            Math.floor(successRate * this.state.totalTasks) || 0;
        }
      }
    } catch (error) {
      logger.warn('Failed to load existing evaluation data:', error);
    }

    // Note: Event listeners are handled by external orchestrator
    // These methods are available for external event handling if needed
  }

  protected async gatherMetrics(eventData?: any): Promise<Partial<PerformanceMetrics> | null> {
    const now = new Date();

    // Calculate current metrics
    const taskSuccessRate = this.state.totalTasks > 0
      ? this.state.successfulTasks / this.state.totalTasks
      : 0;

    const passRate = this.state.totalTasks > 0
      ? this.state.validationResults.passed / this.state.totalTasks
      : 0;

    const failRate = this.state.totalTasks > 0
      ? this.state.validationResults.failed / this.state.totalTasks
      : 0;

    const resultAccuracy = this.state.accuracyCount > 0
      ? this.state.accuracySum / this.state.accuracyCount
      : 0;

    const benchmarkCompletionRate = this.state.totalTasks > 0
      ? this.state.completedTasks / this.state.totalTasks
      : 0;

    return {
      timestamp: now,
      evaluationId: this.context.evaluationId,
      agentId: this.context.agentId,
      benchmarkId: this.context.benchmarkId,
      sessionId: this.context.sessionId,
      taskSuccessRate,
      tasksCompleted: this.state.completedTasks,
      tasksTotal: this.state.totalTasks,
      passRate,
      failRate,
      completionValidation: { ...this.state.validationResults },
      resultAccuracy,
      benchmarkCompletionRate,
    };
  }

  protected validateMetrics(metrics: Partial<BaseMetrics>): MetricValidationError[] {
    const errors: MetricValidationError[] = [];
    const perfMetrics = metrics as PerformanceMetrics;

    if (perfMetrics.taskSuccessRate !== undefined) {
      if (perfMetrics.taskSuccessRate < 0 || perfMetrics.taskSuccessRate > 1) {
        errors.push({
          field: 'taskSuccessRate',
          value: perfMetrics.taskSuccessRate,
          expected: '0-1 decimal',
          actual: String(perfMetrics.taskSuccessRate),
          severity: 'error',
        });
      }
    }

    if (perfMetrics.tasksCompleted !== undefined && perfMetrics.tasksTotal !== undefined) {
      if (perfMetrics.tasksCompleted > perfMetrics.tasksTotal) {
        errors.push({
          field: 'tasksCompleted',
          value: perfMetrics.tasksCompleted,
          expected: '<= tasksTotal',
          actual: String(perfMetrics.tasksCompleted),
          severity: 'error',
        });
      }
    }

    if (perfMetrics.resultAccuracy !== undefined) {
      if (perfMetrics.resultAccuracy < 0 || perfMetrics.resultAccuracy > 1) {
        errors.push({
          field: 'resultAccuracy',
          value: perfMetrics.resultAccuracy,
          expected: '0-1 decimal',
          actual: String(perfMetrics.resultAccuracy),
          severity: 'error',
        });
      }
    }

    return errors;
  }

  protected async persistMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await EvaluationModel.updateMetrics(this.context.evaluationId, {
          performance: metrics as PerformanceMetrics,
        } as any);
      }, 'persist_performance_metrics');

      logger.debug('Performance metrics persisted successfully');
    } catch (error) {
      logger.error('Failed to persist performance metrics:', error);
      throw error;
    }
  }

  /**
   * Record the start of a new task
   */
  public recordTaskStart(taskId: string, totalTasks?: number): void {
    const task: TaskResult = {
      taskId,
      status: 'completed', // Default, will be updated
      startTime: new Date(),
      success: false,
      validationPassed: false,
    };

    this.state.tasks.set(taskId, task);

    if (totalTasks && totalTasks > this.state.totalTasks) {
      this.state.totalTasks = totalTasks;
    }

    logger.debug(`Task started: ${taskId}`, { totalTasks: this.state.totalTasks });
    this.emit('task_started', { taskId, totalTasks });
  }

  /**
   * Record task completion
   */
  public recordTaskCompletion(taskId: string, success: boolean, accuracy?: number): void {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found for completion: ${taskId}`);
      return;
    }

    task.status = 'completed';
    task.endTime = new Date();
    task.success = success;
    task.accuracy = accuracy;

    this.state.completedTasks++;

    if (success) {
      this.state.successfulTasks++;
    }

    if (accuracy !== undefined) {
      this.state.accuracySum += accuracy;
      this.state.accuracyCount++;
    }

    logger.debug(`Task completed: ${taskId}`, { success, accuracy });
    this.emit('task_completed', { taskId, success, accuracy });
  }

  /**
   * Record task failure
   */
  public recordTaskFailure(taskId: string, error?: string): void {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found for failure: ${taskId}`);
      return;
    }

    task.status = 'failed';
    task.endTime = new Date();
    task.success = false;
    task.error = error;

    this.state.completedTasks++;
    this.state.validationResults.failed++;

    logger.debug(`Task failed: ${taskId}`, { error });
    this.emit('task_failed', { taskId, error });
  }

  /**
   * Record task skip
   */
  public recordTaskSkip(taskId: string, reason?: string): void {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found for skip: ${taskId}`);
      return;
    }

    task.status = 'skipped';
    task.endTime = new Date();
    task.success = false;

    this.state.validationResults.skipped++;

    logger.debug(`Task skipped: ${taskId}`, { reason });
    this.emit('task_skipped', { taskId, reason });
  }

  /**
   * Record validation result
   */
  public recordValidationResult(taskId: string, passed: boolean, details?: any): void {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found for validation: ${taskId}`);
      return;
    }

    task.validationPassed = passed;

    if (passed) {
      this.state.validationResults.passed++;
    } else {
      this.state.validationResults.failed++;
    }

    logger.debug(`Validation completed: ${taskId}`, { passed, details });
    this.emit('validation_completed', { taskId, passed, details });
  }

  /**
   * Get current performance summary
   */
  public getPerformanceSummary(): {
    successRate: number;
    completionRate: number;
    validationPassRate: number;
    averageAccuracy: number;
    totalTasks: number;
    completedTasks: number;
  } {
    const successRate = this.state.totalTasks > 0
      ? this.state.successfulTasks / this.state.totalTasks
      : 0;

    const completionRate = this.state.totalTasks > 0
      ? this.state.completedTasks / this.state.totalTasks
      : 0;

    const validationPassRate = this.state.totalTasks > 0
      ? this.state.validationResults.passed / this.state.totalTasks
      : 0;

    const averageAccuracy = this.state.accuracyCount > 0
      ? this.state.accuracySum / this.state.accuracyCount
      : 0;

    return {
      successRate,
      completionRate,
      validationPassRate,
      averageAccuracy,
      totalTasks: this.state.totalTasks,
      completedTasks: this.state.completedTasks,
    };
  }

  // Event handlers
  private handleTaskStarted(data: { taskId: string; totalTasks?: number }): void {
    this.recordTaskStart(data.taskId, data.totalTasks);
  }

  private handleTaskCompleted(data: { taskId: string; success: boolean; accuracy?: number }): void {
    this.recordTaskCompletion(data.taskId, data.success, data.accuracy);
  }

  private handleTaskFailed(data: { taskId: string; error?: string }): void {
    this.recordTaskFailure(data.taskId, data.error);
  }

  private handleTaskSkipped(data: { taskId: string; reason?: string }): void {
    this.recordTaskSkip(data.taskId, data.reason);
  }

  private handleValidationCompleted(data: { taskId: string; passed: boolean; details?: any }): void {
    this.recordValidationResult(data.taskId, data.passed, data.details);
  }
}