import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { EvaluationError } from '../types/orchestrator';
import { v4 as uuidv4 } from 'uuid';

interface ErrorPattern {
  id: string;
  name: string;
  pattern: RegExp | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'agent' | 'benchmark' | 'environment' | 'network';
  recoverable: boolean;
  suggestedAction: string;
  retryStrategy: 'immediate' | 'delayed' | 'exponential' | 'none';
  maxRetries: number;
}

interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByCategory: Record<string, number>;
  recoveryRate: number;
  averageRetries: number;
  criticalErrors: number;
}

export class ErrorHandler extends EventEmitter {
  private errorPatterns: ErrorPattern[];
  private errorHistory: Map<string, EvaluationError[]>;
  private recoveryStrategies: Map<string, RecoveryStrategy>;
  private stats: ErrorStats;

  constructor() {
    super();
    this.errorPatterns = [];
    this.errorHistory = new Map();
    this.recoveryStrategies = new Map();
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      errorsByCategory: {},
      recoveryRate: 0,
      averageRetries: 0,
      criticalErrors: 0
    };

    this.initializeErrorPatterns();
    this.initializeRecoveryStrategies();
  }

  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      // System errors
      {
        id: 'out_of_memory',
        name: 'Out of Memory',
        pattern: /out of memory|memory allocation|heap|oom/i,
        severity: 'critical',
        category: 'system',
        recoverable: false,
        suggestedAction: 'Increase memory allocation or optimize memory usage',
        retryStrategy: 'none',
        maxRetries: 0
      },
      {
        id: 'disk_space',
        name: 'Disk Space Error',
        pattern: /no space left|disk full|storage/i,
        severity: 'high',
        category: 'system',
        recoverable: true,
        suggestedAction: 'Clean up disk space or increase storage',
        retryStrategy: 'delayed',
        maxRetries: 3
      },
      {
        id: 'permission_denied',
        name: 'Permission Denied',
        pattern: /permission denied|access denied|unauthorized/i,
        severity: 'medium',
        category: 'system',
        recoverable: true,
        suggestedAction: 'Check file permissions and user access rights',
        retryStrategy: 'delayed',
        maxRetries: 2
      },

      // Agent errors
      {
        id: 'agent_timeout',
        name: 'Agent Timeout',
        pattern: /timeout|timed out|deadline exceeded/i,
        severity: 'medium',
        category: 'agent',
        recoverable: true,
        suggestedAction: 'Increase timeout or optimize agent performance',
        retryStrategy: 'exponential',
        maxRetries: 3
      },
      {
        id: 'agent_crash',
        name: 'Agent Crash',
        pattern: /crashed|exception|fatal error|segmentation fault/i,
        severity: 'high',
        category: 'agent',
        recoverable: true,
        suggestedAction: 'Restart agent and investigate crash logs',
        retryStrategy: 'delayed',
        maxRetries: 2
      },
      {
        id: 'api_limit',
        name: 'API Rate Limit',
        pattern: /rate limit|quota exceeded|too many requests/i,
        severity: 'medium',
        category: 'agent',
        recoverable: true,
        suggestedAction: 'Implement rate limiting or retry with backoff',
        retryStrategy: 'exponential',
        maxRetries: 5
      },

      // Benchmark errors
      {
        id: 'benchmark_load',
        name: 'Benchmark Loading Error',
        pattern: /benchmark.*load|failed to load|data not found/i,
        severity: 'high',
        category: 'benchmark',
        recoverable: false,
        suggestedAction: 'Verify benchmark data and configuration',
        retryStrategy: 'none',
        maxRetries: 0
      },
      {
        id: 'task_validation',
        name: 'Task Validation Error',
        pattern: /validation.*error|invalid.*task|malformed/i,
        severity: 'medium',
        category: 'benchmark',
        recoverable: true,
        suggestedAction: 'Check task format and required fields',
        retryStrategy: 'immediate',
        maxRetries: 1
      },

      // Environment errors
      {
        id: 'container_error',
        name: 'Container Error',
        pattern: /docker.*error|container.*failed|image not found/i,
        severity: 'high',
        category: 'environment',
        recoverable: true,
        suggestedAction: 'Check Docker daemon and container configuration',
        retryStrategy: 'delayed',
        maxRetries: 2
      },
      {
        id: 'network_error',
        name: 'Network Error',
        pattern: /network.*error|connection.*failed|dns.*error/i,
        severity: 'medium',
        category: 'network',
        recoverable: true,
        suggestedAction: 'Check network connectivity and firewall settings',
        retryStrategy: 'exponential',
        maxRetries: 4
      },

      // Database errors
      {
        id: 'database_connection',
        name: 'Database Connection Error',
        pattern: /database.*connection|connection.*failed|pool.*exhausted/i,
        severity: 'high',
        category: 'system',
        recoverable: true,
        suggestedAction: 'Check database server and connection pool',
        retryStrategy: 'exponential',
        maxRetries: 3
      }
    ];
  }

  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.set('immediate', new ImmediateRetryStrategy());
    this.recoveryStrategies.set('delayed', new DelayedRetryStrategy());
    this.recoveryStrategies.set('exponential', new ExponentialBackoffStrategy());
    this.recoveryStrategies.set('none', new NoRetryStrategy());
  }

  async handleError(error: Error, context: {
    evaluationId: string;
    component: string;
    operation: string;
    additionalInfo?: Record<string, any>;
  }): Promise<EvaluationError> {
    const { evaluationId, component, operation, additionalInfo } = context;

    // Identify error pattern
    const pattern = this.identifyErrorPattern(error);

    // Create evaluation error
    const evaluationError: EvaluationError = {
      id: uuidv4(),
      timestamp: new Date(),
      type: pattern?.category || 'system',
      severity: pattern?.severity || 'medium',
      message: error.message,
      stack: error.stack,
      recoverable: pattern?.recoverable || false,
      retryCount: 0,
      maxRetries: pattern?.maxRetries || 0,
      metadata: {
        component,
        operation,
        pattern: pattern?.id,
        suggestedAction: pattern?.suggestedAction,
        ...additionalInfo
      }
    };

    // Store error in history
    this.storeError(evaluationId, evaluationError);

    // Update statistics
    this.updateStats(evaluationError);

    // Log error
    this.logError(evaluationError, pattern);

    // Emit error event
    this.emit('error', evaluationError, evaluationId);

    // Attempt recovery if recoverable
    if (evaluationError.recoverable && pattern) {
      await this.attemptRecovery(evaluationError, pattern);
    }

    return evaluationError;
  }

  private identifyErrorPattern(error: Error): ErrorPattern | undefined {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    for (const pattern of this.errorPatterns) {
      if (pattern.pattern instanceof RegExp) {
        if (pattern.pattern.test(message) || pattern.pattern.test(stack)) {
          return pattern;
        }
      } else if (typeof pattern.pattern === 'string') {
        if (message.includes(pattern.pattern.toLowerCase()) ||
            stack.includes(pattern.pattern.toLowerCase())) {
          return pattern;
        }
      }
    }

    return undefined;
  }

  private storeError(evaluationId: string, error: EvaluationError): void {
    if (!this.errorHistory.has(evaluationId)) {
      this.errorHistory.set(evaluationId, []);
    }

    const errors = this.errorHistory.get(evaluationId)!;
    errors.push(error);

    // Keep only last 100 errors per evaluation
    if (errors.length > 100) {
      errors.splice(0, errors.length - 100);
    }
  }

  private updateStats(error: EvaluationError): void {
    this.stats.totalErrors++;

    // Update by type
    const errorType = error.metadata?.pattern || 'unknown';
    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;

    // Update by severity
    this.stats.errorsBySeverity[error.severity] = (this.stats.errorsBySeverity[error.severity] || 0) + 1;

    // Update by category
    this.stats.errorsByCategory[error.type] = (this.stats.errorsByCategory[error.type] || 0) + 1;

    // Update critical errors
    if (error.severity === 'critical') {
      this.stats.criticalErrors++;
    }

    // Calculate recovery rate and average retries
    this.calculateDerivedStats();
  }

  private calculateDerivedStats(): void {
    let totalRetries = 0;
    let recoverableErrors = 0;
    let recoveredErrors = 0;

    for (const errors of this.errorHistory.values()) {
      for (const error of errors) {
        totalRetries += error.retryCount;
        if (error.recoverable) {
          recoverableErrors++;
          // Consider recovered if retry count < max retries and error is not recent
          if (error.retryCount < error.maxRetries) {
            recoveredErrors++;
          }
        }
      }
    }

    this.stats.averageRetries = this.stats.totalErrors > 0 ? totalRetries / this.stats.totalErrors : 0;
    this.stats.recoveryRate = recoverableErrors > 0 ? (recoveredErrors / recoverableErrors) * 100 : 0;
  }

  private logError(error: EvaluationError, pattern?: ErrorPattern): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `${error.type.toUpperCase()} [${error.severity.toUpperCase()}] ${error.message}`;

    const logData = {
      errorId: error.id,
      evaluationId: this.getEvaluationIdForError(error),
      component: error.metadata?.component,
      operation: error.metadata?.operation,
      pattern: pattern?.id,
      recoverable: error.recoverable,
      retryCount: error.retryCount,
      maxRetries: error.maxRetries,
      suggestedAction: error.metadata?.suggestedAction
    };

    switch (logLevel) {
      case 'error':
        logger.error(message, logData);
        break;
      case 'warn':
        logger.warn(message, logData);
        break;
      case 'info':
        logger.info(message, logData);
        break;
      default:
        logger.debug(message, logData);
    }
  }

  private getEvaluationIdForError(error: EvaluationError): string {
    for (const [evaluationId, errors] of this.errorHistory.entries()) {
      if (errors.includes(error)) {
        return evaluationId;
      }
    }
    return 'unknown';
  }

  private getLogLevel(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'debug';
    }
  }

  private async attemptRecovery(error: EvaluationError, pattern: ErrorPattern): Promise<void> {
    const strategy = this.recoveryStrategies.get(pattern.retryStrategy);
    if (!strategy) {
      logger.warn(`No recovery strategy found for ${pattern.retryStrategy}`);
      return;
    }

    try {
      await strategy.execute(error, pattern);
      logger.info(`Recovery attempt executed for error ${error.id}`);
      this.emit('recoveryAttempted', error, pattern);
    } catch (recoveryError) {
      logger.error(`Recovery failed for error ${error.id}:`, recoveryError);
      this.emit('recoveryFailed', error, pattern, recoveryError);
    }
  }

  getErrorHistory(evaluationId: string): EvaluationError[] {
    return this.errorHistory.get(evaluationId) || [];
  }

  getStats(): ErrorStats {
    return { ...this.stats };
  }

  getErrorsByTimeRange(startTime: Date, endTime: Date): EvaluationError[] {
    const errors: EvaluationError[] = [];

    for (const evaluationErrors of this.errorHistory.values()) {
      for (const error of evaluationErrors) {
        if (error.timestamp >= startTime && error.timestamp <= endTime) {
          errors.push(error);
        }
      }
    }

    return errors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getErrorPatternStats(): Array<{ pattern: ErrorPattern; count: number; recoveryRate: number }> {
    const patternStats = new Map<string, { count: number; recovered: number }>();

    for (const evaluationErrors of this.errorHistory.values()) {
      for (const error of evaluationErrors) {
        const patternId = error.metadata?.pattern || 'unknown';
        if (!patternStats.has(patternId)) {
          patternStats.set(patternId, { count: 0, recovered: 0 });
        }

        const stats = patternStats.get(patternId)!;
        stats.count++;

        if (error.recoverable && error.retryCount < error.maxRetries) {
          stats.recovered++;
        }
      }
    }

    return Array.from(patternStats.entries()).map(([patternId, stats]) => {
      const pattern = this.errorPatterns.find(p => p.id === patternId);
      return {
        pattern: pattern || {
          id: patternId,
          name: patternId,
          pattern: '',
          severity: 'medium' as any,
          category: 'system' as any,
          recoverable: false,
          suggestedAction: '',
          retryStrategy: 'none' as any,
          maxRetries: 0
        },
        count: stats.count,
        recoveryRate: stats.count > 0 ? (stats.recovered / stats.count) * 100 : 0
      };
    });
  }

  addCustomPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
    logger.info(`Added custom error pattern: ${pattern.name}`);
  }

  removePattern(patternId: string): boolean {
    const index = this.errorPatterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      this.errorPatterns.splice(index, 1);
      logger.info(`Removed error pattern: ${patternId}`);
      return true;
    }
    return false;
  }

  clearErrorHistory(evaluationId?: string): void {
    if (evaluationId) {
      this.errorHistory.delete(evaluationId);
      logger.info(`Cleared error history for evaluation: ${evaluationId}`);
    } else {
      this.errorHistory.clear();
      this.stats = {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        errorsByCategory: {},
        recoveryRate: 0,
        averageRetries: 0,
        criticalErrors: 0
      };
      logger.info('Cleared all error history');
    }
  }

  exportErrorReport(evaluationId?: string): string {
    const errors = evaluationId
      ? this.getErrorHistory(evaluationId)
      : this.getErrorsByTimeRange(
          new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          new Date()
        );

    const report = {
      generatedAt: new Date().toISOString(),
      evaluationId: evaluationId || 'all',
      totalErrors: errors.length,
      errorSummary: this.getErrorSummary(errors),
      errors: errors.map(error => ({
        id: error.id,
        timestamp: error.timestamp.toISOString(),
        type: error.type,
        severity: error.severity,
        message: error.message,
        recoverable: error.recoverable,
        retryCount: error.retryCount,
        maxRetries: error.maxRetries,
        component: error.metadata?.component,
        operation: error.metadata?.operation,
        pattern: error.metadata?.pattern,
        suggestedAction: error.metadata?.suggestedAction
      })),
      stats: this.stats
    };

    return JSON.stringify(report, null, 2);
  }

  private getErrorSummary(errors: EvaluationError[]): any {
    const summary = {
      bySeverity: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byComponent: {} as Record<string, number>,
      byPattern: {} as Record<string, number>
    };

    for (const error of errors) {
      summary.bySeverity[error.severity] = (summary.bySeverity[error.severity] || 0) + 1;
      summary.byCategory[error.type] = (summary.byCategory[error.type] || 0) + 1;

      const component = error.metadata?.component || 'unknown';
      summary.byComponent[component] = (summary.byComponent[component] || 0) + 1;

      const pattern = error.metadata?.pattern || 'unknown';
      summary.byPattern[pattern] = (summary.byPattern[pattern] || 0) + 1;
    }

    return summary;
  }

  reset(): void {
    this.errorHistory.clear();
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      errorsByCategory: {},
      recoveryRate: 0,
      averageRetries: 0,
      criticalErrors: 0
    };
    logger.info('ErrorHandler reset');
  }
}

// Recovery Strategy Interfaces
interface RecoveryStrategy {
  execute(error: EvaluationError, pattern: ErrorPattern): Promise<void>;
}

class ImmediateRetryStrategy implements RecoveryStrategy {
  async execute(error: EvaluationError, pattern: ErrorPattern): Promise<void> {
    error.retryCount++;
    // Immediate retry logic would be implemented by the caller
  }
}

class DelayedRetryStrategy implements RecoveryStrategy {
  async execute(error: EvaluationError, pattern: ErrorPattern): Promise<void> {
    error.retryCount++;
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
  }
}

class ExponentialBackoffStrategy implements RecoveryStrategy {
  async execute(error: EvaluationError, pattern: ErrorPattern): Promise<void> {
    error.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, error.retryCount), 60000); // Max 1 minute
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

class NoRetryStrategy implements RecoveryStrategy {
  async execute(error: EvaluationError, pattern: ErrorPattern): Promise<void> {
    // No retry - just log and continue
  }
}