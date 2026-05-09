# ADR 0013: Use Swagger / OpenAPI for API documentation

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** api, documentation

## Context and Problem Statement

The REST surface is consumed by the dashboard, by external CI scripts, and
by other agents. Hand-written API docs drift from the implementation.

How should HASEB document its REST API?

## Decision Drivers

- Documentation must live next to the code that defines the routes.
- Documentation must be browsable and try-it-out friendly.
- Must integrate with TypeScript types where possible.

## Considered Options

1. **OpenAPI 3 generated from JSDoc on Express routes via `swagger-jsdoc`,
   served via `swagger-ui-express`.**
2. **Hand-maintained Markdown.**
3. **TSOA / NestJS style decorators (would force a framework switch).**

## Decision Outcome

**Chosen option: `swagger-jsdoc` + `swagger-ui-express`.** Routes carry
JSDoc-style annotations that are scanned at startup and exposed as a
spec at `/api-docs`. This keeps Express simple while giving us a live spec.

### Positive Consequences

- Swagger UI provides interactive try-it-out for engineers and reviewers.
- The OpenAPI spec is a contract that the dashboard generates types from.
- Easy to wire downstream verification (e.g. spectral lint).

### Negative Consequences

- JSDoc annotations are duplicative of TypeScript types; we accept this
  until a fully type-driven generator stabilises.

## Implementation Notes

- Spec generation: `src/server.ts` configures `swagger-jsdoc` to scan
  `src/api/*.ts`.
- UI: served at `/api-docs` (development and staging) and protected behind
  auth in production.
- Versioning: API is mounted under `/api/v1`; future major versions live
  under `/api/v2`.

## Validation

- The spec is generated successfully on every CI run.
- Spectral lint passes on the generated spec.

## Links

- ADR 0011 — Use Express 5 for the HTTP API
- ADR 0012 — REST + WebSocket API style
- `docs/API_SPECIFICATIONS.md`
