# ADR 0014: Use JWT for authentication and authorization

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** security, authentication

## Context and Problem Statement

HASEB exposes a REST API and a WebSocket channel that need a single
authentication mechanism. The deployment target is initially a single
service per environment, but must scale horizontally.

Which authentication mechanism should HASEB use?

## Decision Drivers

- Stateless verification on every request.
- Same mechanism on REST and WebSocket.
- Compatibility with rate limiting (ADR 0024).
- Operational simplicity (no central session store required for v1).

## Considered Options

1. **JWT (HS256 dev / RS256 production) issued by `/api/v1/auth/login`.**
2. **Server-side sessions in Redis.**
3. **OAuth 2.0 / OIDC against an external IdP.**

## Decision Outcome

**Chosen option: JWT.** HASEB issues short-lived access tokens and longer
refresh tokens. The same JWT validator is used for REST middleware and
WebSocket handshake. OIDC integration is left as a later option, where this
ADR will be superseded.

### Positive Consequences

- Stateless verification keeps the API horizontally scalable.
- The dashboard stores the token client-side and attaches it to both REST
  calls (`Authorization: Bearer ...`) and the WebSocket handshake.
- bcryptjs handles password hashing; rotation policies are explicit.

### Negative Consequences

- Token revocation requires either short lifetimes or a denylist; we use
  short access-token lifetimes (15 minutes) plus refresh-token rotation.
- Loss of the signing secret invalidates all tokens; secrets are managed
  out-of-band.

## Implementation Notes

- Auth routes: `src/api/auth.ts`.
- Hashing: `bcryptjs` with cost factor 12 in production.
- Token signing: `jsonwebtoken` with `HS256` for development, `RS256` in
  production (key files mounted via secret manager).
- Middleware: `src/middleware/validation.ts` adds `req.user` on success.
- WebSocket: `socket.io` middleware verifies the same JWT during handshake.

## Validation

- Penetration test cases under `tests/security` cover token tampering,
  expired tokens, and replay.
- All non-public endpoints require auth; verified by integration tests.

## Links

- ADR 0024 — Security baseline (helmet, CORS, rate limit)
- DDD: [`../ddd/contexts/identity-access-context.md`](../ddd/contexts/identity-access-context.md)
