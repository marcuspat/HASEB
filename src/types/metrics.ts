/**
 * Comprehensive metrics types for HASEB evaluation system
 * Defines all metric categories and collection interfaces
 */

export interface BaseMetrics {
  timestamp: Date;
  evaluationId: string;
  agentId: string;
  benchmarkId: string;
  sessionId: string;
}

export interface PerformanceMetrics extends BaseMetrics {
  taskSuccessRate: number; // 0-1 decimal
  tasksCompleted: number;
  tasksTotal: number;
  passRate: number; // 0-1 decimal
  failRate: number; // 0-1 decimal
  completionValidation: {
    passed: number;
    failed: number;
    skipped: number;
  };
  resultAccuracy: number; // 0-1 decimal
  benchmarkCompletionRate: number; // 0-1 decimal
}

export interface EfficiencyMetrics extends BaseMetrics {
  executionTime: number; // milliseconds
  latencyPerStep: number; // milliseconds
  totalSteps: number;
  averageStepDuration: number; // milliseconds
  peakMemoryUsage: number; // MB
  averageMemoryUsage: number; // MB
  cpuUtilization: number; // 0-1 decimal
  throughput: number; // tasks per second
  responseTime: {
    min: number; // milliseconds
    max: number; // milliseconds
    average: number; // milliseconds
    p50: number; // milliseconds
    p95: number; // milliseconds
    p99: number; // milliseconds
  };
}

export interface CostMetrics extends BaseMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // USD
  tokenCosts: {
    input: number; // USD
    output: number; // USD
    total: number; // USD
  };
  apiCosts: {
    [apiName: string]: {
      calls: number;
      cost: number; // USD
      tokens?: number;
    };
  };
  resourceCosts: {
    compute: number; // USD
    storage: number; // USD
    network: number; // USD
    total: number; // USD
  };
  costPerTask: number; // USD
  costOptimization: {
    potential: number; // USD
    achieved: number; // USD
    efficiency: number; // 0-1 decimal
  };
}

export interface RobustnessMetrics extends BaseMetrics {
  toolCallErrorRate: number; // 0-1 decimal
  recoveryRate: number; // 0-1 decimal
  errorCounts: {
    total: number;
    fatal: number;
    recoverable: number;
    transient: number;
  };
  errorPatterns: {
    [errorType: string]: {
      count: number;
      recoveryTime: number; // milliseconds
      recoveryAttempts: number;
      successRate: number; // 0-1 decimal
    };
  };
  failureModes: {
    timeout: number;
    resourceExhaustion: number;
    apiFailure: number;
    logicError: number;
    unexpectedInput: number;
  };
  resilience: {
    averageRecoveryTime: number; // milliseconds
    maxDowntime: number; // milliseconds
    availability: number; // 0-1 decimal
    meanTimeBetweenFailures: number; // milliseconds
  };
}

export interface QualityMetrics extends BaseMetrics {
  toolSelectionAccuracy: number; // 0-1 decimal
  parameterAccuracy: number; // 0-1 decimal
  decisionQuality: number; // 0-1 decimal
  outputQuality: number; // 0-1 decimal
  toolUsage: {
    [toolName: string]: {
      uses: number;
      successRate: number; // 0-1 decimal
      averageExecutionTime: number; // milliseconds
      errors: number;
    };
  };
  parameterValidation: {
    correct: number;
    incorrect: number;
    missing: number;
    invalid: number;
  };
  decisionTracking: {
    total: number;
    optimal: number;
    suboptimal: number;
    incorrect: number;
  };
  outputScoring: {
    relevance: number; // 0-1 decimal
    completeness: number; // 0-1 decimal
    correctness: number; // 0-1 decimal
    clarity: number; // 0-1 decimal
  };
}

export interface ComprehensiveMetrics {
  performance: PerformanceMetrics;
  efficiency: EfficiencyMetrics;
  cost: CostMetrics;
  robustness: RobustnessMetrics;
  quality: QualityMetrics;
  aggregated: {
    overallScore: number; // 0-1 decimal
    rank: number;
    percentile: number; // 0-100
    trend: 'improving' | 'stable' | 'declining';
    confidence: number; // 0-1 decimal
  };
}

export interface MetricsCollectionContext {
  evaluationId: string;
  agentId: string;
  benchmarkId: string;
  sessionId: string;
  startTime: Date;
  configuration: Record<string, any>;
  environment: {
    platform: string;
    version: string;
    resources: {
      cpu: string;
      memory: string;
      storage: string;
    };
  };
}

export interface MetricCollectorConfig {
  collectionInterval: number; // milliseconds
  batchSize: number;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  enableRealTime: boolean;
  storage: {
    persistImmediately: boolean;
    compressionEnabled: boolean;
    retentionDays: number;
  };
  validation: {
    strictMode: boolean;
    outlierDetection: boolean;
    qualityThreshold: number; // 0-1 decimal
  };
}

