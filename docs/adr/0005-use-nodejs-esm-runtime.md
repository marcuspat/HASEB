# ADR 0005: Use Node.js with ESM as the backend runtime

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** runtime, backend, modules

## Context and Problem Statement

The orchestrator and API need a runtime that supports long-lived processes,
WebSockets, and the LangGraph TypeScript SDK. The team must also choose a
module system that aligns with modern tooling (Vite, ts-jest, tsx).

Which backend runtime and module system should HASEB use?

## Decision Drivers

- Native LangGraph TypeScript SDK support.
- WebSocket and async I/O performance.
- Compatibility with shared frontend tooling (Vite uses ESM).
- Long-term direction of the JavaScript ecosystem (ESM is the default).
- Operational maturity in container deployments.

## Considered Options

1. **Node.js (LTS) with native ESM.**
2. **Node.js with CommonJS.**
3. **Deno or Bun.**

## Decision Outcome

**Chosen option: Node.js (LTS) with ESM (`"type": "module"`).** Node is the
operational baseline; ESM is where the ecosystem is heading and where the
LangGraph and React tooling already lives.

### Positive Consequences

- Identical module syntax across frontend and backend.
- Top-level `await` available in scripts and orchestrator entrypoints.
- Tree-shakeable code paths in shared utilities.

### Negative Consequences

- Some legacy Node libraries are CJS-only; we use the `default` import
  interop or wrap them in tiny ESM shims.
- Jest still requires `NODE_OPTIONS='--experimental-vm-modules'` (already
  configured in `package.json`).

## Implementation Notes

- `package.json`: `"type": "module"`.
- Development: `tsx watch src/server.ts` (ADR-aligned).
- Tests: `NODE_OPTIONS='--experimental-vm-modules' jest`.
- Production: `tsc` emits ESM JavaScript run with `node dist/server.js`.

## Validation

- `npm run dev:backend` starts under 2 s on the reference container.
- All third-party imports resolve under ESM without `--experimental-*`
  flags beyond the Jest VM modules flag.

## Links

- ADR 0004 — Use TypeScript across frontend and backend
- ADR 0006 — Use Vite as the frontend build tool
- ADR 0011 — Use Express 5 for the HTTP API
