# ADR 0002: Adopt SPARC + London-school TDD as the development methodology

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** methodology, process, tdd

## Context and Problem Statement

HASEB is being built by a mixed team of human engineers and Claude-Flow
agents. The system has high correctness requirements (≥ 0.95 truth threshold)
and a non-trivial domain (multi-environment agent evaluation). Without a
shared methodology, agent-generated code drifts from the intended
architecture and tests are written *to the implementation* instead of *to
the specification*.

Which development methodology should HASEB adopt?

## Decision Drivers

- Reproducibility: an agent and a human should produce the same shape of
  artefacts from the same task.
- Suitability for AI-driven contributors that work in short, atomic tasks.
- Compatibility with the verification-first culture (every artefact testable).
- Compatibility with DDD (decisions must respect bounded contexts).

## Considered Options

1. **SPARC (Specification, Pseudocode, Architecture, Refinement, Completion)
   combined with London-school TDD.**
2. **Classic Waterfall / BDUF.**
3. **Pure detroit-school TDD with no upstream specification phase.**

## Decision Outcome

**Chosen option: SPARC + London-school TDD.** SPARC produces the upstream
artefacts (specification, pseudocode, architecture) that microtask-breakdown
agents need to generate atomic 10-minute tasks; London-school TDD with
mocks-at-the-boundary aligns with the heavy use of orchestration, agents,
and external benchmark harnesses.

### Positive Consequences

- Microtasks are testable in isolation; agents can verify their own work.
- Mocks at boundaries decouple the orchestrator from real benchmark
  environments during testing.
- Each SPARC phase produces an artefact that can be reviewed independently.

### Negative Consequences

- SPARC adds upstream documentation cost; for trivial changes the protocol is
  overkill (we explicitly allow short-circuiting for typo-fixes and chore work).
- London-school TDD requires discipline around test doubles to avoid
  over-mocking.

## Implementation Notes

- The doc-planner agent (`agents/doc-planner.md`) emits SPARC artefacts.
- The microtask-breakdown agent (`agents/microtask-breakdown.md`) consumes
  them to produce atomic tasks.
- Tests are organised by layer:
  - `tests/unit` — domain & application services with mocked ports.
  - `tests/integration` — adapters against real databases / APIs.
  - `tests/e2e` — Playwright dashboards.
- Every PR carries the SPARC phase label that produced its artefacts.

## Validation

- Truth verification ≥ 0.95 on changes that follow the methodology.
- Test pyramid: unit ≫ integration ≫ e2e by count.
- Microtask completion time approximates the 10-minute target.

## Links

- ADR 0003 — Adopt Domain-Driven Design
- ADR 0023 — Use Jest and Playwright for testing
- `agents/doc-planner.md`, `agents/microtask-breakdown.md`
