# ADR 0008: Use Zustand for client state management

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** frontend, state-management

## Context and Problem Statement

The dashboard has cross-cutting state: the active filter, the live
evaluation feed, user preferences, and selected agent. React Context alone
becomes verbose, and Redux's boilerplate is disproportionate to the size of
the application.

Which state-management library should the dashboard use?

## Decision Drivers

- Minimal boilerplate.
- TypeScript-friendly.
- Selective subscription (avoid global rerenders).
- DevTools integration.
- Compatibility with React 19 concurrent features.

## Considered Options

1. **Zustand.**
2. **Redux Toolkit.**
3. **Jotai / Recoil.**
4. **React Context only.**

## Decision Outcome

**Chosen option: Zustand.** Zustand provides the smallest API that satisfies
selective subscription and TypeScript inference. Its store-as-a-hook model
fits naturally with the existing component layout.

### Positive Consequences

- Single store file (`src/store/useDashboardStore.ts`) for global UI state.
- Selectors prevent unnecessary rerenders on the leaderboard.
- Easy to test: stores are plain functions.

### Negative Consequences

- No batteries-included middleware ecosystem like Redux Toolkit; we add
  middleware (persist, devtools) only when we need it.

## Implementation Notes

- Server cache (responses from the API) is *not* in Zustand; we rely on
  request-driven state for now and may introduce TanStack Query later.
- Real-time WebSocket events update the store via the
  `useRealTimeUpdates` hook.
- Stores are split by responsibility, not by feature; one store per
  bounded-context UI surface.

## Validation

- Re-render count per evaluation tick stays bounded.
- New developers can onboard to the store with < 30 minutes of reading.

## Links

- ADR 0007 — Use React 19 for the dashboard UI
- ADR 0012 — REST + WebSocket API style
