/**
 * Efficiency Metrics Collector
 * Tracks execution time, latency per step, resource utilization, and throughput
 */

import { BaseMetricCollector } from './BaseMetricCollector';
import { BaseMetrics, EfficiencyMetrics, MetricsCollectionContext, MetricValidationError } from '../../types/metrics';
import { logger } from '../../utils/logger';
import { EvaluationModel } from '../../database/models/Evaluation';
import { performance } from 'perf_hooks';

interface StepTiming {
  stepId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore?: number;
  memoryAfter?: number;
  cpuBefore?: number;
  cpuAfter?: number;
}

interface ResourceSnapshot {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
}

interface EfficiencyState {
  steps: Map<string, StepTiming>;
  resourceSnapshots: ResourceSnapshot[];
  totalSteps: number;
  completedSteps: number;
  startTime: number;
  endTime?: number;
  stepDurations: number[];
  memoryUsage: {
    peak: number;
    average: number;
    samples: number[];
  };
  cpuUsage: {
    peak: number;
    average: number;
    samples: number[];
  };
  throughput: {
    tasksPerSecond: number;
    stepsPerSecond: number;
  };
}

export class EfficiencyMetricsCollector extends BaseMetricCollector {
  private state: EfficiencyState;
  private resourceMonitorInterval?: NodeJS.Timeout;

  constructor(context: MetricsCollectionContext, config?: any) {
    super(context, config);
    this.state = {
      steps: new Map(),
      resourceSnapshots: [],
      totalSteps: 0,
      completedSteps: 0,
      startTime: performance.now(),
      stepDurations: [],
      memoryUsage: {
        peak: 0,
        average: 0,
        samples: [],
      },
      cpuUsage: {
        peak: 0,
        average: 0,
        samples: [],
      },
      throughput: {
        tasksPerSecond: 0,
        stepsPerSecond: 0,
      },
    };
  }

  protected async initialize(): Promise<void> {
    logger.debug('Initializing EfficiencyMetricsCollector');

    // Start resource monitoring
    this.startResourceMonitoring();

    // Set up event listeners for step events
    this.on('step_started', this.handleStepStarted.bind(this));
    this.on('step_completed', this.handleStepCompleted.bind(this));
    this.on('evaluation_completed', this.handleEvaluationCompleted.bind(this));
  }

  protected async gatherMetrics(eventData?: any): Promise<Partial<EfficiencyMetrics> | null> {
    const now = performance.now();
    const currentTime = new Date();

    // Calculate execution time
    const executionTime = this.state.endTime
      ? this.state.endTime - this.state.startTime
      : now - this.state.startTime;

    // Calculate average step duration
    const latencyPerStep = this.state.stepDurations.length > 0
      ? this.state.stepDurations.reduce((sum, duration) => sum + duration, 0) / this.state.stepDurations.length
      : 0;

    // Calculate throughput
    const elapsedSeconds = executionTime / 1000;
    const throughput = elapsedSeconds > 0 ? this.state.completedSteps / elapsedSeconds : 0;

    // Calculate response time statistics
    const responseTimes = this.state.stepDurations.length > 0
      ? this.calculateResponseTimeStats(this.state.stepDurations)
      : {
          min: 0,
          max: 0,
          average: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        };

    // Get current resource usage
    const currentResources = await this.getCurrentResourceUsage();

    return {
      timestamp: currentTime,
      evaluationId: this.context.evaluationId,
      agentId: this.context.agentId,
      benchmarkId: this.context.benchmarkId,
      sessionId: this.context.sessionId,
      executionTime: Math.round(executionTime),
      latencyPerStep: Math.round(latencyPerStep),
      totalSteps: this.state.totalSteps,
      averageStepDuration: Math.round(latencyPerStep),
      peakMemoryUsage: Math.round(this.state.memoryUsage.peak),
      averageMemoryUsage: Math.round(this.state.memoryUsage.average),
      cpuUtilization: this.state.cpuUsage.average / 100, // Convert percentage to decimal
      throughput: Math.round(throughput * 100) / 100,
      responseTime: responseTimes,
    };
  }

  protected validateMetrics(metrics: Partial<BaseMetrics>): MetricValidationError[] {
    const errors: MetricValidationError[] = [];
    const effMetrics = metrics as EfficiencyMetrics;

    if (effMetrics.executionTime !== undefined && effMetrics.executionTime < 0) {
      errors.push({
        field: 'executionTime',
        value: effMetrics.executionTime,
        expected: 'positive number',
        actual: String(effMetrics.executionTime),
        severity: 'error',
      });
    }

    if (effMetrics.latencyPerStep !== undefined && effMetrics.latencyPerStep < 0) {
      errors.push({
        field: 'latencyPerStep',
        value: effMetrics.latencyPerStep,
        expected: 'positive number',
        actual: String(effMetrics.latencyPerStep),
        severity: 'error',
      });
    }

    if (effMetrics.cpuUtilization !== undefined &&
        (effMetrics.cpuUtilization < 0 || effMetrics.cpuUtilization > 1)) {
      errors.push({
        field: 'cpuUtilization',
        value: effMetrics.cpuUtilization,
        expected: '0-1 decimal',
        actual: String(effMetrics.cpuUtilization),
        severity: 'error',
      });
    }

    return errors;
  }

