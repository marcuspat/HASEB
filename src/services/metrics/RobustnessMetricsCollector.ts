/**
 * Robustness Metrics Collector
 * Tracks error rates, recovery patterns, and system resilience
 */

import { BaseMetricCollector } from './BaseMetricCollector';
import { BaseMetrics, RobustnessMetrics, MetricsCollectionContext, MetricValidationError } from '../../types/metrics';
import { logger } from '../../utils/logger';
import { EvaluationModel } from '../../database/models/Evaluation';

interface ErrorEvent {
  id: string;
  timestamp: Date;
  type: 'fatal' | 'recoverable' | 'transient';
  category: 'timeout' | 'resource_exhaustion' | 'api_failure' | 'logic_error' | 'unexpected_input' | 'network' | 'unknown';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
  recoveryTime?: number; // milliseconds
  recoveryAttempts: number;
}

interface RecoveryAttempt {
  errorId: string;
  attemptNumber: number;
  timestamp: Date;
  strategy: string;
  successful: boolean;
  duration: number; // milliseconds
}

interface DowntimePeriod {
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  cause: string;
  impact: 'partial' | 'full';
}

interface RobustnessState {
  errors: Map<string, ErrorEvent>;
  recoveryAttempts: Map<string, RecoveryAttempt[]>;
  downtimePeriods: DowntimePeriod[];
  totalErrors: number;
  fatalErrors: number;
  recoverableErrors: number;
  transientErrors: number;
  successfulRecoveries: number;
  totalRecoveryAttempts: number;
  totalRecoveryTime: number;
  lastFailureTime?: Date;
  lastRecoveryTime?: Date;
  uptimeStart: Date;
  totalDowntime: number;
}

export class RobustnessMetricsCollector extends BaseMetricCollector {
  private state: RobustnessState;

  constructor(context: MetricsCollectionContext, config?: any) {
    super(context, config);
    this.state = {
      errors: new Map(),
      recoveryAttempts: new Map(),
      downtimePeriods: [],
      totalErrors: 0,
      fatalErrors: 0,
      recoverableErrors: 0,
      transientErrors: 0,
      successfulRecoveries: 0,
      totalRecoveryAttempts: 0,
      totalRecoveryTime: 0,
      uptimeStart: new Date(),
      totalDowntime: 0,
    };
  }

  protected async initialize(): Promise<void> {
    logger.debug('Initializing RobustnessMetricsCollector');

    // Set up event listeners for error and recovery events
    this.on('error_occurred', this.handleErrorOccurred.bind(this));
    this.on('recovery_attempted', this.handleRecoveryAttempted.bind(this));
    this.on('recovery_completed', this.handleRecoveryCompleted.bind(this));
    this.on('downtime_started', this.handleDowntimeStarted.bind(this));
    this.on('downtime_ended', this.handleDowntimeEnded.bind(this));
  }

  protected async gatherMetrics(eventData?: any): Promise<Partial<RobustnessMetrics> | null> {
    const currentTime = new Date();

    // Calculate error rates
    const toolCallErrorRate = this.state.totalErrors > 0
      ? this.state.totalErrors / Math.max(1, this.state.totalErrors + this.successfulRecoveries)
      : 0;

    const recoveryRate = this.state.totalRecoveryAttempts > 0
      ? this.successfulRecoveries / this.state.totalRecoveryAttempts
      : 0;

    // Categorize errors
    const errorCounts = {
      total: this.state.totalErrors,
      fatal: this.state.fatalErrors,
      recoverable: this.state.recoverableErrors,
      transient: this.state.transientErrors,
    };

    // Analyze error patterns
    const errorPatterns = this.analyzeErrorPatterns();

    // Analyze failure modes
    const failureModes = this.analyzeFailureModes();

    // Calculate resilience metrics
    const resilience = this.calculateResilience(currentTime);

    return {
      timestamp: currentTime,
      evaluationId: this.context.evaluationId,
      agentId: this.context.agentId,
      benchmarkId: this.context.benchmarkId,
      sessionId: this.context.sessionId,
      toolCallErrorRate: Math.round(toolCallErrorRate * 10000) / 10000,
      recoveryRate: Math.round(recoveryRate * 10000) / 10000,
      errorCounts,
      errorPatterns,
      failureModes,
      resilience,
    };
  }

