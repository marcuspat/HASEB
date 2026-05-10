# Bounded Contexts

A bounded context is the boundary inside which a single ubiquitous language
applies. Outside the boundary, the same word may mean something different,
and translation (Anti-Corruption Layer) is required.

HASEB has eight bounded contexts. Each owns its own aggregates, repositories,
and language. Cross-context interactions go through application services or
domain events — never through direct repository calls.

## Context List

### 1. Evaluation Context (Core)

Owns: `Evaluation`, `EvaluationRun`, `EvaluationStep`.

Responsibility: the lifecycle of a single Agent × Benchmark run, from
submission to completion or failure.

- Aggregate root: **Evaluation**.
- Source: `src/types/orchestrator.ts`, `src/database/models/Evaluation.ts`.
- Detail: [contexts/evaluation-context.md](./contexts/evaluation-context.md).

### 2. Orchestration Context (Core)

Owns: the LangGraph state machine, the Execution Engine, the Queue, the
Environment Manager, the WebSocket bridge, the Error Handler.

Responsibility: drive Evaluations through their lifecycle reliably.

- Source: `src/orchestrator/`.
- Detail: [contexts/orchestration-context.md](./contexts/orchestration-context.md).

### 3. Agent Management Context (Core)

Owns: `Agent` (the system under evaluation), Agent Profile / Configuration,
Execution Agents (`SWE_Bench_Agent`, `GUI_Automation_Agent`,
`General_Reasoning_Agent`).

Responsibility: register, version, and supply Agents to the Orchestrator.
Translate between HASEB's domain and external benchmark harnesses.

- Source: `src/agents/`, `src/database/models/Agent.ts`.
- Detail: [contexts/agent-context.md](./contexts/agent-context.md).

### 4. Benchmark Catalog Context (Supporting)

Owns: `Benchmark`, `BenchmarkTask`, oracle wrappers.

Responsibility: catalogue available Benchmarks, version them, and expose
selection to the Orchestrator.

- Source: `src/database/models/Benchmark.ts`.
- Detail: [contexts/benchmark-context.md](./contexts/benchmark-context.md).

### 5. Metrics Context (Core)

Owns: `MetricCollector` family, `MetricsOrchestrator`, the per-dimension
metric value objects, the Process Viability Score calculator.

Responsibility: translate an Evaluation Run into typed Metric Dimensions and
the composite score.

- Source: `src/services/metrics/`, `src/types/metrics.ts`.
- Detail: [contexts/metrics-context.md](./contexts/metrics-context.md).

### 6. Reporting & Analytics Context (Supporting)

Owns: the Leaderboard read model, trend charts, and the analytics queries.

Responsibility: turn Metrics into human-consumable insight on the dashboard.

- Source: `src/api/metrics.ts` (read endpoints), `src/components/`,
  `src/pages/{LeaderboardPage,AnalyticsPage}.tsx`.
- Detail: [contexts/reporting-context.md](./contexts/reporting-context.md).

### 7. Notifications & Real-time Context (Supporting)

Owns: the WebSocket channel topology, subscriptions, and event fan-out.

Responsibility: deliver domain events from the Orchestrator to the dashboard
and to external subscribers.

- Source: `src/orchestrator/WebSocketManager.ts`, `src/hooks/useRealTimeUpdates.ts`.
- Detail: [contexts/notifications-context.md](./contexts/notifications-context.md).

### 8. Identity & Access Context (Generic)

Owns: `User`, `Role`, `Session`, `Token`.

Responsibility: authenticate and authorize humans and service principals.

- Source: `src/api/auth.ts`, `src/database/models/User.ts`,
  `src/middleware/validation.ts`.
- Detail: [contexts/identity-access-context.md](./contexts/identity-access-context.md).

## Context Boundaries — Rules

1. **Aggregate references across contexts are by identity (UUID) only.** A
   service in the Reporting context never holds a live `Evaluation` object;
   it queries the read model.
2. **Cross-context calls go through application services or domain events.**
   The Orchestration context never reaches into the Metrics repository.
   Instead it emits an `evaluation.run.completed` event; the Metrics context
   consumes it.
3. **Each context has its own language.** "Step" in Evaluation means an
   Evaluation Step (an observed interaction). "Step" inside the Orchestration
   context's LangGraph means a graph node transition. The two are translated
   at the boundary.
4. **Anti-Corruption Layers wrap external systems.** SWE-bench, OSWorld, and
   GAIA harnesses are external to HASEB. The Execution Agents in Agent
   Management own the translation; the Orchestration core never sees their
   shapes.

See [context-map.md](./context-map.md) for the relationship diagram.
