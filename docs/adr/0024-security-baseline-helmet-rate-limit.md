# ADR 0024: Use Helmet, CORS, and rate limiting for security baseline

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** security

## Context and Problem Statement

HASEB exposes a public API and a dashboard. Even before authentication
(ADR 0014) is considered, the API needs a baseline against common web
vulnerabilities (XSS, clickjacking, insecure defaults) and against abuse
(brute force, scraping, DoS).

What is the minimum security baseline for the HASEB API?

## Decision Drivers

- Defense-in-depth against OWASP Top 10.
- Out-of-the-box configuration that is secure by default.
- Compatibility with Express 5 (ADR 0011).
- Compatibility with WebSocket on the same server (ADR 0012).

## Considered Options

1. **Helmet + CORS + `express-rate-limit` + input validation middleware.**
2. **An external WAF only.**
3. **Custom hand-rolled middleware.**

## Decision Outcome

**Chosen option: `helmet` + `cors` + `express-rate-limit` + a validation
middleware.** Each addresses a distinct class of risk and they compose
cleanly.

### Positive Consequences

- HTTP security headers (CSP, HSTS, X-Frame-Options) by default.
- Origin allow-list for the dashboard via `cors`.
- Per-route limits for sensitive endpoints (login, registration).
- Centralised input validation in `src/middleware/validation.ts`.

### Negative Consequences

- Some Helmet defaults break Swagger UI in development; we relax CSP for
  the `/api-docs` route only.

## Implementation Notes

- Stack:
  - `helmet()` first in the middleware chain.
  - `cors({ origin: process.env.ALLOWED_ORIGINS })`.
  - `express-rate-limit` per-route, with stricter limits on auth endpoints.
  - `morgan` for access logs (security-relevant, redact tokens).
  - `compression` for gzip.
- Errors propagate through `src/middleware/errorHandler.ts` which never
  echoes stack traces to clients in production.

## Validation

- `tests/security/` covers tampered tokens, header spoofing, and rate-limit
  bypass attempts.
- A weekly secret-scanning run is configured against the repo.

## Links

- ADR 0011 — Use Express 5 for the HTTP API
- ADR 0014 — JWT authentication
- ADR 0025 — Use Winston for structured logging
