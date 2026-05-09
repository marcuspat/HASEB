# ADR 0012: Use REST + WebSocket for the API surface

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** api, websocket

## Context and Problem Statement

HASEB has two interaction modes: traditional CRUD (manage agents, list
benchmarks, request a leaderboard) and live event consumption (an
evaluation run produces metric updates that should appear immediately on
the dashboard).

Which API style(s) should HASEB expose?

## Decision Drivers

- Simplicity for cacheable, stateless operations.
- Low latency and minimal overhead for live event streams.
- Compatibility with browser SPAs, Postman, curl, and CI scripts.
- Compatibility with Swagger / OpenAPI tooling.

## Considered Options

1. **REST for state-changing and read operations + WebSocket for live
   events.**
2. **GraphQL for both control plane and live data.**
3. **gRPC + grpc-web.**
4. **REST only with long polling for live updates.**

## Decision Outcome

**Chosen option: REST + WebSocket.** REST gives us cacheable, well-tooled
control-plane endpoints; WebSocket via `socket.io` gives us a single live
channel for evaluation progress, queue updates, and metric streams.
GraphQL was rejected for the control plane: HASEB's API is shape-stable and
the marginal benefit didn't justify the resolver complexity.

### Positive Consequences

- The dashboard subscribes to a single WebSocket and demultiplexes events.
- Standard tools (Postman, curl, Swagger UI) work for the REST surface.
- The orchestrator's `WebSocketManager` pushes domain events without
  coupling to HTTP.

### Negative Consequences

- Two protocols to authorize and rate-limit; we mitigate by sharing the
  JWT validator on both surfaces (ADR 0014).

## Implementation Notes

- REST routes live in `src/api/*.ts` and follow the conventions in
  `docs/API_SPECIFICATIONS.md`.
- WebSocket events flow through `src/orchestrator/WebSocketManager.ts`.
- Event names are namespaced per context: `evaluation.*`, `metrics.*`,
  `queue.*`.
- All payloads validated against shared types in `src/types/`.

## Validation

- WebSocket round-trip latency < 100 ms for in-cluster clients.
- REST endpoints documented in OpenAPI; Swagger UI is reachable in dev.

## Links

- ADR 0011 — Use Express 5 for the HTTP API
- ADR 0014 — JWT authentication
- ADR 0021 — Event-driven orchestration
