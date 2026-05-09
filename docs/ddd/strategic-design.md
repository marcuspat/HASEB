# Strategic Design

This document collects the strategic-design choices that shape HASEB at the
system level. For tactical patterns inside a single context, see
[tactical-design.md](./tactical-design.md).

## 1. Distillation: What is Core?

The **distillation** of HASEB's value:

> *Run heterogeneous Agents through heterogeneous Benchmarks and produce
> trustworthy, multi-dimensional measurements that compare them fairly.*

That sentence drives the four core subdomains:

1. **Evaluation** — owns the lifecycle.
2. **Orchestration** — drives the lifecycle reliably.
3. **Metrics** — produces the trustworthy measurements.
4. **Agent Management** — abstracts the heterogeneity of agents.

Everything else (catalog, reporting, identity, notifications) exists to
serve those four.

## 2. Bounded Contexts

Why we split the way we do:

- **Evaluation vs Orchestration.** Evaluation owns the *what* (state, run,
  steps). Orchestration owns the *how* (graph, queue, retries, environment).
  Splitting them lets us swap the orchestration substrate (LangGraph today,
  Temporal tomorrow) without disturbing the Evaluation aggregate.
- **Agent Management vs Orchestration.** Execution Agents wrap external
  harnesses and translate their vocabulary into the HASEB domain. Keeping
  this in a separate context preserves the Orchestration core from harness
  changes.
- **Metrics as a separate context.** Metrics are derived, not part of an
  Evaluation's invariants. A separate context lets us add new dimensions
  without changing Evaluation.
- **Reporting as a separate context.** The Leaderboard is a read model with
  different query patterns (CQRS-style). Separating it lets the read side
  evolve without touching the write side.
- **Notifications.** The WebSocket fan-out is infrastructure-flavoured;
  isolating it allows future migration to an external broker.
- **Identity & Access.** Generic; we want the freedom to replace it with an
  external IdP in the future (see ADR 0014's note on superseding).

## 3. Strategic Patterns Applied

### Anti-Corruption Layer (ACL)

Every external system has an ACL:

| External system            | ACL                                               |
|----------------------------|---------------------------------------------------|
| SWE-bench harness          | `src/agents/SWE_Bench_Agent.ts`                   |
| OSWorld / WebArena         | `src/agents/GUI_Automation_Agent.ts`              |
| GAIA / AgentBench          | `src/agents/General_Reasoning_Agent.ts`           |
| LLM provider APIs          | Cost / token translation in metrics collectors    |
| Upstream benchmark specs   | Importer / seed scripts                           |

The ACL boundary is enforced by code review: the Orchestration and Metrics
contexts must not import types from these systems directly.

### Open Host Service (OHS) + Published Language (PL)

The system has two OHSes:

- **HTTP REST API** (`/api/v1`) — published via OpenAPI (ADR 0013).
- **WebSocket event channel** — published via the domain-event catalogue in
  [domain-events.md](./domain-events.md).

Both are versioned. Backward-incompatible changes go through a `v2` mount
point or a new event schema version, never by mutating the existing one.

### Conformist

The Benchmark Catalog conforms to upstream benchmark specifications. We do
not negotiate upstream task definitions; we ingest, version, and trace them.

### Customer/Supplier

Orchestration is a customer of Benchmark Catalog and of Agent Management.
Both suppliers evolve to support Orchestration's needs; tickets across
contexts are routed accordingly.

### Partnership

Evaluation and Orchestration are designed as partners. Changes that affect
the Evaluation lifecycle land in both contexts in the same release; the
Context Map highlights this with a "P" edge.

### Shared Kernel (planned)

The shared TypeScript types in `src/types/` are a small, jointly-governed
kernel. Changes there require sign-off from two context owners minimum.

## 4. Boundaries Between Domain and Infrastructure

The domain layer never depends on:

- HTTP framework types (`express` request / response).
- WebSocket transport types (`socket.io` Sockets).
- Database driver types (`pg`, `sqlite3`).
- LLM SDK types.

These are imported only at the application service / adapter boundary and
translated into domain types.

## 5. Evolution Strategy

- **Today.** Single repository (ADR 0027), in-process event bus, LangGraph
  orchestration.
- **Near-term.** Materialised views for the Leaderboard read model.
- **Mid-term.** Optional split to a workspaces monorepo aligned with
  contexts; introduce a durable event store if cross-process scale demands.
- **Long-term.** Replace Identity & Access with an external IdP; supersede
  ADR 0014 with a new ADR.

## 6. Verification of the Strategic Design

The design is **alive only if** the boundaries are enforced. We verify:

- A static check rejects cross-context imports of repository internals.
- Architecture-fitness tests in `tests/integration/` confirm that:
  - Reporting reads only from query services, never from aggregate
    repositories.
  - Orchestration emits a domain event for every state transition.
  - Each external harness is reached only via its Execution Agent.
- The truth threshold (≥ 0.95) gates merges that touch the boundaries
  enumerated above (see ADR 0022).
