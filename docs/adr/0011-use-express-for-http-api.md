# ADR 0011: Use Express 5 for the HTTP API

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** backend, http-api

## Context and Problem Statement

The HASEB API exposes evaluation control, agent management, benchmark
metadata, metrics queries, and authentication. It must integrate with the
WebSocket subsystem and with Swagger/OpenAPI.

Which HTTP framework should HASEB use?

## Decision Drivers

- Mature middleware ecosystem (CORS, helmet, rate-limit).
- TypeScript types of acceptable quality.
- Compatibility with `socket.io` on the same HTTP server.
- Operational maturity in production.

## Considered Options

1. **Express 5.**
2. **Fastify.**
3. **NestJS (full framework).**
4. **Hono.**

## Decision Outcome

**Chosen option: Express 5.** Express remains the simplest path to a
batteries-required-but-pluggable HTTP API on Node, with first-class support
for `helmet`, `cors`, `morgan`, `compression`, `express-rate-limit`, and
`socket.io` co-deployment. Express 5's built-in async error propagation
removes the historical "wrap every async handler" pain point.

### Positive Consequences

- Minimal opinionation; the application architecture stays under our control.
- All needed middleware exists and is well-typed.
- Easy interop with `socket.io` on the shared HTTP server.

### Negative Consequences

- Express's per-request overhead is higher than Fastify's; not the bottleneck
  for HASEB's expected request profile, where downstream LLM calls dominate.
- Manual route wiring; we mitigate by structuring routes per bounded context
  in `src/api/`.

## Implementation Notes

- Entrypoint: `src/server.ts`.
- Routes per context: `src/api/{auth,agents,benchmarks,evaluations,metrics,orchestrator}.ts`.
- Middleware:
  - `helmet`, `cors`, `compression`, `morgan` for cross-cutting concerns.
  - `express-rate-limit` (ADR 0024).
  - Request validation middleware in `src/middleware/validation.ts`.
- API docs: Swagger via `swagger-jsdoc` + `swagger-ui-express` (ADR 0013).

## Validation

- 99th-percentile latency for `GET /api/v1/leaderboard` < 200 ms (cached).
- Zero unhandled promise rejections under load tests.

## Links

- ADR 0005 — Node.js / ESM runtime
- ADR 0012 — REST + WebSocket API style
- ADR 0013 — Swagger / OpenAPI for API documentation
