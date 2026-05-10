# ADR 0007: Use React 19 for the dashboard UI

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** frontend, ui-framework

## Context and Problem Statement

The dashboard is the primary surface for evaluation results, leaderboards,
real-time runs, and configuration. It must support live updates over
WebSockets, complex visualizations, and a clean component model.

Which UI framework should HASEB adopt?

## Decision Drivers

- Component reuse for cards, tables, and chart panels.
- Ecosystem depth for charts, forms, and routing.
- Compatibility with TypeScript and Vite.
- Suitability for AI-assisted authoring (large training corpus, well-known
  patterns).

## Considered Options

1. **React 19** with Vite + Tailwind.
2. **Vue 3** + Vite.
3. **Svelte / SvelteKit.**
4. **Solid.**

## Decision Outcome

**Chosen option: React 19.** React's ecosystem (Chart.js wrappers, react
router, headless UI) is the deepest of the alternatives, and the team's and
agents' familiarity is highest.

### Positive Consequences

- Direct use of `react-chartjs-2`, `@headlessui/react`, `lucide-react`.
- React 19 server components are *not* used (this is an SPA), but new
  hooks (`useOptimistic`, `useFormStatus`) are available where useful.
- Routing via `react-router-dom` v7.

### Negative Consequences

- Rerender footguns require disciplined memoization in real-time views.
- React 19 is recent; some libraries may lag on peer-dep updates.

## Implementation Notes

- Pages live in `src/pages/`.
- Reusable components live in `src/components/`.
- Hooks live in `src/hooks/`.
- Global state via Zustand (ADR 0008).
- Real-time updates via the `useRealTimeUpdates` hook backed by
  `socket.io-client`.

## Validation

- 60 fps interaction on the leaderboard with 1k rows.
- React profiler shows < 16 ms for the dashboard root component on
  refresh.

## Links

- ADR 0008 — Use Zustand for client state management
- ADR 0009 — Use Tailwind CSS for styling
- ADR 0010 — Use Chart.js and D3 for visualization
