/**
 * Native MetricCollector implementations — one per dimension.
 *
 * These are pure functions over `EvaluationRunSummary` and implement the
 * canonical `MetricCollector<T>` contract from `src/domain/metric-collector.ts`.
 * They replace the need for `LegacyMetricCollectorAdapter` for runs that
 * carry rich step-level data.
 *
 * Inputs:
 *   `EvaluationRunSummary` — typed run trace with optional per-step
 *   `latencyMs`, `tokensInput`, `tokensOutput`, `costUsd`,
 *   `toolSelectionCorrect`, `parameterCorrect`. Missing fields are
 *   tolerated (counted as unobserved) so collectors degrade gracefully
 *   on partial runs.
 *
 * Construction:
 *   Each collector takes a small typed config object with the inputs that
 *   cannot be derived from steps alone (e.g. `tasksAttempted` for the
 *   performance dimension). Construction validates the config and throws
 *   on shape errors; runtime `collect()` is pure thereafter.
 */

import type {
  EvaluationRunSummary,
  MetricCollector,
  MetricCollectorSet,
  RunStepSummary,
} from '../metric-collector';
import {
  type CostMetric,
  type EfficiencyMetric,
  type PerformanceMetric,
  type QualityMetric,
  type RobustnessMetric,
  createDuration,
  createMoney,
  createPercentage,
  createTokenCount,
} from '../metric-set';

// --- Helpers ----------------------------------------------------------------

