# ADR 0004: Use TypeScript across frontend and backend

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** language, type-safety, frontend, backend

## Context and Problem Statement

HASEB spans a Node.js orchestrator, an Express API, and a React dashboard.
The domain has many cross-cutting types — evaluations, metrics, agents,
benchmarks — that travel across the wire and across module boundaries.

Which language(s) should HASEB use across these layers?

## Decision Drivers

- Single source of truth for shared domain types.
- Compile-time safety to catch shape mismatches between services.
- Tooling maturity (LSP, refactoring, test runners).
- Compatibility with LangGraph and the React 19 ecosystem.
- Onboarding cost: TypeScript skills are widespread.

## Considered Options

1. **TypeScript everywhere** (frontend + backend).
2. **JavaScript on both sides** with JSDoc types.
3. **Polyglot:** Python for orchestration, TypeScript for frontend.

## Decision Outcome

**Chosen option: TypeScript everywhere.** Sharing types between the API and
the dashboard is the highest-leverage benefit; a single language reduces
cognitive load for contributors and AI agents.

### Positive Consequences

- Domain types declared once in `src/types/` and consumed everywhere.
- LangGraph state types are checked at compile time.
- Refactoring is mechanical across the codebase.

### Negative Consequences

- Build step required even for the backend (mitigated by `tsx` in
  development and `tsc` for production).
- Some Node ecosystem libraries still ship lazy or incorrect types; we pin
  `@types/*` versions to avoid drift.

## Implementation Notes

- `tsconfig.json` at the repository root with project references planned
  for a future split.
- ESM (`"type": "module"`) — see ADR 0005.
- Strict mode (`strict: true`, `noImplicitAny: true`) is the target; new
  code must compile under strict mode even where legacy code is grandfathered.
- Domain types live in `src/types/` and are re-exported from each context.

## Validation

- `npm run typecheck` is green on every PR.
- Shared type coverage: dashboard request/response types import from
  `src/types/` rather than redefining shapes locally.

## Links

- ADR 0005 — Use Node.js with ESM as the backend runtime
- ADR 0006 — Use Vite as the frontend build tool
- ADR 0007 — Use React 19 for the dashboard UI
