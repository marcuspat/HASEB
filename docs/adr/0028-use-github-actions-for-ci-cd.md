# ADR 0028: Use GitHub Actions for CI/CD

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** ci-cd, devops

## Context and Problem Statement

HASEB needs continuous integration on every pull request (lint, type
check, tests) and a deployment pipeline for staging and production.

Which CI/CD platform should HASEB use?

## Decision Drivers

- Native integration with GitHub (ADR 0027 — repo on GitHub).
- Marketplace coverage for Postgres services, Playwright, Node.
- Cost and execution-minute model.
- Compatibility with the verification system (ADR 0022).

## Considered Options

1. **GitHub Actions.**
2. **CircleCI.**
3. **GitLab CI.**

## Decision Outcome

**Chosen option: GitHub Actions.** The repo is on GitHub; Actions has the
shortest path from code change to passing/failing check. The marketplace
covers our needs (Postgres service container, Playwright runners, Codecov
upload).

### Positive Consequences

- Workflows live next to the code in `.github/workflows/`.
- PR checks include lint, typecheck, unit, integration, e2e, security,
  and verification jobs.
- Status checks gate merges (verified via branch protection).

### Negative Consequences

- Self-hosted runners may be needed later for heavy benchmark execution;
  the workflow YAML is written to support both managed and self-hosted.

## Implementation Notes

- Required jobs on PR:
  - `lint` — `eslint`, `prettier --check`.
  - `typecheck` — `tsc --noEmit`.
  - `unit` — `jest test/unit`.
  - `integration` — `jest test/integration` against a Postgres service.
  - `e2e` — `playwright test`.
  - `security` — `jest test/security` plus secret scanning.
  - `verify` — `claude-flow@alpha verify` against the truth threshold.
- Deployment workflow on `main`:
  - Build artefacts (`tsc` for backend, `vite build` for frontend).
  - Push container image.
  - Deploy to staging; manual approval to promote.

## Validation

- Branch protection requires all checks to pass.
- A failing verification job blocks merge regardless of other green checks.

## Links

- ADR 0022 — Byzantine-fault-tolerant verification
- ADR 0023 — Use Jest and Playwright for testing
- `.github/workflows/`
