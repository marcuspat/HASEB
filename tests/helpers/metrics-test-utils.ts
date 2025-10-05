import { MetricsCollectionContext, ComprehensiveMetrics, PerformanceMetrics, EfficiencyMetrics, CostMetrics, RobustnessMetrics, QualityMetrics } from '@/types/metrics';

/**
 * Test utilities for metrics collection system
 */

export function createTestContext(overrides: Partial<MetricsCollectionContext> = {}): MetricsCollectionContext {
  return {
    evaluationId: 'test-eval-123',
    agentId: 'test-agent-456',
    benchmarkId: 'test-benchmark-789',
    sessionId: 'test-session-001',
    startTime: new Date(),
    configuration: { timeout: 30000 },
    environment: {
      platform: 'linux',
      version: '18.0.0',
      resources: { cpu: '4 cores', memory: '8GB', storage: '100GB' }
    },
    ...overrides
  };
}

export function createMockPerformanceMetrics(overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
  const baseTime = new Date();
  return {
    timestamp: baseTime,
    evaluationId: 'test-eval-123',
    agentId: 'test-agent-456',
    benchmarkId: 'test-benchmark-789',
    sessionId: 'test-session-001',
    taskSuccessRate: 0.85,
    tasksCompleted: 17,
    tasksTotal: 20,
    passRate: 0.85,
    failRate: 0.15,
    completionValidation: { passed: 17, failed: 3, skipped: 0 },
    resultAccuracy: 0.92,
    benchmarkCompletionRate: 0.85,
    ...overrides
  };
}

export function createMockEfficiencyMetrics(overrides: Partial<EfficiencyMetrics> = {}): EfficiencyMetrics {
  const baseTime = new Date();
  return {
    timestamp: baseTime,
    evaluationId: 'test-eval-123',
    agentId: 'test-agent-456',
    benchmarkId: 'test-benchmark-789',
    sessionId: 'test-session-001',
    executionTime: 2500,
    latencyPerStep: 125,
    totalSteps: 20,
    averageStepDuration: 125,
    peakMemoryUsage: 512,
    averageMemoryUsage: 256,
    cpuUtilization: 0.65,
    throughput: 8,
    responseTime: { min: 50, max: 300, average: 150, p50: 140, p95: 250, p99: 290 },
    ...overrides
  };
}

export function createMockCostMetrics(overrides: Partial<CostMetrics> = {}): CostMetrics {
  const baseTime = new Date();
  return {
    timestamp: baseTime,
    evaluationId: 'test-eval-123',
    agentId: 'test-agent-456',
    benchmarkId: 'test-benchmark-789',
    sessionId: 'test-session-001',
    totalTokens: 5000,
    inputTokens: 3000,
    outputTokens: 2000,
    estimatedCost: 0.15,
    tokenCosts: { input: 0.09, output: 0.12, total: 0.21 },
    apiCosts: {
      openai: { calls: 10, cost: 0.15, tokens: 5000 },
      anthropic: { calls: 5, cost: 0.08, tokens: 2000 }
    },
    resourceCosts: { compute: 0.05, storage: 0.02, network: 0.01, total: 0.08 },
    costPerTask: 0.0075,
    costOptimization: { potential: 0.02, achieved: 0.015, efficiency: 0.75 },
    ...overrides
  };
}

export function createMockRobustnessMetrics(overrides: Partial<RobustnessMetrics> = {}): RobustnessMetrics {
  const baseTime = new Date();
  return {
    timestamp: baseTime,
    evaluationId: 'test-eval-123',
    agentId: 'test-agent-456',
    benchmarkId: 'test-benchmark-789',
    sessionId: 'test-session-001',
    toolCallErrorRate: 0.05,
    recoveryRate: 0.92,
    errorCounts: { total: 3, fatal: 0, recoverable: 2, transient: 1 },
    errorPatterns: {
      timeout: { count: 1, recoveryTime: 5000, recoveryAttempts: 2, successRate: 1.0 },
      api_failure: { count: 2, recoveryTime: 3000, recoveryAttempts: 1, successRate: 0.5 }
    },
    failureModes: { timeout: 1, resourceExhaustion: 0, apiFailure: 2, logicError: 0, unexpectedInput: 0 },
    resilience: {
      averageRecoveryTime: 3500,
      maxDowntime: 1000,
      availability: 0.98,
      meanTimeBetweenFailures: 8000
    },
    ...overrides
  };
}

