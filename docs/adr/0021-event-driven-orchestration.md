# ADR 0021: Use an event-driven orchestration model

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** events, orchestration, ddd

## Context and Problem Statement

Multiple subsystems care about evaluation lifecycle: the dashboard (live
view), the metrics pipeline, the queue, and downstream reporting. Tight
coupling between the orchestrator and each consumer would create a fan-out
of direct calls and make the system fragile.

How should HASEB propagate orchestration state changes?

## Decision Drivers

- Decoupling between the orchestrator and consumers.
- Single source of truth for "what happened in the evaluation".
- Compatibility with WebSocket streaming to the dashboard (ADR 0012).
- Compatibility with DDD domain events (ADR 0003).

## Considered Options

1. **Domain events emitted by the orchestrator and routed through a
   central event bus / `WebSocketManager`.**
2. **Direct method calls from the orchestrator to each consumer.**
3. **External message broker (NATS, Kafka).**

## Decision Outcome

**Chosen option: Domain events through the in-process bus
(`WebSocketManager`).** The orchestrator emits events such as
`evaluation.started`, `evaluation.step.completed`, `metrics.collected`,
and `evaluation.completed`. Consumers (WebSocket bridge, persistence
projector, alerting) subscribe to the events they care about.

A migration path to an external broker is preserved by keeping the event
shape stable and decoupled from the transport.

### Positive Consequences

- Adding a new consumer (e.g. an audit log) does not require changes to
  the orchestrator.
- The dashboard receives a curated event stream over WebSocket.
- Domain-event semantics align with the DDD model.

### Negative Consequences

- Event ordering must be preserved per evaluation; we use per-evaluation
  in-memory queues to enforce this.
- In-process bus is a single-process bottleneck; we plan to extract to
  a broker once horizontal scaling is needed.

## Implementation Notes

- Event names defined in `docs/ddd/domain-events.md`.
- Publication: `src/orchestrator/WebSocketManager.ts`.
- Schema: every event carries `eventId`, `evaluationId`, `timestamp`,
  `type`, and `payload`.
- Consumers register interest by event-name prefix.

## Validation

- 100 % of orchestrator state transitions emit a domain event.
- Replaying the event stream reproduces the persisted evaluation record.

## Links

- ADR 0012 — REST + WebSocket API style
- ADR 0018 — Use LangGraph for orchestration
- DDD: [`../ddd/domain-events.md`](../ddd/domain-events.md)
