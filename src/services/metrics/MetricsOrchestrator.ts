/**
 * Metrics Orchestrator
 * Coordinates all metric collectors and provides unified interface for metrics collection
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { BaseMetricCollector } from './BaseMetricCollector';
import { PerformanceMetricsCollector } from './PerformanceMetricsCollector';
import { EfficiencyMetricsCollector } from './EfficiencyMetricsCollector';
import { CostMetricsCollector } from './CostMetricsCollector';
import { RobustnessMetricsCollector } from './RobustnessMetricsCollector';
import { QualityMetricsCollector } from './QualityMetricsCollector';
import { MetricsCollectionContext, ComprehensiveMetrics, MetricCollectorConfig, RealTimeMetricsUpdate } from '../../types/metrics';
import { EvaluationModel } from '../../database/models/Evaluation';

interface OrchestratorConfig {
  enableAllCollectors: boolean;
  collectorConfigs: {
    performance?: Partial<MetricCollectorConfig>;
    efficiency?: Partial<MetricCollectorConfig>;
    cost?: Partial<MetricCollectorConfig>;
    robustness?: Partial<MetricCollectorConfig>;
    quality?: Partial<MetricCollectorConfig>;
  };
  aggregation: {
    interval: number; // milliseconds
    enableRealTimeUpdates: boolean;
    persistenceBatchSize: number;
  };
  validation: {
    strictMode: boolean;
    qualityThreshold: number;
  };
}

export class MetricsOrchestrator extends EventEmitter {
  private context: MetricsCollectionContext;
  private config: OrchestratorConfig;
  private collectors: Map<string, BaseMetricCollector> = new Map();
  private isActive: boolean = false;
  private aggregationInterval?: NodeJS.Timeout;
  private lastAggregationTime?: Date;
  private metricsHistory: ComprehensiveMetrics[] = [];

  constructor(context: MetricsCollectionContext, config: Partial<OrchestratorConfig> = {}) {
    super();
    this.context = context;
    this.config = {
      enableAllCollectors: true,
      collectorConfigs: {},
      aggregation: {
        interval: 5000, // 5 seconds
        enableRealTimeUpdates: true,
        persistenceBatchSize: 10,
      },
      validation: {
        strictMode: true,
        qualityThreshold: 0.8,
      },
      ...config,
    };
  }

  /**
   * Initialize the orchestrator and all collectors
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing MetricsOrchestrator', { evaluationId: this.context.evaluationId });

      // Initialize collectors based on configuration
      if (this.config.enableAllCollectors || this.config.collectorConfigs.performance) {
        const performanceCollector = new PerformanceMetricsCollector(
          this.context,
          this.config.collectorConfigs.performance
        );
        await this.setupCollector('performance', performanceCollector);
      }

      if (this.config.enableAllCollectors || this.config.collectorConfigs.efficiency) {
        const efficiencyCollector = new EfficiencyMetricsCollector(
          this.context,
          this.config.collectorConfigs.efficiency
        );
        await this.setupCollector('efficiency', efficiencyCollector);
      }

      if (this.config.enableAllCollectors || this.config.collectorConfigs.cost) {
        const costCollector = new CostMetricsCollector(
          this.context,
          this.config.collectorConfigs.cost
        );
        await this.setupCollector('cost', costCollector);
      }

      if (this.config.enableAllCollectors || this.config.collectorConfigs.robustness) {
        const robustnessCollector = new RobustnessMetricsCollector(
          this.context,
          this.config.collectorConfigs.robustness
        );
        await this.setupCollector('robustness', robustnessCollector);
      }

      if (this.config.enableAllCollectors || this.config.collectorConfigs.quality) {
        const qualityCollector = new QualityMetricsCollector(
          this.context,
          this.config.collectorConfigs.quality
        );
        await this.setupCollector('quality', qualityCollector);
      }

      logger.info(`MetricsOrchestrator initialized with ${this.collectors.size} collectors`);
      this.emit('initialized', { collectors: Array.from(this.collectors.keys()) });
    } catch (error) {
      logger.error('Failed to initialize MetricsOrchestrator:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start all collectors and begin metrics collection
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      logger.warn('MetricsOrchestrator is already active');
      return;
    }

    try {
      logger.info('Starting MetricsOrchestrator');

      // Start all collectors
      for (const [name, collector] of this.collectors.entries()) {
        await collector.start();
        logger.debug(`Started collector: ${name}`);
      }

      this.isActive = true;
      this.lastAggregationTime = new Date();

      // Start aggregation interval
      if (this.config.aggregation.enableRealTimeUpdates) {
        this.startAggregation();
      }

      logger.info('MetricsOrchestrator started successfully');
      this.emit('started', { collectors: Array.from(this.collectors.keys()) });
    } catch (error) {
      logger.error('Failed to start MetricsOrchestrator:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop all collectors and metrics collection
   */
  public async stop(): Promise<void> {
    if (!this.isActive) {
      logger.warn('MetricsOrchestrator is not active');
      return;
    }

    try {
      logger.info('Stopping MetricsOrchestrator');

      // Stop aggregation interval
      if (this.aggregationInterval) {
        clearInterval(this.aggregationInterval);
        this.aggregationInterval = undefined;
      }

      // Stop all collectors
      for (const [name, collector] of this.collectors.entries()) {
        await collector.stop();
        logger.debug(`Stopped collector: ${name}`);
      }

      this.isActive = false;

      logger.info('MetricsOrchestrator stopped successfully');
      this.emit('stopped', {});
    } catch (error) {
      logger.error('Failed to stop MetricsOrchestrator:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get current comprehensive metrics
   */
  public async getCurrentMetrics(): Promise<ComprehensiveMetrics | null> {
    try {
      const metrics = await this.aggregateCurrentMetrics();
      if (metrics) {
        await this.calculateAggregatedMetrics(metrics);
      }
      return metrics;
    } catch (error) {
      logger.error('Failed to get current metrics:', error);
      return null;
    }
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit?: number): ComprehensiveMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : [...this.metricsHistory];
  }

  /**
   * Record task-related events
   */
  public recordTaskStart(taskId: string, totalTasks?: number): void {
    const performanceCollector = this.collectors.get('performance') as PerformanceMetricsCollector;
    if (performanceCollector) {
      performanceCollector.recordTaskStart(taskId, totalTasks);
    }

    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      efficiencyCollector.recordStepStart(`task_${taskId}`);
    }
  }

  public recordTaskCompletion(taskId: string, success: boolean, accuracy?: number): void {
    const performanceCollector = this.collectors.get('performance') as PerformanceMetricsCollector;
    if (performanceCollector) {
      performanceCollector.recordTaskCompletion(taskId, success, accuracy);
    }

    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      efficiencyCollector.recordStepCompletion(`task_${taskId}`);
    }

    const costCollector = this.collectors.get('cost') as CostMetricsCollector;
    if (costCollector) {
      costCollector.recordTaskCompletion();
    }
  }

  public recordTaskFailure(taskId: string, error?: string): void {
    const performanceCollector = this.collectors.get('performance') as PerformanceMetricsCollector;
    if (performanceCollector) {
      performanceCollector.recordTaskFailure(taskId, error);
    }

    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      efficiencyCollector.recordStepCompletion(`task_${taskId}`);
    }
  }

  /**
   * Record step-related events
   */
  public recordStepStart(stepId: string): void {
    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      efficiencyCollector.recordStepStart(stepId);
    }
  }

  public recordStepCompletion(stepId: string): void {
    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      efficiencyCollector.recordStepCompletion(stepId);
    }
  }

  /**
   * Record token usage
   */
  public recordTokenUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    customPricing?: { input: number; output: number }
  ): void {
    const costCollector = this.collectors.get('cost') as CostMetricsCollector;
    if (costCollector) {
      costCollector.recordTokenUsage(model, inputTokens, outputTokens, customPricing);
    }
  }

  /**
   * Record API call
   */
  public recordApiCall(
    apiName: string,
    endpoint: string,
    cost: number,
    tokens?: number,
    responseTime?: number
  ): void {
    const costCollector = this.collectors.get('cost') as CostMetricsCollector;
    if (costCollector) {
      costCollector.recordApiCall(apiName, endpoint, cost, tokens, responseTime);
    }
  }

  /**
   * Record tool usage
   */
  public recordToolUsage(
    toolName: string,
    success: boolean,
    executionTime: number,
    context?: Record<string, any>
  ): void {
    const qualityCollector = this.collectors.get('quality') as QualityMetricsCollector;
    if (qualityCollector) {
      qualityCollector.recordToolUsage(toolName, success, executionTime, context);
    }

    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      // Record as step if not already tracked
      efficiencyCollector.recordStepStart(toolName);
      efficiencyCollector.recordStepCompletion(toolName);
    }
  }

  /**
   * Record error
   */
  public recordError(
    type: 'fatal' | 'recoverable' | 'transient',
    category: 'timeout' | 'resource_exhaustion' | 'api_failure' | 'logic_error' | 'unexpected_input' | 'network' | 'unknown',
    message: string,
    context?: Record<string, any>
  ): void {
    const robustnessCollector = this.collectors.get('robustness') as RobustnessMetricsCollector;
    if (robustnessCollector) {
      robustnessCollector.recordError(type, category, message, context);
    }
  }

  /**
   * Record decision
   */
  public recordDecision(
    context: string,
    options: string[],
    selected: string,
    optimal: string,
    reasoning: string,
    confidence?: number
  ): void {
    const qualityCollector = this.collectors.get('quality') as QualityMetricsCollector;
    if (qualityCollector) {
      qualityCollector.recordDecision(context, options, selected, optimal, reasoning, confidence);
    }
  }

  /**
   * Record output quality
   */
  public recordOutputQuality(
    taskId: string,
    relevance: number,
    completeness: number,
    correctness: number,
    clarity: number,
    feedback?: string
  ): void {
    const qualityCollector = this.collectors.get('quality') as QualityMetricsCollector;
    if (qualityCollector) {
      qualityCollector.recordOutputQuality(taskId, relevance, completeness, correctness, clarity, feedback);
    }
  }

  /**
   * Get collector summaries
   */
  public getCollectorSummaries(): Record<string, any> {
    const summaries: Record<string, any> = {};

    const performanceCollector = this.collectors.get('performance') as PerformanceMetricsCollector;
    if (performanceCollector) {
      summaries.performance = performanceCollector.getPerformanceSummary();
    }

    const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
    if (efficiencyCollector) {
      summaries.efficiency = efficiencyCollector.getEfficiencySummary();
    }

    const costCollector = this.collectors.get('cost') as CostMetricsCollector;
    if (costCollector) {
      summaries.cost = costCollector.getCostSummary();
    }

    const robustnessCollector = this.collectors.get('robustness') as RobustnessMetricsCollector;
    if (robustnessCollector) {
      summaries.robustness = robustnessCollector.getRobustnessSummary();
    }

    const qualityCollector = this.collectors.get('quality') as QualityMetricsCollector;
    if (qualityCollector) {
      summaries.quality = qualityCollector.getQualitySummary();
    }

    return summaries;
  }

  /**
   * Setup individual collector
   */
  private async setupCollector(name: string, collector: BaseMetricCollector): Promise<void> {
    // Forward collector events to orchestrator
    collector.on('metrics', (metrics) => {
      this.emit('collector_metrics', { collector: name, metrics });
    });

    collector.on('error', (error) => {
      logger.error(`Collector ${name} error:`, error);
      this.emit('collector_error', { collector: name, error });
    });

    collector.on('outlier', (metrics) => {
      logger.warn(`Collector ${name} detected outlier:`, metrics);
      this.emit('collector_outlier', { collector: name, metrics });
    });

    this.collectors.set(name, collector);
    logger.debug(`Collector ${name} set up successfully`);
  }

  /**
   * Start aggregation interval
   */
  private startAggregation(): void {
    this.aggregationInterval = setInterval(async () => {
      try {
        const metrics = await this.aggregateCurrentMetrics();
        if (metrics) {
          await this.calculateAggregatedMetrics(metrics);
          this.lastAggregationTime = new Date();

          // Emit real-time update
          if (this.config.aggregation.enableRealTimeUpdates) {
            const update: RealTimeMetricsUpdate = {
              type: 'metric_update',
              evaluationId: this.context.evaluationId,
              agentId: this.context.agentId,
              timestamp: new Date(),
              data: metrics,
            };
            this.emit('real_time_update', update);
          }

          // Add to history
          this.metricsHistory.push(metrics);

          // Limit history size
          if (this.metricsHistory.length > 1000) {
            this.metricsHistory = this.metricsHistory.slice(-1000);
          }
        }
      } catch (error) {
        logger.error('Aggregation failed:', error);
        this.emit('aggregation_error', error);
      }
    }, this.config.aggregation.interval);
  }

  /**
   * Aggregate current metrics from all collectors
   */
  private async aggregateCurrentMetrics(): Promise<ComprehensiveMetrics | null> {
    const metrics: any = {};

    try {
      // Gather fresh metrics directly from each collector (bypasses buffer lag)
      const performanceCollector = this.collectors.get('performance') as PerformanceMetricsCollector;
      if (performanceCollector) {
        const perfMetrics = await (performanceCollector as any).gatherMetrics();
        if (perfMetrics) {
          metrics.performance = perfMetrics;
        }
      }

      const efficiencyCollector = this.collectors.get('efficiency') as EfficiencyMetricsCollector;
      if (efficiencyCollector) {
        const effMetrics = await (efficiencyCollector as any).gatherMetrics();
        if (effMetrics) {
          metrics.efficiency = effMetrics;
        }
      }

      const costCollector = this.collectors.get('cost') as CostMetricsCollector;
      if (costCollector) {
        const costMetrics = await (costCollector as any).gatherMetrics();
        if (costMetrics) {
          metrics.cost = costMetrics;
        }
      }

      const robustnessCollector = this.collectors.get('robustness') as RobustnessMetricsCollector;
      if (robustnessCollector) {
        const robustMetrics = await (robustnessCollector as any).gatherMetrics();
        if (robustMetrics) {
          metrics.robustness = robustMetrics;
        }
      }

      const qualityCollector = this.collectors.get('quality') as QualityMetricsCollector;
      if (qualityCollector) {
        const qualityMetrics = await (qualityCollector as any).gatherMetrics();
        if (qualityMetrics) {
          metrics.quality = qualityMetrics;
        }
      }

      return Object.keys(metrics).length > 0 ? metrics : null;
    } catch (error) {
      logger.error('Failed to aggregate current metrics:', error);
      return null;
    }
  }

  /**
   * Calculate aggregated metrics (overall score, rank, etc.)
   */
  private async calculateAggregatedMetrics(metrics: ComprehensiveMetrics): Promise<void> {
    try {
      // Calculate overall score (weighted average of different metric categories)
      const weights = {
        performance: 0.3,
        efficiency: 0.2,
        cost: 0.2,
        robustness: 0.15,
        quality: 0.15,
      };

      let overallScore = 0;
      let totalWeight = 0;

      if (metrics.performance) {
        overallScore += metrics.performance.taskSuccessRate * weights.performance;
        totalWeight += weights.performance;
      }

      if (metrics.efficiency) {
        // Normalize efficiency metrics (inverse of execution time, higher throughput is better)
        const efficiencyScore = Math.min(1, 1000 / Math.max(1, metrics.efficiency.executionTime));
        overallScore += efficiencyScore * weights.efficiency;
        totalWeight += weights.efficiency;
      }

      if (metrics.cost) {
        // Cost score - lower cost is better
        const costScore = Math.max(0, 1 - Math.min(1, metrics.cost.estimatedCost / 10)); // Normalize against $10
        overallScore += costScore * weights.cost;
        totalWeight += weights.cost;
      }

      if (metrics.robustness) {
        overallScore += metrics.robustness.recoveryRate * weights.robustness;
        totalWeight += weights.robustness;
      }

      if (metrics.quality) {
        overallScore += metrics.quality.decisionQuality * weights.quality;
        totalWeight += weights.quality;
      }

      if (totalWeight > 0) {
        overallScore /= totalWeight;
      }

      // Calculate rank and percentile (simplified - would need comparison with other evaluations)
      metrics.aggregated = {
        overallScore: Math.round(overallScore * 10000) / 10000,
        rank: 1, // Would be calculated based on comparison
        percentile: 95, // Would be calculated based on comparison
        trend: 'stable', // Would be calculated based on historical data
        confidence: 0.85, // Would be calculated based on data quality
      };

      // Persist aggregated metrics
      await EvaluationModel.updateMetrics(this.context.evaluationId, metrics as any);
    } catch (error) {
      logger.error('Failed to calculate aggregated metrics:', error);
    }
  }

  /**
   * Clean up all resources
   */
  public async cleanup(): Promise<void> {
    await this.stop();

    // Cleanup all collectors
    for (const [name, collector] of this.collectors.entries()) {
      try {
        await collector.cleanup();
        logger.debug(`Cleaned up collector: ${name}`);
      } catch (error) {
        logger.error(`Failed to cleanup collector ${name}:`, error);
      }
    }

    this.collectors.clear();
    this.metricsHistory = [];
    this.removeAllListeners();

    logger.debug('MetricsOrchestrator cleaned up');
  }
}