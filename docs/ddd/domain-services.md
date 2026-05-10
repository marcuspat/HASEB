# Domain Services

A **domain service** captures a piece of domain behaviour that doesn't have
a natural home on a single entity or aggregate. Domain services are
stateless and depend only on other domain types (no framework imports).

This document catalogues HASEB's domain services. Each carries a contract
(inputs, outputs, errors), invariants it enforces, and the bounded context
it lives in.

## 1. `ProcessViabilityCalculator` — Metrics Context

Composes the five Metric Dimensions into the composite Process Viability
Score. The headline number on the Leaderboard.

```ts
interface ProcessViabilityCalculator {
  compute(
    dimensions: ReadonlyArray<MetricDimension>,
    weights: ViabilityWeights,
  ): ProcessViabilityScore;
}
```

**Invariants:**
- All five dimensions must be present; throws `MissingDimensionError`
  otherwise.
- Weight sum must equal 1.0 within ε; otherwise `InvalidWeightsError`.
- Output value ∈ [0.0, 1.0].

**Notes:** the weighting scheme is versioned (`ProcessViabilityScore.version`)
so that scores are comparable only within the same scheme version.

## 2. `EvaluationScheduler` — Orchestration Context

Decides which Evaluation to dequeue next. Encapsulates priority, fairness,
and per-Agent concurrency limits.

```ts
interface EvaluationScheduler {
  pickNext(queueSnapshot: QueueSnapshot, runningCount: RunningCount):
    EvaluationId | null;
}
```

**Invariants:**
- Never picks an Evaluation whose Agent already has the maximum allowed
  concurrent runs.
- Respects priority while preventing per-User starvation.

## 3. `AgentFingerprinter` — Agent Management Context

Produces a deterministic, content-addressable hash from an `AgentProfile`.
Used to detect whether an Agent's configuration has changed and whether two
Evaluations are comparable.

```ts
interface AgentFingerprinter {
  fingerprint(profile: AgentProfile): Fingerprint;
}
```

**Invariants:**
- Stable: same `AgentProfile` always yields the same `Fingerprint`.
- Sensitive: any field change yields a new `Fingerprint`.
- Algorithm is captured in `Fingerprint.algorithm` (currently `sha256`).

## 4. `RunOutcomeOracle` — Evaluation Context

Wraps a Benchmark's `OracleSpec` and returns a typed `RunOutcome` for an
attempt. Each Benchmark kind (`code`, `gui`, `reasoning`) has a concrete
oracle that the application service constructs.

```ts
interface RunOutcomeOracle {
  judge(run: EvaluationRun, oracleSpec: OracleSpec): RunOutcome;
}
```

**Invariants:**
- Pure function over the run's recorded steps and the oracle definition.
- Never depends on real time — judgements are reproducible from a stored Run.

## 5. `MetricNormaliser` — Reporting & Analytics Context

Normalises raw Metric Dimensions to per-Benchmark canonical scales so that
the Leaderboard can compare Agents fairly.

```ts
interface MetricNormaliser {
  normalise(
    benchmarkId: BenchmarkId,
    dimension: MetricDimension,
  ): NormalisedMetric;
}
```

**Invariants:**
- Output range is [0.0, 1.0] regardless of the input scale.
- Idempotent: normalising a normalised value returns the same value.

## 6. `EvaluationCostEstimator` — Metrics Context

Computes a `Money` cost estimate from a `TokenCount` and the active provider
price list. Used both inside `CostMetricsCollector` and pre-flight to give
operators a budget warning before scheduling expensive Evaluations.

```ts
interface EvaluationCostEstimator {
  estimate(provider: string, model: string, tokens: TokenCount): Money;
}
```

**Invariants:**
- Inputs and outputs are non-negative.
- Throws `UnknownProviderError` if `(provider, model)` is not in the price
  list.

## 7. `TruthVerifier` — Cross-cutting

Wraps `claude-flow@alpha verify` for use in CI and in runtime checks. Lives
at the boundary between domain code and the verification subsystem; the
domain layer depends on the interface, not on the CLI.

```ts
interface TruthVerifier {
  verify(action: VerifiableAction): Promise<TruthScore>;
}
```

**Invariants:**
- A score below the threshold (0.95) raises `TruthBelowThresholdError`.
- Verifications are quorum-based (BFT); a single verifier cannot pass.

## Where domain services live

| Service                          | Source location                                     |
|----------------------------------|-----------------------------------------------------|
| `ProcessViabilityCalculator`     | `src/services/metrics/` (planned)                   |
| `EvaluationScheduler`            | `src/orchestrator/EvaluationQueue.ts` (extracted)   |
| `AgentFingerprinter`             | `src/agents/` (planned)                             |
| `RunOutcomeOracle`               | `src/services/` (planned)                           |
| `MetricNormaliser`               | `src/services/metrics/` (planned)                   |
| `EvaluationCostEstimator`        | `src/services/metrics/CostMetricsCollector.ts`      |
| `TruthVerifier`                  | `src/services/` (planned, wraps claude-flow CLI)    |

## Testing Domain Services

Domain services are **pure** with respect to their declared dependencies.
This makes them ideal for property-based tests:

- Stability of `AgentFingerprinter`.
- Idempotence of `MetricNormaliser`.
- Boundary conditions of `ProcessViabilityCalculator` (zero-weight dimensions,
  perfect scores, all-zero scores).