export function createMockQualityMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  const baseTime = new Date();
  return {
    timestamp: baseTime,
    evaluationId: 'test-eval-123',
    agentId: 'test-agent-456',
    benchmarkId: 'test-benchmark-789',
    sessionId: 'test-session-001',
    toolSelectionAccuracy: 0.95,
    parameterAccuracy: 0.88,
    decisionQuality: 0.92,
    outputQuality: 0.90,
    toolUsage: {
      api_client: { uses: 15, successRate: 0.93, averageExecutionTime: 120, errors: 1 },
      database: { uses: 8, successRate: 1.0, averageExecutionTime: 50, errors: 0 },
      filesystem: { uses: 5, successRate: 0.8, averageExecutionTime: 200, errors: 1 }
    },
    parameterValidation: { correct: 44, incorrect: 4, missing: 1, invalid: 1 },
    decisionTracking: { total: 10, optimal: 7, suboptimal: 2, incorrect: 1 },
    outputScoring: { relevance: 0.92, completeness: 0.88, correctness: 0.91, clarity: 0.89 },
    ...overrides
  };
}

export function createMockComprehensiveMetrics(overrides: Partial<ComprehensiveMetrics> = {}): ComprehensiveMetrics {
  const baseTime = new Date();
  return {
    performance: createMockPerformanceMetrics({ timestamp: baseTime }),
    efficiency: createMockEfficiencyMetrics({ timestamp: baseTime }),
    cost: createMockCostMetrics({ timestamp: baseTime }),
    robustness: createMockRobustnessMetrics({ timestamp: baseTime }),
    quality: createMockQualityMetrics({ timestamp: baseTime }),
    aggregated: {
      overallScore: 0.87,
      rank: 5,
      percentile: 75,
      trend: 'improving' as const,
      confidence: 0.92
    },
    ...overrides
  };
}

export function createTestMetricsConfig() {
  return {
    collectionInterval: 100,
    batchSize: 10,
    retryAttempts: 3,
    retryDelay: 50,
    enableRealTime: true,
    storage: { persistImmediately: false, compressionEnabled: false, retentionDays: 30 },
    validation: { strictMode: true, outlierDetection: false, qualityThreshold: 0.8 },
    collectors: {
      performance: { enabled: true },
      efficiency: { enabled: true },
      cost: { enabled: true },
      robustness: { enabled: true },
      quality: { enabled: true }
    }
  };
}

export function createTestOrchestratorConfig() {
  return {
    collectionInterval: 100,
    batchSize: 10,
    retryAttempts: 3,
    retryDelay: 50,
    enableRealTime: true,
    aggregationInterval: 500,
    storage: { persistImmediately: false, compressionEnabled: false, retentionDays: 30 },
    validation: { strictMode: true, outlierDetection: false, qualityThreshold: 0.8 },
    collectors: {
      performance: { enabled: true },
      efficiency: { enabled: true },
      cost: { enabled: true },
      robustness: { enabled: true },
      quality: { enabled: true }
    }
  };
}

/**
 * Utility functions for testing metrics validation
 */
