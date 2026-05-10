/**
 * ProcessViabilityCalculator — domain service.
 *
 * Composes the five Metric Dimensions into the Process Viability Score.
 * See docs/ddd/domain-services.md (#1) and docs/ddd/value-objects.md.
 *
 * Pure with respect to its inputs. No I/O, no clock, no logger.
 */

import {
  DEFAULT_VIABILITY_WEIGHTS,
  DEFAULT_VIABILITY_WEIGHTS_VERSION,
  type CostMetric,
  type EfficiencyMetric,
  type MetricDimension,
  type Percentage,
  type PerformanceMetric,
  type ProcessViabilityScore,
  type QualityMetric,
  type RobustnessMetric,
  type ViabilityWeights,
  createPercentage,
} from './metric-set';

const WEIGHT_SUM_EPSILON = 1e-6;

export class MissingDimensionError extends Error {
  constructor(public readonly dimension: MetricDimension['dimension']) {
    super(`Missing metric dimension: ${dimension}`);
    this.name = 'MissingDimensionError';
  }
}

export class InvalidWeightsError extends Error {
  constructor(public readonly weights: ViabilityWeights, total: number) {
    super(
      `Viability weights must sum to 1.0 within ${WEIGHT_SUM_EPSILON} (got ${total}).`,
    );
    this.name = 'InvalidWeightsError';
  }
}

/**
 * Optional reference points used to normalise unbounded raw measurements
 * (execution time, total tokens, USD spend) into a [0, 1] efficiency / cost
 * score. Operators tune these per-Benchmark; defaults below are conservative.
 */
export interface NormalisationConfig {
  readonly maxExecutionTimeMs: number;
  readonly maxLatencyPerStepMs: number;
  readonly maxStepsExpected: number;
  readonly maxCostUsd: number;
  readonly maxTokens: number;
}

export const DEFAULT_NORMALISATION: NormalisationConfig = {
  maxExecutionTimeMs: 30 * 60 * 1000,
  maxLatencyPerStepMs: 60 * 1000,
  maxStepsExpected: 200,
  maxCostUsd: 10,
  maxTokens: 1_000_000,
};

export interface CalculatorOptions {
  readonly weights?: ViabilityWeights;
  readonly weightsVersion?: string;
  readonly normalisation?: NormalisationConfig;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function findDimension<TName extends MetricDimension['dimension']>(
  dimensions: readonly MetricDimension[],
  name: TName,
): Extract<MetricDimension, { dimension: TName }> {
  const found = dimensions.find((d) => d.dimension === name) as
    | Extract<MetricDimension, { dimension: TName }>
    | undefined;
  if (!found) throw new MissingDimensionError(name);
  return found;
}

function performanceScore(p: PerformanceMetric): number {
  // Headline: success rate. Partial credit folded in at 25%.
  return clamp01(
    0.75 * p.taskSuccessRate.value + 0.25 * p.partialCredit.value,
  );
}

function efficiencyScore(e: EfficiencyMetric, n: NormalisationConfig): number {
  const timePenalty = clamp01(e.executionTime.milliseconds / n.maxExecutionTimeMs);
  const latencyPenalty = clamp01(
    e.latencyPerStep.milliseconds / n.maxLatencyPerStepMs,
  );
  const stepsPenalty = clamp01(e.totalSteps / n.maxStepsExpected);
  // Inverse: lower-is-better → score = 1 - weighted penalty.
  const penalty = 0.5 * timePenalty + 0.3 * latencyPenalty + 0.2 * stepsPenalty;
  return clamp01(1 - penalty);
}

function costScore(c: CostMetric, n: NormalisationConfig): number {
  const totalTokens = c.tokens.input + c.tokens.output;
  const tokenPenalty = clamp01(totalTokens / n.maxTokens);
  const usdPenalty = clamp01(c.estimatedCost.amount / n.maxCostUsd);
  // USD-weighted; tokens are a tiebreaker.
  return clamp01(1 - (0.7 * usdPenalty + 0.3 * tokenPenalty));
}

function robustnessScore(r: RobustnessMetric): number {
  // Reward low error rate and high recovery rate equally.
  return clamp01(
    0.5 * (1 - r.toolCallErrorRate.value) + 0.5 * r.recoveryRate.value,
  );
}

function qualityScore(q: QualityMetric): number {
  return clamp01(
    0.5 * q.toolSelectionAccuracy.value + 0.5 * q.parameterAccuracy.value,
  );
}

function validateWeights(weights: ViabilityWeights): void {
  const total =
    weights.performance +
    weights.efficiency +
    weights.cost +
    weights.robustness +
    weights.quality;
  if (Math.abs(total - 1) > WEIGHT_SUM_EPSILON) {
    throw new InvalidWeightsError(weights, total);
  }
  for (const [, w] of Object.entries(weights)) {
    if (!Number.isFinite(w) || w < 0) {
      throw new InvalidWeightsError(weights, total);
    }
  }
}

export interface ProcessViabilityCalculator {
  compute(
    dimensions: readonly MetricDimension[],
    weights?: ViabilityWeights,
  ): ProcessViabilityScore;
}

export class DefaultProcessViabilityCalculator
  implements ProcessViabilityCalculator
{
  private readonly weights: ViabilityWeights;
  private readonly weightsVersion: string;
  private readonly normalisation: NormalisationConfig;

  constructor(options: CalculatorOptions = {}) {
    this.weights = options.weights ?? DEFAULT_VIABILITY_WEIGHTS;
    this.weightsVersion =
      options.weightsVersion ?? DEFAULT_VIABILITY_WEIGHTS_VERSION;
    this.normalisation = options.normalisation ?? DEFAULT_NORMALISATION;
    validateWeights(this.weights);
  }

  compute(
    dimensions: readonly MetricDimension[],
    overrideWeights?: ViabilityWeights,
  ): ProcessViabilityScore {
    const weights = overrideWeights ?? this.weights;
    if (overrideWeights) validateWeights(overrideWeights);

    const performance = findDimension(dimensions, 'performance');
    const efficiency = findDimension(dimensions, 'efficiency');
    const cost = findDimension(dimensions, 'cost');
    const robustness = findDimension(dimensions, 'robustness');
    const quality = findDimension(dimensions, 'quality');

    const composite =
      weights.performance * performanceScore(performance) +
      weights.efficiency * efficiencyScore(efficiency, this.normalisation) +
      weights.cost * costScore(cost, this.normalisation) +
      weights.robustness * robustnessScore(robustness) +
      weights.quality * qualityScore(quality);

    const value: Percentage = createPercentage(clamp01(composite));
    return {
      value,
      weights,
      version: this.weightsVersion,
    };
  }
}

// Convenience export with defaults.
export const processViabilityCalculator: ProcessViabilityCalculator =
  new DefaultProcessViabilityCalculator();
