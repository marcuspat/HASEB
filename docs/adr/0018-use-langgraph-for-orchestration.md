# ADR 0018: Use LangGraph for evaluation orchestration

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** orchestration, langgraph

## Context and Problem Statement

An evaluation run is a stateful workflow: setup an environment, execute the
agent against a task, collect metrics, analyse, teardown. Steps can fail
and need retries; some steps fan out (e.g. multi-task benchmarks); state
must survive a process restart for long-running suites.

Which orchestration substrate should HASEB use?

## Decision Drivers

- Stateful workflow representation.
- Native TypeScript SDK.
- Compatibility with LLM-driven steps.
- Persistence and replay support.
- Community alignment (LangChain ecosystem).

## Considered Options

1. **LangGraph (`@langchain/langgraph`).**
2. **Temporal.**
3. **A bespoke state machine implementation.**
4. **Plain async/await control flow.**

## Decision Outcome

**Chosen option: LangGraph.** LangGraph provides the directed-graph state
machine model HASEB needs, integrates cleanly with the LangChain ecosystem
the agents rely on, and ships TypeScript types that match the domain
state shape.

### Positive Consequences

- The evaluation graph is a first-class artefact: nodes for setup,
  execute, collect, analyse, teardown.
- Branching for benchmark-specific paths is declarative.
- Replay and inspection of state is straightforward.

### Negative Consequences

- LangGraph is younger than Temporal; for very long-running workflows we
  may need an external durable store (planned, not blocking v1).
- Some operational tools (UI, retries dashboards) are less mature than
  Temporal's; we mitigate by emitting structured events to our own
  WebSocket and metrics pipelines.

## Implementation Notes

- Orchestration code lives in `src/orchestrator/`:
  - `EvaluationOrchestrator.ts` — graph definition.
  - `ExecutionEngine.ts` — step executor.
  - `EnvironmentManager.ts` — environment setup / teardown.
  - `MetricsCollector.ts` — collection step.
  - `EvaluationQueue.ts` — backpressure / scheduling.
  - `WebSocketManager.ts` — event publication.
  - `ErrorHandler.ts` — retry policy and dead-letter handling.
- State shape lives in `src/types/orchestrator.ts`.
- Node functions are pure where possible to ease testing.

## Validation

- Each graph node has a unit test exercising success and failure paths.
- The orchestrator publishes `evaluation.*` events for every node
  transition.

## Links

- ADR 0021 — Event-driven orchestration
- ADR 0019 — Multi-agent execution strategy
- DDD: [`../ddd/contexts/orchestration-context.md`](../ddd/contexts/orchestration-context.md)