export function validatePerformanceMetrics(metrics: PerformanceMetrics): string[] {
  const errors: string[] = [];

  if (metrics.taskSuccessRate < 0 || metrics.taskSuccessRate > 1) {
    errors.push(`Invalid taskSuccessRate: ${metrics.taskSuccessRate}`);
  }
  if (metrics.tasksCompleted < 0 || metrics.tasksCompleted > metrics.tasksTotal) {
    errors.push(`Invalid tasksCompleted: ${metrics.tasksCompleted}`);
  }
  if (metrics.tasksTotal < 0) {
    errors.push(`Invalid tasksTotal: ${metrics.tasksTotal}`);
  }
  if (metrics.resultAccuracy < 0 || metrics.resultAccuracy > 1) {
    errors.push(`Invalid resultAccuracy: ${metrics.resultAccuracy}`);
  }
  if (metrics.benchmarkCompletionRate < 0 || metrics.benchmarkCompletionRate > 1) {
    errors.push(`Invalid benchmarkCompletionRate: ${metrics.benchmarkCompletionRate}`);
  }

  return errors;
}

export function validateEfficiencyMetrics(metrics: EfficiencyMetrics): string[] {
  const errors: string[] = [];

  if (metrics.executionTime < 0) {
    errors.push(`Invalid executionTime: ${metrics.executionTime}`);
  }
  if (metrics.latencyPerStep < 0) {
    errors.push(`Invalid latencyPerStep: ${metrics.latencyPerStep}`);
  }
  if (metrics.totalSteps < 0) {
    errors.push(`Invalid totalSteps: ${metrics.totalSteps}`);
  }
  if (metrics.averageStepDuration < 0) {
    errors.push(`Invalid averageStepDuration: ${metrics.averageStepDuration}`);
  }
  if (metrics.peakMemoryUsage < 0) {
    errors.push(`Invalid peakMemoryUsage: ${metrics.peakMemoryUsage}`);
  }
  if (metrics.cpuUtilization < 0 || metrics.cpuUtilization > 1) {
    errors.push(`Invalid cpuUtilization: ${metrics.cpuUtilization}`);
  }
  if (metrics.throughput < 0) {
    errors.push(`Invalid throughput: ${metrics.throughput}`);
  }

  return errors;
}

export function validateCostMetrics(metrics: CostMetrics): string[] {
  const errors: string[] = [];

  if (metrics.totalTokens < 0) {
    errors.push(`Invalid totalTokens: ${metrics.totalTokens}`);
  }
  if (metrics.inputTokens < 0 || metrics.outputTokens < 0) {
    errors.push(`Invalid token counts: input=${metrics.inputTokens}, output=${metrics.outputTokens}`);
  }
  if (metrics.totalTokens !== metrics.inputTokens + metrics.outputTokens) {
    errors.push(`Token count mismatch: total=${metrics.totalTokens}, input+output=${metrics.inputTokens + metrics.outputTokens}`);
  }
  if (metrics.estimatedCost < 0) {
    errors.push(`Invalid estimatedCost: ${metrics.estimatedCost}`);
  }

  return errors;
}

export function validateRobustnessMetrics(metrics: RobustnessMetrics): string[] {
  const errors: string[] = [];

  if (metrics.toolCallErrorRate < 0 || metrics.toolCallErrorRate > 1) {
    errors.push(`Invalid toolCallErrorRate: ${metrics.toolCallErrorRate}`);
  }
  if (metrics.recoveryRate < 0 || metrics.recoveryRate > 1) {
    errors.push(`Invalid recoveryRate: ${metrics.recoveryRate}`);
  }
  if (metrics.errorCounts.total < 0) {
    errors.push(`Invalid errorCounts.total: ${metrics.errorCounts.total}`);
  }
  if (metrics.availability < 0 || metrics.availability > 1) {
    errors.push(`Invalid availability: ${metrics.availability}`);
  }

  return errors;
}