  protected async persistMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await EvaluationModel.updateMetrics(this.context.evaluationId, {
          efficiency: metrics as EfficiencyMetrics,
        } as any);
      }, 'persist_efficiency_metrics');

      logger.debug('Efficiency metrics persisted successfully');
    } catch (error) {
      logger.error('Failed to persist efficiency metrics:', error);
      throw error;
    }
  }

  /**
   * Start a new step
   */
  public recordStepStart(stepId: string): void {
    const timing: StepTiming = {
      stepId,
      startTime: performance.now(),
    };

    this.state.steps.set(stepId, timing);
    this.state.totalSteps++;

    logger.debug(`Step started: ${stepId}`);
  }

  /**
   * Complete a step
   */
  public recordStepCompletion(stepId: string): void {
    const step = this.state.steps.get(stepId);
    if (!step) {
      logger.warn(`Step not found for completion: ${stepId}`);
      return;
    }

    step.endTime = performance.now();
    step.duration = step.endTime - step.startTime;

    this.state.completedSteps++;
    this.state.stepDurations.push(step.duration);

    logger.debug(`Step completed: ${stepId}`, { duration: step.duration });
  }

  /**
   * Get current resource usage
   */
  private async getCurrentResourceUsage(): Promise<ResourceSnapshot> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Convert memory usage to MB
    const memoryUsed = memUsage.heapUsed / 1024 / 1024;
    const memoryTotal = memUsage.heapTotal / 1024 / 1024;

    // Simple CPU usage calculation (can be enhanced with more accurate methods)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    return {
      timestamp: Date.now(),
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        percentage: (memoryUsed / memoryTotal) * 100,
      },
      cpu: {
        usage: cpuPercent,
        loadAverage: [0, 0, 0], // Would need system-specific implementation
      },
    };
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitorInterval = setInterval(async () => {
      try {
        const resources = await this.getCurrentResourceUsage();
        this.state.resourceSnapshots.push(resources);

        // Update memory usage statistics
        this.state.memoryUsage.samples.push(resources.memory.used);
        this.state.memoryUsage.peak = Math.max(this.state.memoryUsage.peak, resources.memory.used);
        this.state.memoryUsage.average = this.state.memoryUsage.samples.reduce((sum, sample) => sum + sample, 0) / this.state.memoryUsage.samples.length;

        // Update CPU usage statistics
        this.state.cpuUsage.samples.push(resources.cpu.usage);
        this.state.cpuUsage.peak = Math.max(this.state.cpuUsage.peak, resources.cpu.usage);
        this.state.cpuUsage.average = this.state.cpuUsage.samples.reduce((sum, sample) => sum + sample, 0) / this.state.cpuUsage.samples.length;

        // Keep only recent snapshots (last 1000)
        if (this.state.resourceSnapshots.length > 1000) {
          this.state.resourceSnapshots = this.state.resourceSnapshots.slice(-1000);
          this.state.memoryUsage.samples = this.state.memoryUsage.samples.slice(-1000);
          this.state.cpuUsage.samples = this.state.cpuUsage.samples.slice(-1000);
        }
      } catch (error) {
        logger.error('Failed to collect resource usage:', error);
      }
    }, 1000); // Collect every second
  }

  /**
   * Calculate response time statistics
   */
  private calculateResponseTimeStats(durations: number[]): {
    min: number;
    max: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (durations.length === 0) {
      return { min: 0, max: 0, average: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const average = sorted.reduce((sum, duration) => sum + duration, 0) / sorted.length;

    const getPercentile = (sortedArray: number[], percentile: number): number => {
      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
      return sortedArray[Math.max(0, index)];
    };

    return {
      min: Math.round(min),
      max: Math.round(max),
      average: Math.round(average),
      p50: Math.round(getPercentile(sorted, 50)),
      p95: Math.round(getPercentile(sorted, 95)),
      p99: Math.round(getPercentile(sorted, 99)),
    };
  }

  /**
   * Get current efficiency summary
   */
  public getEfficiencySummary(): {
    executionTime: number;
    averageStepDuration: number;
    throughput: number;
    peakMemoryUsage: number;
    averageCpuUsage: number;
    completedSteps: number;
    totalSteps: number;
  } {
    const now = performance.now();
    const executionTime = this.state.endTime
      ? this.state.endTime - this.state.startTime
      : now - this.state.startTime;

    const elapsedSeconds = executionTime / 1000;
    const throughput = elapsedSeconds > 0 ? this.state.completedSteps / elapsedSeconds : 0;

    const averageStepDuration = this.state.stepDurations.length > 0
      ? this.state.stepDurations.reduce((sum, duration) => sum + duration, 0) / this.state.stepDurations.length
      : 0;

    return {
      executionTime: Math.round(executionTime),
      averageStepDuration: Math.round(averageStepDuration),
      throughput: Math.round(throughput * 100) / 100,
      peakMemoryUsage: Math.round(this.state.memoryUsage.peak),
      averageCpuUsage: Math.round(this.state.cpuUsage.average * 100) / 100,
      completedSteps: this.state.completedSteps,
      totalSteps: this.state.totalSteps,
    };
  }

  // Event handlers
  private handleStepStarted(data: { stepId: string }): void {
    this.recordStepStart(data.stepId);
  }

  private handleStepCompleted(data: { stepId: string; duration?: number }): void {
    this.recordStepCompletion(data.stepId);
  }

  private handleEvaluationCompleted(): void {
    this.state.endTime = performance.now();
    logger.debug('Evaluation completed in efficiency collector');
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = undefined;
    }

    await super.cleanup();
    logger.debug('EfficiencyMetricsCollector cleaned up');
  }
}