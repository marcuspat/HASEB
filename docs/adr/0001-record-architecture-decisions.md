# ADR 0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** governance, documentation

## Context and Problem Statement

HASEB is a multi-component system (orchestrator, agents, metrics services,
React dashboard, persistence) that must evolve over years while remaining
understandable to new contributors and to AI agents that operate on the
codebase. Without a durable record of *why* decisions were made, knowledge
decays into folklore, decisions get re-litigated, and contributors are
unable to reason about the boundaries of safe change.

How should HASEB capture significant architectural decisions so they remain
discoverable, reviewable, and immutable?

## Decision Drivers

- Decisions must be reviewable in code review (text-only, diffable).
- Decisions must survive contributor turnover.
- Decisions must be greppable from inside the repository.
- Format must be lightweight enough that engineers will actually write them.
- Format must be compatible with HASEB's verification-first culture: every
  decision must declare how its health is validated.

## Considered Options

1. **MADR 3.0 in the repository (`docs/adr/`).**
2. **A wiki (Confluence, GitHub Wiki).**
3. **No formal record; rely on commit messages and code comments.**

## Decision Outcome

**Chosen option: MADR 3.0 in `docs/adr/`.** Decisions live next to the code
they govern, are versioned with it, are reviewed in pull requests, and use a
template that already covers context, drivers, options, and consequences.

### Positive Consequences

- Decisions are reviewable like code and never drift from the repository.
- New contributors (human or AI) can `grep` the directory to understand the
  shape of the system.
- The format encourages short, focused decisions instead of sprawling design
  documents.

### Negative Consequences

- Requires discipline to actually write ADRs at the moment of decision.
- Numbering creates a coordination point on busy branches; mitigated by
  deferring final numbering until merge.

## Implementation Notes

- ADRs live in `docs/adr/` and are numbered `NNNN-kebab-title.md`.
- The template lives at `docs/adr/template.md`.
- The index lives at `docs/adr/README.md` and is updated on merge.
- An ADR is required whenever a change affects: persistence boundaries,
  authentication, the orchestration topology, the public API, or the choice
  of a major dependency.

## Validation

- The index is up to date in every release.
- Every PR that adds or replaces a major dependency cites an ADR.
- New contributor onboarding includes reading `docs/adr/README.md`.

## Links

- [MADR 3.0](https://adr.github.io/madr/)
- DDD documentation: [`../ddd/README.md`](../ddd/README.md)