export function validateQualityMetrics(metrics: QualityMetrics): string[] {
  const errors: string[] = [];

  if (metrics.toolSelectionAccuracy < 0 || metrics.toolSelectionAccuracy > 1) {
    errors.push(`Invalid toolSelectionAccuracy: ${metrics.toolSelectionAccuracy}`);
  }
  if (metrics.parameterAccuracy < 0 || metrics.parameterAccuracy > 1) {
    errors.push(`Invalid parameterAccuracy: ${metrics.parameterAccuracy}`);
  }
  if (metrics.decisionQuality < 0 || metrics.decisionQuality > 1) {
    errors.push(`Invalid decisionQuality: ${metrics.decisionQuality}`);
  }
  if (metrics.outputQuality < 0 || metrics.outputQuality > 1) {
    errors.push(`Invalid outputQuality: ${metrics.outputQuality}`);
  }

  return errors;
}

export function validateComprehensiveMetrics(metrics: ComprehensiveMetrics): string[] {
  const errors: string[] = [];

  if (metrics.performance) {
    errors.push(...validatePerformanceMetrics(metrics.performance));
  }
  if (metrics.efficiency) {
    errors.push(...validateEfficiencyMetrics(metrics.efficiency));
  }
  if (metrics.cost) {
    errors.push(...validateCostMetrics(metrics.cost));
  }
  if (metrics.robustness) {
    errors.push(...validateRobustnessMetrics(metrics.robustness));
  }
  if (metrics.quality) {
    errors.push(...validateQualityMetrics(metrics.quality));
  }

  if (metrics.aggregated) {
    if (metrics.aggregated.overallScore < 0 || metrics.aggregated.overallScore > 1) {
      errors.push(`Invalid overallScore: ${metrics.aggregated.overallScore}`);
    }
    if (metrics.aggregated.percentile < 0 || metrics.aggregated.percentile > 100) {
      errors.push(`Invalid percentile: ${metrics.aggregated.percentile}`);
    }
    if (metrics.aggregated.confidence < 0 || metrics.aggregated.confidence > 1) {
      errors.push(`Invalid confidence: ${metrics.aggregated.confidence}`);
    }
  }

  return errors;
}

/**
 * Performance testing utilities
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();
  return { result, duration: endTime - startTime };
}

export function generateLargeMetricsDataset(count: number = 1000): ComprehensiveMetrics[] {
  return Array.from({ length: count }, (_, index) => {
    const baseTime = new Date(Date.now() - (count - index) * 60000); // 1 minute intervals
    return createMockComprehensiveMetrics({
      performance: createMockPerformanceMetrics({
        timestamp: baseTime,
        taskSuccessRate: 0.7 + Math.random() * 0.3,
        tasksCompleted: Math.floor(Math.random() * 50),
        tasksTotal: 50
      }),
      efficiency: createMockEfficiencyMetrics({
        timestamp: baseTime,
        executionTime: 1000 + Math.random() * 5000,
        totalSteps: Math.floor(Math.random() * 30) + 5
      }),
      cost: createMockCostMetrics({
        timestamp: baseTime,
        totalTokens: Math.floor(Math.random() * 10000) + 1000,
        estimatedCost: Math.random() * 0.5 + 0.01
      }),
      robustness: createMockRobustnessMetrics({
        timestamp: baseTime,
        toolCallErrorRate: Math.random() * 0.2,
        recoveryRate: 0.8 + Math.random() * 0.2
      }),
      quality: createMockQualityMetrics({
        timestamp: baseTime,
        toolSelectionAccuracy: 0.8 + Math.random() * 0.2,
        parameterAccuracy: 0.7 + Math.random() * 0.3
      })
    });
  });
}

/**
 * Mock data generators for specific test scenarios
 */
export function createHighPerformanceMetrics(): ComprehensiveMetrics {
  return createMockComprehensiveMetrics({
    performance: createMockPerformanceMetrics({
      taskSuccessRate: 0.98,
      tasksCompleted: 49,
      tasksTotal: 50,
      resultAccuracy: 0.99
    }),
    efficiency: createMockEfficiencyMetrics({
      executionTime: 1500,
      latencyPerStep: 75,
      totalSteps: 20
    }),
    robustness: createMockRobustnessMetrics({
      toolCallErrorRate: 0.01,
      recoveryRate: 0.99
    }),
    quality: createMockQualityMetrics({
      toolSelectionAccuracy: 0.98,
      parameterAccuracy: 0.96
    }),
    aggregated: {
      overallScore: 0.97,
      rank: 1,
      percentile: 99,
      trend: 'improving',
      confidence: 0.98
    }
  });
}

