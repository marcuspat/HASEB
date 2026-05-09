# ADR 0003: Adopt Domain-Driven Design as the design approach

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** ddd, design, architecture

## Context and Problem Statement

HASEB has a rich domain: agents, benchmarks, evaluations, multi-dimensional
metrics, orchestration workflows, and reporting. Early prototypes treated
the system as a CRUD API with handlers, leading to leaky abstractions and
tight coupling between persistence, orchestration, and the dashboard.

How should HASEB structure the domain so that orchestration, persistence,
and presentation can evolve independently?

## Decision Drivers

- Long-term evolution: benchmarks and metric dimensions are added often.
- Contributor onboarding: the domain language is non-obvious.
- Compatibility with multi-agent execution; agents must operate inside
  well-defined contexts.
- Need for explicit ports/adapters between the orchestrator and the outside
  world (LLM APIs, GUI environments, Docker harnesses).

## Considered Options

1. **Domain-Driven Design** with bounded contexts, aggregates, and an
   anti-corruption layer at every external boundary.
2. **Layered architecture** (controller → service → repository) without
   explicit bounded contexts.
3. **Transaction Script / Active Record** — keep it simple, push behaviour
   into models.

## Decision Outcome

**Chosen option: Domain-Driven Design.** The HASEB domain is large enough
to benefit from bounded contexts, and the verification-first culture
demands explicit ports for testability. DDD also supplies a shared
vocabulary that the doc-planner and microtask-breakdown agents can use.

### Positive Consequences

- Bounded contexts give us a unit of independent deployment.
- Aggregates enforce invariants without leaking through repositories.
- Anti-corruption layers protect the orchestration core from changes in
  external benchmark harnesses (SWE-bench, OSWorld, GAIA).

### Negative Consequences

- Higher upfront design cost; we mitigate with the strategic-design docs in
  `docs/ddd/` so the costs are paid once.
- Risk of cargo-culting "DDD-flavoured" patterns without real boundaries;
  mitigated by explicit Context Map maintenance.

## Implementation Notes

- Strategic design lives in `docs/ddd/`:
  - Ubiquitous language, subdomains, bounded contexts, context map.
- Tactical design lives in `docs/ddd/`:
  - Aggregates, entities, value objects, domain events, services,
    repositories.
- Source layout follows the contexts:
  - `src/orchestrator/` — Evaluation Orchestration context.
  - `src/agents/` — Agent context (execution).
  - `src/services/metrics/` — Metrics context.
  - `src/api/` — Application services / adapters.
  - `src/database/models/` — Persistence adapters.
- Cross-context calls go through application services or domain events; never
  through direct repository calls.

## Validation

- Every bounded context has a `docs/ddd/contexts/<name>.md` page.
- The Context Map is updated whenever a new external integration ships.
- Code review rejects PRs that introduce cross-context aggregate references.

## Links

- ADR 0017 — Repository pattern
- ADR 0021 — Event-driven orchestration
- DDD docs: [`../ddd/README.md`](../ddd/README.md)
- *Domain-Driven Design* (Eric Evans, 2003)
- *Implementing Domain-Driven Design* (Vaughn Vernon, 2013)
