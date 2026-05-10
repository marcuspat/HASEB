# Evaluation Context

**Type:** Core subdomain.
**Position in the system:** the central context. Every other context exists
to feed it, drive it, or report on its output.

## Purpose

Own the lifecycle of a single Agent × Benchmark run, from submission to a
durable outcome with attached Metrics. This context is the **source of
truth** for what happened in an Evaluation — its run, its steps, its final
state, and the link to its MetricSet.

## Ubiquitous Language (local)

Sourced from [../ubiquitous-language.md](../ubiquitous-language.md):
**Evaluation**, **Evaluation Run**, **Evaluation Step**, **state machine**.

## Aggregates

### Evaluation (root)

Members:
- `EvaluationRun` (1-to-1)
- `EvaluationStep[]` (0-to-N, append-only)

See [../aggregates.md](../aggregates.md#1-evaluation-aggregate-core) for
invariants and commands.

## State Machine

```
                  cancel(reason)
            ┌──────────────────────────┐
            │                          │
   submit() │                          ▼
   ┌──────►queued ─── start() ──► running ──── markRunCompleted() ──► collecting
   │                          │                                            │
   │                          │ fail(reason)                               │
   │                          ▼                                            │ attachMetrics()
   │                       failed                                          ▼
   │                                                                  analyzing
   │                                                                       │
   │                                                                       │ markCompleted()
   │                                                                       ▼
   │                                                                   completed
   │
  (terminal: completed | failed | cancelled)
```

**Rules**

- Transitions never skip a state.
- Terminal states are sticky.
- `cancel(...)` is allowed only from `queued` or `running`.
- `fail(...)` is allowed from any non-terminal state and records the stage:
  `queue | environment | execution | collection | analysis`.

## Use Cases

| Use case               | Application service       | Trigger                               |
|------------------------|---------------------------|---------------------------------------|
| Submit                 | `SubmitEvaluation`        | `POST /api/v1/evaluations`            |
| Start (internal)       | `ExecuteEvaluation`       | scheduler dispatches                  |
| Record step            | (orchestrator)            | live during run                       |
| Run completed          | `CompleteRun`             | end of execution graph node           |
| Attach metrics         | `AttachMetricSet`         | event `metrics.finalised`             |
| Complete               | `CompleteEvaluation`      | after metrics attached                |
| Fail                   | `FailEvaluation`          | error path / retry exhausted          |
| Cancel                 | `CancelEvaluation`        | `POST /api/v1/evaluations/{id}/cancel`|

## Repositories

- `IEvaluationRepository` (see [../repositories.md](../repositories.md)).

Read-side projections served by `IEvaluationQueryService`.

## Domain Events Emitted

- `evaluation.submitted`
- `evaluation.started`
- `evaluation.step.recorded`
- `evaluation.run.completed`
- `evaluation.completed`
- `evaluation.failed`
- `evaluation.cancelled`

See [../domain-events.md](../domain-events.md) for schemas.

## Domain Services

- `RunOutcomeOracle` — judges the run against the Benchmark's `OracleSpec`.

## Persistence Mapping

- Tables: `evaluations`, `evaluation_runs`, `evaluation_steps` (partitioned
  by month after the first GA release).
- Indexes:
  - `evaluations(state)` — for queue scan.
  - `evaluations(agent_id, created_at DESC)` — for "recent for agent".
  - `evaluation_steps(evaluation_id, step_index)` — primary sort.

## Boundaries with Other Contexts

| Other context                   | Interaction                                                            |
|---------------------------------|------------------------------------------------------------------------|
| Orchestration                   | Partnership: drives lifecycle; emits step events.                      |
| Agent Management                | Customer/Supplier: resolves `agentId` to an executable Agent.          |
| Benchmark Catalog               | Customer/Supplier: resolves `benchmarkId` to tasks + oracle.           |
| Metrics                         | Customer/Supplier via `evaluation.run.completed` event.                |
| Reporting & Analytics           | Read-only: reads completed Evaluations through query services.         |
| Notifications & Real-time       | Open Host Service: events fan-out to dashboards.                       |
| Identity & Access               | Generic: every Evaluation is `submittedById`.                          |

## Open Questions / Future Work

- Long-running Evaluations may need durable replay; we plan to introduce a
  durable event store and rehydrate aggregates from events (see ADR 0021).
- Step storage scale: at very high step counts, we may move to a separate
  cold store and keep only summary steps in the primary table.
