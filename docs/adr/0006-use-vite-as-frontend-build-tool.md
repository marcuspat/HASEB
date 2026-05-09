# ADR 0006: Use Vite as the frontend build tool

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** frontend, build, tooling

## Context and Problem Statement

The HASEB dashboard is a React 19 SPA that depends on Tailwind CSS, D3, and
Chart.js. Build performance directly affects iteration speed for both the
team and AI agents writing UI code.

Which frontend build tool should HASEB use?

## Decision Drivers

- Cold-start dev server speed (sub-second).
- HMR latency for component edits.
- TypeScript and JSX support out of the box.
- First-class ESM support.
- Simple production build with sensible defaults.

## Considered Options

1. **Vite.**
2. **Webpack 5 + custom config.**
3. **Next.js (full framework).**
4. **Parcel.**

## Decision Outcome

**Chosen option: Vite.** Vite ships ESM-native, has the fastest dev server
in the relevant set, and pairs well with the React + TypeScript stack with
near-zero configuration. Next.js was rejected because HASEB does not need
SSR or file-based routing for an internal evaluation dashboard.

### Positive Consequences

- Sub-second dev server start.
- Native ESM dev imports avoid bundling overhead while iterating.
- `vite preview` provides a production-like server for review apps.

### Negative Consequences

- Vite + Jest interaction requires explicit ESM configuration (already
  handled in `jest.config.js`).
- Some legacy Webpack-only plugins are not portable; not used here.

## Implementation Notes

- Configuration: `vite.config.ts` at the repo root.
- Frontend entrypoint: `index.html` → `src/main.tsx`.
- Dev: `npm run dev` (Vite on the dashboard).
- Build: `npm run build:frontend` (`vite build`).
- The backend continues to use `tsc`/`tsx`.

## Validation

- Dashboard cold-start dev time < 1.5 s.
- Production build < 30 s on the reference container.
- HMR < 200 ms for component edits.

## Links

- ADR 0004 — Use TypeScript across frontend and backend
- ADR 0007 — Use React 19 for the dashboard UI
- ADR 0009 — Use Tailwind CSS for styling
