# Metrics Context

**Type:** Core subdomain.
**Position:** the translator from Evaluation Runs into the multi-dimensional
measurements that define HASEB's value proposition.

## Purpose

Take a completed Evaluation Run and produce a `MetricSet` containing one of
each Metric Dimension (Performance, Efficiency, Cost, Robustness, Quality)
and a composite **Process Viability Score**. The Metrics context owns the
*meaning* of each measurement.

## Ubiquitous Language (local)

- **Metric** — a single typed quantity attached to a Metric Dimension.
- **Metric Dimension** — one of the five families.
- **Metric Collector** — a component that owns a single dimension.
- **MetricSet** — the container of all five dimensions for one Evaluation.
- **Process Viability Score** — composite score across the five dimensions.

## Aggregates

### MetricSet (root)

Members:
- `MetricDimension[]` (one of each family)
- `ProcessViabilityScore` (1-to-1)

See [../aggregates.md](../aggregates.md#5-metricset-aggregate-core).

## Components

| Component                       | Source                                                  | Role                            |
|---------------------------------|---------------------------------------------------------|---------------------------------|
| `BaseMetricCollector`           | `src/services/metrics/BaseMetricCollector.ts`           | Abstract base                   |
| `PerformanceMetricsCollector`   | `src/services/metrics/PerformanceMetricsCollector.ts`   | Performance dimension           |
| `EfficiencyMetricsCollector`    | `src/services/metrics/EfficiencyMetricsCollector.ts`    | Efficiency dimension            |
| `CostMetricsCollector`          | `src/services/metrics/CostMetricsCollector.ts`          | Cost dimension                  |
| `RobustnessMetricsCollector`    | `src/services/metrics/RobustnessMetricsCollector.ts`    | Robustness dimension            |
| `QualityMetricsCollector`       | `src/services/metrics/QualityMetricsCollector.ts`       | Quality dimension               |
| `MetricsOrchestrator`           | `src/services/metrics/MetricsOrchestrator.ts`           | Composes all collectors         |
| `ProcessViabilityCalculator`    | (planned)                                               | Computes the composite score    |

## Collector Contract

```ts
interface MetricCollector<TDimension extends MetricDimension> {
  readonly dimension: TDimension['dimension'];
  collect(run: EvaluationRun): Promise<TDimension>;
}
```

- Pure with respect to its declared inputs.
- Idempotent: running it twice on the same run produces the same dimension.
- Errors are typed (`CollectorError` with a `dimension` discriminator).

## Use Cases

| Use case                       | Application service       | Trigger                                |
|--------------------------------|---------------------------|----------------------------------------|
| Collect dimensions for a run   | `CollectMetrics`          | event `evaluation.run.completed`       |
| Recompute metrics              | `RecomputeMetrics`        | manual / admin                         |

## Domain Events Emitted

- `metrics.dimension.collected` — once per dimension.
- `metrics.finalised` — once when all five dimensions are present.
- `metrics.superseded` — when a recomputed MetricSet replaces an earlier one.

## Repositories

- `IMetricSetRepository` (see [../repositories.md](../repositories.md)).

## Persistence Mapping

- Tables: `metric_sets`, with the dimensions stored as JSONB.
- Indexes:
  - `metric_sets(evaluation_id)` unique-active (one current MetricSet per
    Evaluation).
  - GIN index on the JSONB to accelerate analytics queries.

## Process Viability Score

The composite score is computed by `ProcessViabilityCalculator`:

```
viability =
   w_perf  * perf_score
 + w_eff   * eff_score
 + w_cost  * cost_score
 + w_robust* robust_score
 + w_qual  * qual_score
```

- Each per-dimension score is normalised to [0, 1] by the
  `MetricNormaliser` (Reporting context) per Benchmark.
- The active weighting scheme version is recorded on every score so cross-
  scheme comparisons are explicit.

## Boundaries

| Other context              | Interaction                                                       |
|----------------------------|-------------------------------------------------------------------|
| Evaluation                 | Customer/Supplier: consumes `evaluation.run.completed`.           |
| Reporting & Analytics      | Customer/Supplier: reporting reads the MetricSet and normalises.  |
| Orchestration              | Customer/Supplier: emits `metrics.finalised` to advance lifecycle.|
| LLM provider price lists   | ACL: `CostMetricsCollector` translates tokens to `Money`.         |

## Quality / Verification

- Each collector has unit tests with synthetic Evaluation Runs that cover
  edge cases (zero steps, all-error steps, very long runs).
- Property-based tests verify idempotence.
- Cost calculations are verified against known sample provider price lists
  in CI.
- Truth threshold (≥ 0.95) gates merges of collector changes.

## Open Questions / Future Work

- Add streaming dimension updates so the dashboard sees partial scores
  during long runs.
- Add a `Safety` dimension for content-safety / refusal measurement
  (would require a new collector and a weighting-scheme version bump).
