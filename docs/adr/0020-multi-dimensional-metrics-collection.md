# ADR 0020: Use multi-dimensional metrics collection

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** metrics, domain

## Context and Problem Statement

A single "task success rate" hides the practical viability of an agent.
Two agents with identical success rates can differ by an order of
magnitude in cost, time, or robustness. HASEB's value proposition is the
holistic *process viability* score, which requires multiple metric
dimensions.

How should HASEB collect and represent metrics?

## Decision Drivers

- Coverage: metrics span performance, efficiency, cost, robustness, and
  quality.
- Comparability: metrics must be normalised across benchmarks for the
  leaderboard.
- Extensibility: new metrics added without rewriting the pipeline.
- Observability: every metric is sourced from a clearly defined collector.

## Considered Options

1. **Multi-dimensional collection with one collector per dimension.**
2. **Single all-in-one collector that emits every metric.**
3. **Per-benchmark bespoke metric outputs without normalisation.**

## Decision Outcome

**Chosen option: One collector per dimension orchestrated by a metrics
orchestrator.** Each collector owns its dimension (performance, efficiency,
cost, robustness, quality) and the metrics orchestrator composes them into
the final per-evaluation record.

### Positive Consequences

- Adding a new dimension is a new collector, not a rewrite.
- Each collector is independently testable.
- The leaderboard derives a composite "process viability" score from the
  normalised dimensions.

### Negative Consequences

- More moving parts than a single collector; mitigated by the consistent
  base interface.

## Implementation Notes

- Collectors in `src/services/metrics/`:
  - `BaseMetricCollector.ts`
  - `PerformanceMetricsCollector.ts` (task success rate)
  - `EfficiencyMetricsCollector.ts` (execution time, latency, steps)
  - `CostMetricsCollector.ts` (tokens, USD)
  - `RobustnessMetricsCollector.ts` (tool error rate, recovery)
  - `QualityMetricsCollector.ts` (tool-selection / parameter accuracy)
- Orchestration: `MetricsOrchestrator.ts` runs collectors and composes
  the final record.
- Storage: JSONB column on `evaluations.metrics` (ADR 0015).
- Schema: per-dimension shapes documented in `docs/ddd/value-objects.md`.

## Validation

- Metrics serialise to JSON and round-trip without loss.
- A collector can be added in a single PR with no orchestrator changes.

## Links

- ADR 0019 — Multi-agent execution strategy
- ADR 0015 — PostgreSQL with JSONB for metrics
- DDD: [`../ddd/contexts/metrics-context.md`](../ddd/contexts/metrics-context.md)
