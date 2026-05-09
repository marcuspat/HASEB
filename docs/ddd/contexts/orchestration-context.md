# Orchestration Context

**Type:** Core subdomain.
**Position:** the engine. Owns the LangGraph that drives Evaluations through
their lifecycle.

## Purpose

Drive every Evaluation reliably from `queued` to a terminal state, with
explicit retries, environment management, metrics handoff, and event
publication. The Orchestration context is **the only context that may
mutate an Evaluation's state** during a run.

## Ubiquitous Language (local)

- **Graph** — the LangGraph state machine.
- **Node** — a single step in the graph (setup / execute / collect / analyse / teardown).
- **Edge** — a transition between nodes; conditional edges encode retries
  and failure paths.
- **Queue** — the ordered set of `queued` Evaluations waiting for a runner.
- **Environment** — the sandbox in which an Execution Agent runs an Agent
  against a Benchmark Task.

## Components

| Component              | Source                                               | Role                                 |
|------------------------|------------------------------------------------------|--------------------------------------|
| `EvaluationOrchestrator` | `src/orchestrator/EvaluationOrchestrator.ts`       | Builds and runs the LangGraph.       |
| `ExecutionEngine`      | `src/orchestrator/ExecutionEngine.ts`                | Runs the `execute` node.             |
| `EnvironmentManager`   | `src/orchestrator/EnvironmentManager.ts`             | Creates / tears down sandboxes.      |
| `MetricsCollector`     | `src/orchestrator/MetricsCollector.ts`               | Bridges to the Metrics context.      |
| `EvaluationQueue`      | `src/orchestrator/EvaluationQueue.ts`                | FIFO + priority + per-Agent limits.  |
| `WebSocketManager`     | `src/orchestrator/WebSocketManager.ts`               | Publishes domain events.             |
| `ErrorHandler`         | `src/orchestrator/ErrorHandler.ts`                   | Retry policy + dead-letter handling. |

## The Evaluation Graph

```
              ┌────────────┐
              │   setup    │  EnvironmentManager.provision(...)
              └─────┬──────┘
                    │ on_success
                    ▼
              ┌────────────┐
              │   execute  │  ExecutionEngine.run(execution_agent, benchmark_task)
              └─────┬──────┘
                    │ on_run_done
                    ▼
              ┌────────────┐
              │  collect   │  emit `evaluation.run.completed`
              └─────┬──────┘
                    │ on_metrics_finalised
                    ▼
              ┌────────────┐
              │  analyse   │  attach MetricSet to Evaluation
              └─────┬──────┘
                    │
                    ▼
              ┌────────────┐
              │  teardown  │  EnvironmentManager.tearDown(...)
              └─────┬──────┘
                    │
                    ▼
                completed

   (failures from any node go through ErrorHandler, which decides:
    retry the node up to N times, then transition the Evaluation
    to `failed` with the stage in which it failed.)
```

## Concurrency and Backpressure

- A maximum of `N` concurrent Evaluations per process; `N` is configurable
  per environment.
- Per-Agent concurrency limit (the `EvaluationScheduler` domain service
  enforces it) prevents one Agent monopolising the queue.
- Backpressure: the queue rejects submissions only when the queue itself is
  full (configured high watermark).

## Retries and Idempotency

- The graph is **idempotent on retry** at the node level: re-running
  `setup` produces an equivalent environment; re-running `collect` is a
  no-op if metrics are already finalised.
- Step-level retries (an LLM call timing out) are handled inside
  `ExecutionEngine` and recorded as `EvaluationStep`s with `status='error'`.

## Use Cases

| Use case                           | Application service              |
|------------------------------------|----------------------------------|
| Dispatch the next queued Evaluation | `DispatchNextEvaluation`         |
| Execute one Evaluation             | `ExecuteEvaluation`              |
| Reconcile stalled Evaluations      | `ReconcileStalledEvaluations`    |

## Domain Events Consumed and Emitted

Consumed:
- `evaluation.submitted` (queue)
- `metrics.finalised` (proceeds from `analyzing` to `completed`)

Emitted:
- `evaluation.started`, `evaluation.step.recorded`,
  `evaluation.run.completed`, `evaluation.failed`, `evaluation.cancelled`
- `queue.enqueued`, `queue.dequeued`

## Boundaries

| Other context             | Interaction                                                  |
|---------------------------|--------------------------------------------------------------|
| Evaluation                | Partnership: mutates aggregates through their commands only. |
| Agent Management          | Customer/Supplier: resolves Execution Agent for a Benchmark kind. |
| Benchmark Catalog         | Customer/Supplier: fetches Benchmark + tasks.                |
| Metrics                   | Customer/Supplier via event `evaluation.run.completed`.      |
| Notifications & Real-time | Open Host Service: events fan out via `WebSocketManager`.    |

## Failure Modes and Recovery

| Failure                   | Handling                                                     |
|---------------------------|--------------------------------------------------------------|
| Environment provisioning  | Retry × 2 with exponential backoff; then `failed: environment`. |
| Agent execution timeout   | Step recorded as error; retried per agent policy; ultimately `failed: execution`. |
| Metrics collection error  | Retry the affected dimension; `failed: collection` after exhaustion. |
| Process crash             | On startup, `ReconcileStalledEvaluations` requeues `running` Evaluations whose lock is stale. |

## Operational Visibility

- Every node transition publishes an event over WebSocket.
- Logs (Winston) carry `evaluationId` and `correlationId`.
- The dashboard queue widget consumes `queue.*` events.

## Open Questions / Future Work

- Move from in-process queue to a durable broker for multi-process
  scaling.
- Replace LangGraph with Temporal for very long-running benchmark suites if
  the need materialises (would supersede ADR 0018).