export function createLowPerformanceMetrics(): ComprehensiveMetrics {
  return createMockComprehensiveMetrics({
    performance: createMockPerformanceMetrics({
      taskSuccessRate: 0.35,
      tasksCompleted: 17,
      tasksTotal: 50,
      resultAccuracy: 0.42
    }),
    efficiency: createMockEfficiencyMetrics({
      executionTime: 15000,
      latencyPerStep: 750,
      totalSteps: 20
    }),
    robustness: createMockRobustnessMetrics({
      toolCallErrorRate: 0.35,
      recoveryRate: 0.45
    }),
    quality: createMockQualityMetrics({
      toolSelectionAccuracy: 0.45,
      parameterAccuracy: 0.38
    }),
    aggregated: {
      overallScore: 0.32,
      rank: 25,
      percentile: 15,
      trend: 'declining',
      confidence: 0.72
    }
  });
}

export function createErrorProneMetrics(): ComprehensiveMetrics {
  return createMockComprehensiveMetrics({
    robustness: createMockRobustnessMetrics({
      toolCallErrorRate: 0.45,
      recoveryRate: 0.25,
      errorCounts: { total: 15, fatal: 3, recoverable: 8, transient: 4 },
      errorPatterns: {
        timeout: { count: 8, recoveryTime: 10000, recoveryAttempts: 5, successRate: 0.25 },
        api_failure: { count: 7, recoveryTime: 5000, recoveryAttempts: 3, successRate: 0.43 }
      },
      failureModes: { timeout: 8, resourceExhaustion: 3, apiFailure: 7, logicError: 2, unexpectedInput: 1 },
      resilience: {
        averageRecoveryTime: 7500,
        maxDowntime: 15000,
        availability: 0.65,
        meanTimeBetweenFailures: 2000
      }
    })
  });
}

/**
 * Test assertion helpers
 */
export function expectValidMetrics(metrics: ComprehensiveMetrics): void {
  const errors = validateComprehensiveMetrics(metrics);
  expect(errors).toHaveLength(0);
}

export function expectMetricsInRange(value: number, min: number, max: number, tolerance: number = 0.001): void {
  expect(value).toBeGreaterThanOrEqual(min - tolerance);
  expect(value).toBeLessThanOrEqual(max + tolerance);
}

export function expectPerformanceImprovement(
  before: PerformanceMetrics,
  after: PerformanceMetrics,
  metric: keyof PerformanceMetrics
): void {
  const beforeValue = before[metric] as number;
  const afterValue = after[metric] as number;

  // For success rates and accuracy, higher is better
  if (metric.includes('Rate') || metric.includes('Accuracy')) {
    expect(afterValue).toBeGreaterThanOrEqual(beforeValue);
  }
  // For time and error rates, lower is better
  else if (metric.includes('Time') || metric.includes('Error')) {
    expect(afterValue).toBeLessThanOrEqual(beforeValue);
  }
}

/**
 * Database mock helpers
 */
export function createMockDatabaseRow(data: any) {
  return {
    id: 'test-row-id',
    created_at: new Date(),
    updated_at: new Date(),
    ...data
  };
}

export function createMockEvaluationDatabaseRow(overrides: any = {}) {
  return createMockDatabaseRow({
    evaluation_id: 'test-eval-123',
    agent_id: 'test-agent-456',
    benchmark_id: 'test-benchmark-789',
    status: 'completed',
    configuration: { timeout: 30000 },
    logs: JSON.stringify(['Evaluation completed']),
    metrics: JSON.stringify(createMockComprehensiveMetrics()),
    start_time: new Date(Date.now() - 60000),
    end_time: new Date(),
    ...overrides
  });
}