/**
 * Base class for all metric collectors in HASEB
 * Provides common functionality and interface for metric collection
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { BaseMetrics, MetricsCollectionContext, MetricCollectorConfig, MetricValidationError } from '../../types/metrics';

export abstract class BaseMetricCollector extends EventEmitter {
  protected context: MetricsCollectionContext;
  protected config: MetricCollectorConfig;
  protected isActive: boolean = false;
  protected collectionInterval?: NodeJS.Timeout;
  protected metricsBuffer: Map<string, Partial<BaseMetrics>> = new Map();
  protected lastCollectionTime?: Date;

  constructor(context: MetricsCollectionContext, config: Partial<MetricCollectorConfig> = {}) {
    super();
    this.context = context;
    this.config = {
      collectionInterval: 1000, // 1 second default
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 1000,
      enableRealTime: true,
      storage: {
        persistImmediately: false,
        compressionEnabled: true,
        retentionDays: 90,
      },
      validation: {
        strictMode: true,
        outlierDetection: true,
        qualityThreshold: 0.8,
      },
      ...config,
    };
  }

  /**
   * Start collecting metrics
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      logger.warn(`${this.constructor.name} is already active`);
      return;
    }

    try {
      await this.initialize();
      this.isActive = true;
      this.lastCollectionTime = new Date();

      if (this.config.enableRealTime) {
        this.startRealTimeCollection();
      }

      logger.info(`${this.constructor.name} started for evaluation ${this.context.evaluationId}`);
      this.emit('started', { collector: this.constructor.name, context: this.context });
    } catch (error) {
      logger.error(`Failed to start ${this.constructor.name}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Check if collector is currently active
   */
  public isCollectorActive(): boolean {
    return this.isActive;
  }

  /**
   * Stop collecting metrics
   */
  public async stop(): Promise<void> {
    if (!this.isActive) {
      logger.warn(`${this.constructor.name} is not active`);
      return;
    }

    try {
      this.isActive = false;

      if (this.collectionInterval) {
        clearInterval(this.collectionInterval);
        this.collectionInterval = undefined;
      }

      // Flush any remaining metrics
      await this.flushMetrics();

      logger.info(`${this.constructor.name} stopped for evaluation ${this.context.evaluationId}`);
      this.emit('stopped', { collector: this.constructor.name, context: this.context });
    } catch (error) {
      logger.error(`Failed to stop ${this.constructor.name}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Collect metrics for a specific step or event
   */
  public async collectMetrics(eventData?: any): Promise<void> {
    if (!this.isActive) {
      logger.warn(`${this.constructor.name} is not active, cannot collect metrics`);
      return;
    }

    try {
      const metrics = await this.gatherMetrics(eventData);

      if (metrics) {
        await this.processMetrics(metrics);
      }
    } catch (error) {
      logger.error(`Failed to collect metrics in ${this.constructor.name}:`, error);
      this.emit('error', error);

      if (this.config.validation.strictMode) {
        throw error;
      }
    }
  }

  /**
   * Get current metrics snapshot
   */
  public getCurrentMetrics(): Partial<BaseMetrics> | null {
    const bufferedMetrics = Array.from(this.metricsBuffer.values()).pop();
    return bufferedMetrics || null;
  }

  /**
   * Get collection status
   */
  public getStatus(): {
    isActive: boolean;
    lastCollectionTime?: Date;
    bufferedMetricsCount: number;
    context: MetricsCollectionContext;
  } {
    return {
      isActive: this.isActive,
      lastCollectionTime: this.lastCollectionTime,
      bufferedMetricsCount: this.metricsBuffer.size,
      context: this.context,
    };
  }

  /**
   * Abstract method to initialize the collector
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Abstract method to gather specific metrics
   */
  protected abstract gatherMetrics(eventData?: any): Promise<Partial<BaseMetrics> | null>;

  /**
   * Abstract method to validate metrics
   */
  protected abstract validateMetrics(metrics: Partial<BaseMetrics>): MetricValidationError[];

  /**
   * Abstract method to persist metrics
   */
  protected abstract persistMetrics(metrics: BaseMetrics): Promise<void>;

  /**
   * Start real-time collection interval
   */
  private startRealTimeCollection(): void {
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error(`Real-time collection failed in ${this.constructor.name}:`, error);
      }
    }, this.config.collectionInterval);
  }

  /**
   * Process collected metrics
   */
  private async processMetrics(metrics: Partial<BaseMetrics>): Promise<void> {
    // Add base properties
    const enrichedMetrics: BaseMetrics = {
      timestamp: new Date(),
      evaluationId: this.context.evaluationId,
      agentId: this.context.agentId,
      benchmarkId: this.context.benchmarkId,
      sessionId: this.context.sessionId,
      ...metrics,
    };

    // Validate metrics
    const validationErrors = this.validateMetrics(enrichedMetrics);
    if (validationErrors.length > 0) {
      logger.warn(`Metric validation errors in ${this.constructor.name}:`, validationErrors);

      if (this.config.validation.strictMode) {
        throw new Error(`Metric validation failed: ${validationErrors.map(e => e.field).join(', ')}`);
      }
    }

    // Detect outliers if enabled
    if (this.config.validation.outlierDetection) {
      const isOutlier = this.detectOutlier(enrichedMetrics);
      if (isOutlier) {
        logger.warn(`Outlier detected in ${this.constructor.name}:`, enrichedMetrics);
        this.emit('outlier', enrichedMetrics);
      }
    }

    // Buffer metrics
    this.metricsBuffer.set(`${Date.now()}-${Math.random()}`, enrichedMetrics);

    // Persist immediately or batch
    if (this.config.storage.persistImmediately) {
      await this.persistMetrics(enrichedMetrics);
      this.metricsBuffer.clear();
    } else if (this.metricsBuffer.size >= this.config.batchSize) {
      await this.flushMetrics();
    }

    // Emit real-time update
    if (this.config.enableRealTime) {
      this.emit('metrics', enrichedMetrics);
    }

    this.lastCollectionTime = new Date();
  }

  /**
   * Flush buffered metrics to storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.size === 0) {
      return;
    }

    try {
      const metricsToFlush = Array.from(this.metricsBuffer.values());

      for (const metrics of metricsToFlush) {
        await this.persistMetrics(metrics as BaseMetrics);
      }

      this.metricsBuffer.clear();
      logger.debug(`Flushed ${metricsToFlush.length} metrics from ${this.constructor.name}`);
    } catch (error) {
      logger.error(`Failed to flush metrics from ${this.constructor.name}:`, error);
      throw error;
    }
  }

  /**
   * Simple outlier detection based on standard deviation
   */
  private detectOutlier(metrics: BaseMetrics): boolean {
    // This is a simple implementation - can be enhanced with more sophisticated algorithms
    const historicalMetrics = Array.from(this.metricsBuffer.values()).slice(-10); // Last 10 metrics

    if (historicalMetrics.length < 3) {
      return false; // Not enough data for outlier detection
    }

    // Check for basic anomalies (can be extended)
    const currentTime = metrics.timestamp.getTime();
    const recentTimes = historicalMetrics.map(m => (m.timestamp ? m.timestamp.getTime() : 0));

    // Simple time-based outlier detection
    const avgInterval = recentTimes.reduce((sum, time, i) => {
      if (i === 0) return 0;
      return sum + (time - recentTimes[i - 1]);
    }, 0) / (recentTimes.length - 1);

    const lastInterval = currentTime - recentTimes[recentTimes.length - 1];

    // Flag as outlier if interval is more than 3x the average
    return lastInterval > avgInterval * 3;
  }

  /**
   * Retry mechanism for failed operations
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`${operationName} failed (attempt ${attempt}/${this.config.retryAttempts}):`, error);

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`${operationName} failed after ${this.config.retryAttempts} attempts: ${lastError?.message ?? 'unknown error'}`);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    await this.stop();
    this.metricsBuffer.clear();
    this.removeAllListeners();
    logger.debug(`${this.constructor.name} cleaned up`);
  }
}