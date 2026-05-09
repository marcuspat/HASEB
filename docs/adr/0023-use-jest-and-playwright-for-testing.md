# ADR 0023: Use Jest and Playwright for testing

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** testing, quality

## Context and Problem Statement

HASEB requires a layered test strategy: unit tests for domain code,
integration tests for adapters and the database, and end-to-end tests for
the dashboard. The methodology (ADR 0002) requires tests to be both fast
and faithful.

Which test runners should HASEB adopt?

## Decision Drivers

- Test pyramid coverage from unit to e2e.
- TypeScript and ESM friendliness.
- Visual regression and browser automation.
- Compatibility with CI runners (GitHub Actions).

## Considered Options

1. **Jest for unit + integration; Playwright for e2e.**
2. **Vitest only.**
3. **Mocha + Chai + Cypress.**

## Decision Outcome

**Chosen option: Jest + Playwright.** Jest covers unit and integration
tests with `ts-jest` and the experimental ESM VM modules flag; Playwright
gives us cross-browser e2e with screenshots and trace viewer.

### Positive Consequences

- Single Jest configuration covers most of the test pyramid.
- Playwright produces high-signal e2e diagnostics (traces, videos) for
  flake investigation.
- `@testing-library/react` integrates cleanly with Jest's jsdom env.

### Negative Consequences

- Jest's ESM support is still flagged; `NODE_OPTIONS='--experimental-vm-modules'`
  is required and is set in `package.json` scripts.

## Implementation Notes

- Jest config: `jest.config.js`; environments split between `node` and
  `jsdom` per project.
- Test layout:
  - `tests/unit/` — pure domain tests with mocked ports.
  - `tests/integration/` — DB and HTTP adapters.
  - `tests/orchestration/` — LangGraph orchestrator tests.
  - `tests/agents/` — execution-agent tests.
  - `tests/security/` — auth / rate-limit / input validation tests.
  - `tests/e2e/` — Playwright dashboard tests.
- Coverage target: 90 % across `src/`.

## Validation

- `npm run test:coverage` ≥ 90 %.
- Playwright suite runs green on Chromium, Firefox, and WebKit in CI.

## Links

- ADR 0002 — Adopt SPARC + TDD methodology
- ADR 0028 — Use GitHub Actions for CI/CD
