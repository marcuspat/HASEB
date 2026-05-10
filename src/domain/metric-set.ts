/**
 * MetricSet aggregate — typed shape.
 *
 * See docs/ddd/aggregates.md (#5) and docs/ddd/value-objects.md.
 *
 * The MetricSet aggregate owns the five Metric Dimensions for a single
 * Evaluation, plus the composite Process Viability Score. This file defines
 * the type-level shape; the persistence mapper and repository implementation
 * are tracked under the implementation backlog.
 */

import type { EvaluationId, MetricSetId } from './contracts';

export type MetricSetState = 'open' | 'finalised' | 'superseded';

export interface Money {
  readonly amount: number;
  readonly currency: 'USD';
}

export interface Duration {
  readonly milliseconds: number;
}

export interface TokenCount {
  readonly input: number;
  readonly output: number;
}

export interface Percentage {
  readonly value: number; // [0.0, 1.0]
}

// --- Per-dimension value objects --------------------------------------------

export interface PerformanceMetric {
  readonly dimension: 'performance';
  readonly taskSuccessRate: Percentage;
  readonly partialCredit: Percentage;
  readonly tasksAttempted: number;
  readonly tasksPassed: number;
}

export interface EfficiencyMetric {
  readonly dimension: 'efficiency';
  readonly executionTime: Duration;
  readonly latencyPerStep: Duration;
  readonly totalSteps: number;
}

export interface CostMetric {
  readonly dimension: 'cost';
  readonly tokens: TokenCount;
  readonly estimatedCost: Money;
}

export interface RobustnessMetric {
  readonly dimension: 'robustness';
  readonly toolCallErrorRate: Percentage;
  readonly recoveryRate: Percentage;
  readonly retries: number;
}

export interface QualityMetric {
  readonly dimension: 'quality';
  readonly toolSelectionAccuracy: Percentage;
  readonly parameterAccuracy: Percentage;
}

export type MetricDimension =
  | PerformanceMetric
  | EfficiencyMetric
  | CostMetric
  | RobustnessMetric
  | QualityMetric;

// --- Composite score --------------------------------------------------------

export interface ViabilityWeights {
  readonly performance: number;
  readonly efficiency: number;
  readonly cost: number;
  readonly robustness: number;
  readonly quality: number;
}

export interface ProcessViabilityScore {
  readonly value: Percentage;
  readonly weights: ViabilityWeights;
  readonly version: string;
}

// --- Aggregate root ---------------------------------------------------------

export interface MetricSet {
  readonly id: MetricSetId;
  readonly evaluationId: EvaluationId;
  readonly state: MetricSetState;
  readonly dimensions: readonly MetricDimension[];
  readonly viabilityScore: ProcessViabilityScore | null;
  readonly replacesMetricSetId: MetricSetId | null;
  readonly createdAt: string;
  readonly finalisedAt: string | null;
}

// --- Construction helpers ---------------------------------------------------

export function createPercentage(value: number): Percentage {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(
      `Percentage must be in [0, 1] (got ${value}).`,
    );
  }
  return { value };
}

export function createDuration(milliseconds: number): Duration {
  if (
    !Number.isInteger(milliseconds) ||
    milliseconds < 0
  ) {
    throw new RangeError(
      `Duration milliseconds must be a non-negative integer (got ${milliseconds}).`,
    );
  }
  return { milliseconds };
}

export function createTokenCount(
  input: number,
  output: number,
): TokenCount {
  if (
    !Number.isInteger(input) ||
    input < 0 ||
    !Number.isInteger(output) ||
    output < 0
  ) {
    throw new RangeError(
      `TokenCount input/output must be non-negative integers.`,
    );
  }
  return { input, output };
}

export function createMoney(amount: number): Money {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(
      `Money amount must be a non-negative finite number (got ${amount}).`,
    );
  }
  // round to 6 decimal places
  const rounded = Math.round(amount * 1_000_000) / 1_000_000;
  return { amount: rounded, currency: 'USD' };
}

export const DEFAULT_VIABILITY_WEIGHTS: ViabilityWeights = {
  performance: 0.35,
  efficiency: 0.15,
  cost: 0.15,
  robustness: 0.15,
  quality: 0.2,
};

export const DEFAULT_VIABILITY_WEIGHTS_VERSION = '1.0.0';
