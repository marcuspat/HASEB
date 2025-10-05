/**
 * Metrics Collection System - Main Export
 * Provides unified access to all metrics collection components
 */

export { BaseMetricCollector } from './BaseMetricCollector';
export { PerformanceMetricsCollector } from './PerformanceMetricsCollector';
export { EfficiencyMetricsCollector } from './EfficiencyMetricsCollector';
export { CostMetricsCollector } from './CostMetricsCollector';
export { RobustnessMetricsCollector } from './RobustnessMetricsCollector';
export { QualityMetricsCollector } from './QualityMetricsCollector';
export { MetricsOrchestrator } from './MetricsOrchestrator';

// Re-export types for convenience
export type {
  BaseMetrics,
  PerformanceMetrics,
  EfficiencyMetrics,
  CostMetrics,
  RobustnessMetrics,
  QualityMetrics,
  ComprehensiveMetrics,
  MetricsCollectionContext,
  MetricCollectorConfig,
  MetricValidationError,
  MetricsAggregation,
  MetricsExportOptions,
  RealTimeMetricsUpdate,
} from '../../types/metrics';