export interface MetricValidationError {
  field: string;
  value: any;
  expected: string;
  actual: string;
  severity: 'error' | 'warning' | 'info';
}

export interface MetricsAggregation {
  timeRange: {
    start: Date;
    end: Date;
  };
  filters: {
    agentIds?: string[];
    benchmarkIds?: string[];
    status?: string[];
  };
  aggregations: {
    performance: {
      avgSuccessRate: number;
      totalTasks: number;
      completionRate: number;
    };
    efficiency: {
      avgExecutionTime: number;
      avgThroughput: number;
      resourceUtilization: number;
    };
    cost: {
      totalCost: number;
      avgCostPerTask: number;
      tokenEfficiency: number;
    };
    robustness: {
      avgErrorRate: number;
      avgRecoveryRate: number;
      availability: number;
    };
    quality: {
      avgQualityScore: number;
      toolAccuracy: number;
      decisionQuality: number;
    };
  };
  trends: {
    [metricName: string]: {
      direction: 'up' | 'down' | 'stable';
      changeRate: number; // percentage
      confidence: number; // 0-1 decimal
    };
  };
}

export interface MetricsExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'parquet';
  includeRaw: boolean;
  includeAggregated: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters: {
    agentIds?: string[];
    benchmarkIds?: string[];
    metricTypes?: string[];
  };
  compression?: boolean;
  encryption?: boolean;
}

export interface RealTimeMetricsUpdate {
  type: 'metric_update' | 'evaluation_complete' | 'error';
  evaluationId: string;
  agentId: string;
  timestamp: Date;
  data: Partial<ComprehensiveMetrics>;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  status?: 'running' | 'completed' | 'failed' | 'paused';
}

// Legacy compatibility interfaces
export interface LegacyPerformanceMetrics {
  taskSuccessRate: number;
  executionTime: number;
  latencyPerStep: number;
  totalSteps: number;
  totalTokens: number;
  estimatedCost: number;
  toolCallErrorRate: number;
  recoveryRate: number;
  toolSelectionAccuracy: number;
  parameterAccuracy: number;
}

// Type guards and utilities
export function isPerformanceMetrics(obj: any): obj is PerformanceMetrics {
  return !!(obj &&
         typeof obj.taskSuccessRate === 'number' &&
         typeof obj.executionTime === 'number' &&
         typeof obj.tasksCompleted === 'number' &&
         typeof obj.tasksTotal === 'number');
}

export function isEfficiencyMetrics(obj: any): obj is EfficiencyMetrics {
  return obj &&
         typeof obj.executionTime === 'number' &&
         typeof obj.latencyPerStep === 'number' &&
         typeof obj.totalSteps === 'number' &&
         typeof obj.throughput === 'number';
}

export function isCostMetrics(obj: any): obj is CostMetrics {
  return obj &&
         typeof obj.totalTokens === 'number' &&
         typeof obj.estimatedCost === 'number' &&
         typeof obj.inputTokens === 'number' &&
         typeof obj.outputTokens === 'number';
}

export function isRobustnessMetrics(obj: any): obj is RobustnessMetrics {
  return obj &&
         typeof obj.toolCallErrorRate === 'number' &&
         typeof obj.recoveryRate === 'number' &&
         obj.errorCounts && typeof obj.errorCounts.total === 'number';
}

export function isQualityMetrics(obj: any): obj is QualityMetrics {
  return obj &&
         typeof obj.toolSelectionAccuracy === 'number' &&
         typeof obj.parameterAccuracy === 'number' &&
         typeof obj.decisionQuality === 'number';
}

export function validateMetrics(metrics: Partial<ComprehensiveMetrics>): MetricValidationError[] {
  const errors: MetricValidationError[] = [];

  if (metrics.performance) {
    if (metrics.performance.taskSuccessRate < 0 || metrics.performance.taskSuccessRate > 1) {
      errors.push({
        field: 'performance.taskSuccessRate',
        value: metrics.performance.taskSuccessRate,
        expected: '0-1 decimal',
        actual: String(metrics.performance.taskSuccessRate),
        severity: 'error'
      });
    }
  }

  if (metrics.efficiency) {
    if (metrics.efficiency.executionTime < 0) {
      errors.push({
        field: 'efficiency.executionTime',
        value: metrics.efficiency.executionTime,
        expected: 'positive number',
        actual: String(metrics.efficiency.executionTime),
        severity: 'error'
      });
    }
  }

  if (metrics.cost) {
    if (metrics.cost.estimatedCost < 0) {
      errors.push({
        field: 'cost.estimatedCost',
        value: metrics.cost.estimatedCost,
        expected: 'positive number',
        actual: String(metrics.cost.estimatedCost),
        severity: 'error'
      });
    }
  }

  return errors;
}