  protected validateMetrics(metrics: Partial<BaseMetrics>): MetricValidationError[] {
    const errors: MetricValidationError[] = [];
    const robustMetrics = metrics as RobustnessMetrics;

    if (robustMetrics.toolCallErrorRate !== undefined &&
        (robustMetrics.toolCallErrorRate < 0 || robustMetrics.toolCallErrorRate > 1)) {
      errors.push({
        field: 'toolCallErrorRate',
        value: robustMetrics.toolCallErrorRate,
        expected: '0-1 decimal',
        actual: String(robustMetrics.toolCallErrorRate),
        severity: 'error',
      });
    }

    if (robustMetrics.recoveryRate !== undefined &&
        (robustMetrics.recoveryRate < 0 || robustMetrics.recoveryRate > 1)) {
      errors.push({
        field: 'recoveryRate',
        value: robustMetrics.recoveryRate,
        expected: '0-1 decimal',
        actual: String(robustMetrics.recoveryRate),
        severity: 'error',
      });
    }

    return errors;
  }

  protected async persistMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await EvaluationModel.updateMetrics(this.context.evaluationId, {
          robustness: metrics as RobustnessMetrics,
        } as any);
      }, 'persist_robustness_metrics');

      logger.debug('Robustness metrics persisted successfully');
    } catch (error) {
      logger.error('Failed to persist robustness metrics:', error);
      throw error;
    }
  }

  /**
   * Record an error occurrence
   */
  public recordError(
    type: 'fatal' | 'recoverable' | 'transient',
    category: 'timeout' | 'resource_exhaustion' | 'api_failure' | 'logic_error' | 'unexpected_input' | 'network' | 'unknown',
    message: string,
    context?: Record<string, any>
  ): string {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const errorEvent: ErrorEvent = {
      id: errorId,
      timestamp: new Date(),
      type,
      category,
      message,
      context,
      recoveryAttempted: false,
      recoverySuccessful: false,
      recoveryAttempts: 0,
    };

    this.state.errors.set(errorId, errorEvent);
    this.state.totalErrors++;
    this.state.lastFailureTime = errorEvent.timestamp;

    // Update error type counters
    switch (type) {
      case 'fatal':
        this.state.fatalErrors++;
        break;
      case 'recoverable':
        this.state.recoverableErrors++;
        break;
      case 'transient':
        this.state.transientErrors++;
        break;
    }

    logger.debug(`Error recorded: ${errorId}`, { type, category, message });
    this.emit('error_occurred', { errorId, type, category, message, context });

    return errorId;
  }

  /**
   * Record a recovery attempt
   */
  public recordRecoveryAttempt(
    errorId: string,
    strategy: string,
    successful: boolean,
    duration: number
  ): void {
    const error = this.state.errors.get(errorId);
    if (!error) {
      logger.warn(`Error not found for recovery attempt: ${errorId}`);
      return;
    }

    const attemptNumber = error.recoveryAttempts + 1;
    const recoveryAttempt: RecoveryAttempt = {
      errorId,
      attemptNumber,
      timestamp: new Date(),
      strategy,
      successful,
      duration,
    };

    if (!this.state.recoveryAttempts.has(errorId)) {
      this.state.recoveryAttempts.set(errorId, []);
    }
    this.state.recoveryAttempts.get(errorId)!.push(recoveryAttempt);

    // Update error state
    error.recoveryAttempted = true;
    error.recoveryAttempts = attemptNumber;
    error.recoveryTime = duration;

    this.state.totalRecoveryAttempts++;

    if (successful) {
      error.recoverySuccessful = true;
      this.successfulRecoveries++;
      this.state.totalRecoveryTime += duration;
      this.state.lastRecoveryTime = recoveryAttempt.timestamp;
    }

    logger.debug(`Recovery attempt recorded: ${errorId}`, {
      strategy,
      successful,
      duration,
      attemptNumber,
    });

    this.emit('recovery_attempted', { errorId, strategy, successful, duration });

    if (successful) {
      this.emit('recovery_completed', { errorId, strategy, duration });
    }
  }

  /**
   * Record downtime period
   */
  public recordDowntimeStart(cause: string, impact: 'partial' | 'full' = 'full'): void {
    const downtimePeriod: DowntimePeriod = {
      startTime: new Date(),
      cause,
      impact,
    };

    this.state.downtimePeriods.push(downtimePeriod);

    logger.debug(`Downtime started: ${cause}`, { impact });
    this.emit('downtime_started', { cause, impact });
  }

  /**
   * Record downtime end
   */
  public recordDowntimeEnd(): void {
    const currentDowntime = this.state.downtimePeriods.find(d => !d.endTime);
    if (!currentDowntime) {
      logger.warn('No active downtime period found');
      return;
    }

    currentDowntime.endTime = new Date();
    currentDowntime.duration = currentDowntime.endTime.getTime() - currentDowntime.startTime.getTime();
    this.state.totalDowntime += currentDowntime.duration;

    logger.debug(`Downtime ended`, { duration: currentDowntime.duration });
    this.emit('downtime_ended', { duration: currentDowntime.duration });
  }

  /**
   * Analyze error patterns
   */
  private analyzeErrorPatterns(): RobustnessMetrics['errorPatterns'] {
    const patterns: RobustnessMetrics['errorPatterns'] = {};

    // Group errors by type and category
    const errorsByCategory = new Map<string, ErrorEvent[]>();
    for (const error of this.state.errors.values()) {
      const key = `${error.type}_${error.category}`;
      if (!errorsByCategory.has(key)) {
        errorsByCategory.set(key, []);
      }
      errorsByCategory.get(key)!.push(error);
    }

    // Calculate pattern metrics
    for (const [key, errors] of errorsByCategory.entries()) {
      const [type, category] = key.split('_');
      const recoveryAttempts = errors.flatMap(e =>
        this.state.recoveryAttempts.get(e.id) || []
      );

      const successfulRecoveries = recoveryAttempts.filter(a => a.successful);
      const averageRecoveryTime = successfulRecoveries.length > 0
        ? successfulRecoveries.reduce((sum, a) => sum + a.duration, 0) / successfulRecoveries.length
        : 0;

      const successRate = recoveryAttempts.length > 0
        ? successfulRecoveries.length / recoveryAttempts.length
        : 0;

      patterns[`${type}_${category}`] = {
        count: errors.length,
        recoveryTime: Math.round(averageRecoveryTime),
        recoveryAttempts: recoveryAttempts.length,
        successRate: Math.round(successRate * 10000) / 10000,
      };
    }

    return patterns;
  }

  /**
   * Analyze failure modes
   */
  private analyzeFailureModes(): RobustnessMetrics['failureModes'] {
    const failureModes = {
      timeout: 0,
      resourceExhaustion: 0,
      apiFailure: 0,
      logicError: 0,
      unexpectedInput: 0,
    };

    for (const error of this.state.errors.values()) {
      switch (error.category) {
        case 'timeout':
          failureModes.timeout++;
          break;
        case 'resource_exhaustion':
          failureModes.resourceExhaustion++;
          break;
        case 'api_failure':
          failureModes.apiFailure++;
          break;
        case 'logic_error':
          failureModes.logicError++;
          break;
        case 'unexpected_input':
          failureModes.unexpectedInput++;
          break;
      }
    }

    return failureModes;
  }

  /**
   * Calculate resilience metrics
   */
  private calculateResilience(currentTime: Date): RobustnessMetrics['resilience'] {
    const averageRecoveryTime = this.successfulRecoveries > 0
      ? this.state.totalRecoveryTime / this.successfulRecoveries
      : 0;

    const maxDowntime = this.state.downtimePeriods.length > 0
      ? Math.max(...this.state.downtimePeriods.map(d => d.duration || 0))
      : 0;

    const totalTime = currentTime.getTime() - this.state.uptimeStart.getTime();
    const availability = totalTime > 0
      ? Math.max(0, (totalTime - this.state.totalDowntime) / totalTime)
      : 1;

    // Calculate mean time between failures (MTBF)
    const failureTimes = Array.from(this.state.errors.values()).map(e => e.timestamp.getTime());
    let meanTimeBetweenFailures = 0;

    if (failureTimes.length > 1) {
      failureTimes.sort((a, b) => a - b);
      const intervals = failureTimes.slice(1).map((time, i) => time - failureTimes[i]);
      meanTimeBetweenFailures = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    } else if (failureTimes.length === 1) {
      meanTimeBetweenFailures = failureTimes[0] - this.state.uptimeStart.getTime();
    }

    return {
      averageRecoveryTime: Math.round(averageRecoveryTime),
      maxDowntime: Math.round(maxDowntime),
      availability: Math.round(availability * 10000) / 10000,
      meanTimeBetweenFailures: Math.round(meanTimeBetweenFailures),
    };
  }

  /**
   * Get current robustness summary
   */
  public getRobustnessSummary(): {
    errorRate: number;
    recoveryRate: number;
    availability: number;
    averageRecoveryTime: number;
    totalErrors: number;
    successfulRecoveries: number;
  } {
    const currentTime = new Date();
    const totalTime = currentTime.getTime() - this.state.uptimeStart.getTime();
    const availability = totalTime > 0
      ? Math.max(0, (totalTime - this.state.totalDowntime) / totalTime)
      : 1;

    const errorRate = this.state.totalErrors > 0
      ? this.state.totalErrors / Math.max(1, this.state.totalErrors + this.successfulRecoveries)
      : 0;

    const recoveryRate = this.state.totalRecoveryAttempts > 0
      ? this.successfulRecoveries / this.state.totalRecoveryAttempts
      : 0;

    const averageRecoveryTime = this.successfulRecoveries > 0
      ? this.state.totalRecoveryTime / this.successfulRecoveries
      : 0;

    return {
      errorRate: Math.round(errorRate * 10000) / 10000,
      recoveryRate: Math.round(recoveryRate * 10000) / 10000,
      availability: Math.round(availability * 10000) / 10000,
      averageRecoveryTime: Math.round(averageRecoveryTime),
      totalErrors: this.state.totalErrors,
      successfulRecoveries: this.successfulRecoveries,
    };
  }

  // Event handlers
  private handleErrorOccurred(data: {
    errorId: string;
    type: 'fatal' | 'recoverable' | 'transient';
    category: string;
    message: string;
    context?: Record<string, any>;
  }): void {
    // Error already recorded in recordError method
  }

  private handleRecoveryAttempted(data: {
    errorId: string;
    strategy: string;
    successful: boolean;
    duration: number;
  }): void {
    // Recovery already recorded in recordRecoveryAttempt method
  }

  private handleRecoveryCompleted(data: {
    errorId: string;
    strategy: string;
    duration: number;
  }): void {
    // Recovery already marked as successful in recordRecoveryAttempt method
  }

  private handleDowntimeStarted(data: { cause: string; impact: 'partial' | 'full' }): void {
    // Downtime already recorded in recordDowntimeStart method
  }

  private handleDowntimeEnded(data: { duration: number }): void {
    // Downtime already recorded in recordDowntimeEnd method
  }
}