function ratio(numer: number, denom: number): number {
  if (denom <= 0) return 0;
  const v = numer / denom;
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function sumStep<TKey extends keyof RunStepSummary>(
  steps: readonly RunStepSummary[] | undefined,
  key: TKey,
): number {
  if (!steps) return 0;
  let total = 0;
  for (const step of steps) {
    const v = step[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

function countSteps(
  steps: readonly RunStepSummary[] | undefined,
  predicate: (step: RunStepSummary) => boolean,
): number {
  if (!steps) return 0;
  let n = 0;
  for (const step of steps) if (predicate(step)) n += 1;
  return n;
}

function durationMsBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

// --- Performance ------------------------------------------------------------

export interface PerformanceCollectorConfig {
  /**
   * Total tasks the agent attempted in this run. If the run is a
   * single-task run, set to 1; the collector computes
   * `tasksPassed = outcome === 'success' ? 1 : 0`.
   */
  readonly tasksAttempted: number;
  /**
   * Override `tasksPassed` if the upstream harness already knows how many
   * tasks passed. When omitted, the collector derives it from `outcome`
   * (success → tasksAttempted, failure → 0).
   */
  readonly tasksPassed?: number;
  /**
   * Optional partial credit in [0, 1]. Defaults to 0 (no partial credit).
   */
  readonly partialCredit?: number;
}

export class PerformanceCollector
  implements MetricCollector<PerformanceMetric>
{
  readonly dimension = 'performance' as const;

  constructor(private readonly config: PerformanceCollectorConfig) {
    if (!Number.isInteger(config.tasksAttempted) || config.tasksAttempted < 0) {
      throw new RangeError(
        `PerformanceCollectorConfig.tasksAttempted must be a non-negative integer (got ${config.tasksAttempted}).`,
      );
    }
    if (config.tasksPassed !== undefined) {
      if (
        !Number.isInteger(config.tasksPassed) ||
        config.tasksPassed < 0 ||
        config.tasksPassed > config.tasksAttempted
      ) {
        throw new RangeError(
          `PerformanceCollectorConfig.tasksPassed must be a non-negative integer ≤ tasksAttempted.`,
        );
      }
    }
    if (config.partialCredit !== undefined) {
      if (
        !Number.isFinite(config.partialCredit) ||
        config.partialCredit < 0 ||
        config.partialCredit > 1
      ) {
        throw new RangeError(
          `PerformanceCollectorConfig.partialCredit must be in [0, 1].`,
        );
      }
    }
  }

  async collect(run: EvaluationRunSummary): Promise<PerformanceMetric> {
    const attempted = this.config.tasksAttempted;
    const passed =
      this.config.tasksPassed ??
      (run.outcome === 'success' ? attempted : 0);
    return {
      dimension: 'performance',
      taskSuccessRate: createPercentage(ratio(passed, attempted)),
      partialCredit: createPercentage(this.config.partialCredit ?? 0),
      tasksAttempted: attempted,
      tasksPassed: passed,
    };
  }
}

// --- Efficiency -------------------------------------------------------------

export class EfficiencyCollector
  implements MetricCollector<EfficiencyMetric>
{
  readonly dimension = 'efficiency' as const;

  async collect(run: EvaluationRunSummary): Promise<EfficiencyMetric> {
    const totalSteps = run.steps?.length ?? 0;
    const executionMs = durationMsBetween(run.startedAt, run.completedAt);

    let latencyMs = 0;
    if (totalSteps > 0) {
      const summed = sumStep(run.steps, 'latencyMs');
      if (summed > 0) {
        latencyMs = Math.round(summed / totalSteps);
      } else if (executionMs > 0) {
        latencyMs = Math.round(executionMs / totalSteps);
      }
    }

    return {
      dimension: 'efficiency',
      executionTime: createDuration(executionMs),
      latencyPerStep: createDuration(latencyMs),
      totalSteps,
    };
  }
}

// --- Cost -------------------------------------------------------------------

export class CostCollector implements MetricCollector<CostMetric> {
  readonly dimension = 'cost' as const;

  async collect(run: EvaluationRunSummary): Promise<CostMetric> {
    const input = sumStep(run.steps, 'tokensInput');
    const output = sumStep(run.steps, 'tokensOutput');
    const cost = sumStep(run.steps, 'costUsd');
    return {
      dimension: 'cost',
      tokens: createTokenCount(input, output),
      estimatedCost: createMoney(cost),
    };
  }
}

// --- Robustness -------------------------------------------------------------

export class RobustnessCollector
  implements MetricCollector<RobustnessMetric>
{
  readonly dimension = 'robustness' as const;

  async collect(run: EvaluationRunSummary): Promise<RobustnessMetric> {
    const steps = run.steps ?? [];
    const toolCalls = countSteps(steps, (s) => s.kind === 'tool_call');
    const toolErrors = countSteps(
      steps,
      (s) => s.kind === 'tool_call' && s.status === 'error',
    );

    // Recovery = a successful step that immediately follows a failed step.
    let recoveryPairs = 0;
    let failuresFollowed = 0;
    for (let i = 0; i < steps.length - 1; i++) {
      const cur = steps[i];
      const next = steps[i + 1];
      if (cur.status === 'error') {
        failuresFollowed += 1;
        if (next.status === 'ok') recoveryPairs += 1;
      }
    }

    const retries = countSteps(steps, (s) => s.status === 'error');

    return {
      dimension: 'robustness',
      toolCallErrorRate: createPercentage(ratio(toolErrors, toolCalls)),
      recoveryRate: createPercentage(ratio(recoveryPairs, failuresFollowed)),
      retries,
    };
  }
}

// --- Quality ----------------------------------------------------------------

export class QualityCollector implements MetricCollector<QualityMetric> {
  readonly dimension = 'quality' as const;

  async collect(run: EvaluationRunSummary): Promise<QualityMetric> {
    const toolCalls =
      run.steps?.filter((s) => s.kind === 'tool_call') ?? [];
    const judged = toolCalls.filter(
      (s) =>
        s.toolSelectionCorrect !== undefined ||
        s.parameterCorrect !== undefined,
    );

    if (judged.length === 0) {
      // Nothing to judge → neutral 0 score (caller decides how to weigh).
      return {
        dimension: 'quality',
        toolSelectionAccuracy: createPercentage(0),
        parameterAccuracy: createPercentage(0),
      };
    }

    const selectionDenom = judged.filter(
      (s) => s.toolSelectionCorrect !== undefined,
    ).length;
    const parameterDenom = judged.filter(
      (s) => s.parameterCorrect !== undefined,
    ).length;

    const selectionPassed = judged.filter(
      (s) => s.toolSelectionCorrect === true,
    ).length;
    const parameterPassed = judged.filter(
      (s) => s.parameterCorrect === true,
    ).length;

    return {
      dimension: 'quality',
      toolSelectionAccuracy: createPercentage(
        ratio(selectionPassed, selectionDenom),
      ),
      parameterAccuracy: createPercentage(
        ratio(parameterPassed, parameterDenom),
      ),
    };
  }
}

// --- Set construction -------------------------------------------------------

export interface NativeCollectorSetOptions {
  readonly performance: PerformanceCollectorConfig;
}

/**
 * Convenience constructor for the typical five-collector configuration.
 * The only required input is the performance config; the other four are
 * stateless.
 */
export function createNativeCollectorSet(
  options: NativeCollectorSetOptions,
): MetricCollectorSet {
  return {
    performance: new PerformanceCollector(options.performance),
    efficiency: new EfficiencyCollector(),
    cost: new CostCollector(),
    robustness: new RobustnessCollector(),
    quality: new QualityCollector(),
  };
}
