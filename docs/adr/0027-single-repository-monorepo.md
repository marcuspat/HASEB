# ADR 0027: Use a single-repository (modular monorepo) layout

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** repo-layout

## Context and Problem Statement

HASEB has a frontend (React dashboard), a backend (Express API and
orchestrator), shared types, and benchmark integrations. These could live
in separate repositories or in one.

Should HASEB be a polyrepo, a workspaces monorepo, or a single-package
modular monorepo?

## Decision Drivers

- Shared TypeScript types between frontend and backend (ADR 0004).
- One CI pipeline.
- Speed of iteration during the SPARC refinement phase.
- Compatibility with bounded-context organisation (ADR 0003).

## Considered Options

1. **Single-package monorepo with bounded contexts as folders under `src/`.**
2. **Workspaces monorepo with `packages/frontend`, `packages/backend`,
   `packages/shared`.**
3. **Polyrepo (separate repos per service).**

## Decision Outcome

**Chosen option: Single-package modular monorepo.** For HASEB's current
size and team, the workspace overhead exceeds its benefits. Bounded
contexts are first-class folders inside `src/`. A future split to
workspaces is preserved as an option, not a commitment.

### Positive Consequences

- Single `package.json`, single CI pipeline.
- Shared types in `src/types/` are imported directly.
- Refactors across contexts are atomic.

### Negative Consequences

- Frontend and backend share `node_modules`; we accept the dependency
  surface as small enough.
- A future split will require disentangling shared imports; module
  boundaries are documented in `docs/ddd/` to ease this.

## Implementation Notes

- Top-level layout:
  - `src/agents/`, `src/orchestrator/`, `src/services/`, `src/api/`,
    `src/database/`, `src/components/`, `src/pages/`, `src/types/`.
- A future workspace split would map to `packages/orchestrator`,
  `packages/api`, `packages/dashboard`, `packages/shared`.

## Validation

- New contributors can clone, install, and run `npm test` without
  understanding workspace tooling.
- Build times remain under the targets defined in ADR 0006.

## Links

- ADR 0003 — Adopt Domain-Driven Design
- ADR 0004 — Use TypeScript everywhere
