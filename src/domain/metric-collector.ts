/**
 * Canonical `MetricCollector` contract — domain port.
 *
 * The DDD docs (docs/ddd/contexts/metrics-context.md) describe each metric
 * collector as a small, pure function from an `EvaluationRun` to one typed
 * `MetricDimension`. The pre-existing concrete collectors under
 * `src/services/metrics/` predate this contract: they expose a different
 * `start()` / `gatherMetrics()` lifecycle. This file:
 *
 *   1. Declares the canonical contract.
 *   2. Provides a `LegacyMetricCollectorAdapter` that wraps any object with
 *      a `gatherMetrics(eventData?)` method and exposes `collect(run)`.
 *
 * The adapter is duck-typed for the same reason every iteration of this
 * mission has used adapters: the legacy implementations sit in the
 * pre-existing tsc error pile, so the new domain code must not import
 * them directly.
 *
 * Once individual concrete collectors are migrated to implement
 * `MetricCollector<T>` natively, the adapter can be removed.
 */

import type { MetricDimension } from './metric-set';

/** Minimal run shape consumed by a collector. Mirrors the DDD aggregate. */
export interface EvaluationRunSummary {
  readonly evaluationId: string;
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcome: 'success' | 'failure';
  readonly steps?: readonly RunStepSummary[];
  /** Optional bag for legacy collectors that read context off the run. */
  readonly context?: Record<string, unknown>;
}

export interface RunStepSummary {
  readonly stepIndex: number;
  readonly recordedAt: string;
  readonly kind: 'tool_call' | 'llm_call' | 'screen_action' | 'other';
  readonly status: 'ok' | 'error';
  readonly summary?: string;
  readonly latencyMs?: number;
  readonly tokensInput?: number;
  readonly tokensOutput?: number;
  readonly costUsd?: number;
  readonly toolSelectionCorrect?: boolean;
  readonly parameterCorrect?: boolean;
}

export class CollectorError extends Error {
  constructor(
    public readonly dimension: MetricDimension['dimension'],
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${dimension}] ${message}`);
    this.name = 'CollectorError';
  }
}

/** The canonical contract. Implementations must be pure with respect to `run`. */
export interface MetricCollector<TDimension extends MetricDimension> {
  readonly dimension: TDimension['dimension'];
  collect(run: EvaluationRunSummary): Promise<TDimension>;
}

// --- Legacy adapter ---------------------------------------------------------

export interface LegacyCollectorPort<TDimension extends MetricDimension> {
  /**
   * Produces a partial dimension payload from an event blob. The shape is
   * whatever the legacy collector emits; the `toDimension` mapper in the
   * adapter normalises it to a fully-typed `MetricDimension`.
   */
  gatherMetrics(eventData?: unknown): Promise<unknown> | unknown;
}

export interface LegacyAdapterOptions<TDimension extends MetricDimension> {
  /** Dimension discriminator — must match `TDimension['dimension']`. */
  readonly dimension: TDimension['dimension'];
  /**
   * Maps the legacy collector's output to a typed `MetricDimension`.
   * Allowed to throw a `CollectorError`; any other thrown error is
   * wrapped by the adapter.
   */
  readonly toDimension: (raw: unknown, run: EvaluationRunSummary) => TDimension;
}

export class LegacyMetricCollectorAdapter<TDimension extends MetricDimension>
  implements MetricCollector<TDimension>
{
  readonly dimension: TDimension['dimension'];
  private readonly legacy: LegacyCollectorPort<TDimension>;
  private readonly toDimension: LegacyAdapterOptions<TDimension>['toDimension'];

  constructor(
    legacy: LegacyCollectorPort<TDimension>,
    options: LegacyAdapterOptions<TDimension>,
  ) {
    this.legacy = legacy;
    this.dimension = options.dimension;
    this.toDimension = options.toDimension;
  }

  async collect(run: EvaluationRunSummary): Promise<TDimension> {
    let raw: unknown;
    try {
      raw = await this.legacy.gatherMetrics(run);
    } catch (err) {
      throw new CollectorError(
        this.dimension,
        'legacy gatherMetrics threw',
        err,
      );
    }
    if (raw === null || raw === undefined) {
      throw new CollectorError(
        this.dimension,
        'legacy gatherMetrics returned null/undefined',
      );
    }
    try {
      const out = this.toDimension(raw, run);
      if (out.dimension !== this.dimension) {
        throw new CollectorError(
          this.dimension,
          `toDimension produced dimension=${out.dimension}, expected ${this.dimension}`,
        );
      }
      return out;
    } catch (err) {
      if (err instanceof CollectorError) throw err;
      throw new CollectorError(
        this.dimension,
        'toDimension threw',
        err,
      );
    }
  }
}

// --- Composite ---------------------------------------------------------------

/**
 * Composes one collector per dimension and produces all five in parallel.
 * The Metrics context's application service will use this to build a
 * MetricSet from a run.
 */
export interface MetricCollectorSet {
  readonly performance: MetricCollector<
    Extract<MetricDimension, { dimension: 'performance' }>
  >;
  readonly efficiency: MetricCollector<
    Extract<MetricDimension, { dimension: 'efficiency' }>
  >;
  readonly cost: MetricCollector<
    Extract<MetricDimension, { dimension: 'cost' }>
  >;
  readonly robustness: MetricCollector<
    Extract<MetricDimension, { dimension: 'robustness' }>
  >;
  readonly quality: MetricCollector<
    Extract<MetricDimension, { dimension: 'quality' }>
  >;
}

export async function collectAllDimensions(
  set: MetricCollectorSet,
  run: EvaluationRunSummary,
): Promise<readonly MetricDimension[]> {
  const results = await Promise.all([
    set.performance.collect(run),
    set.efficiency.collect(run),
    set.cost.collect(run),
    set.robustness.collect(run),
    set.quality.collect(run),
  ]);
  return results;
}
