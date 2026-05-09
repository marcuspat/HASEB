# ADR 0016: Use SQLite for local development and tests

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** persistence, database, dx

## Context and Problem Statement

PostgreSQL is the production datastore (ADR 0015) but requires a running
service. Contributors and CI must be able to spin up an isolated database
in seconds.

Which database should HASEB use for local development and tests?

## Decision Drivers

- Zero-install setup for new contributors.
- Fast suite runtime (Jest unit + integration tests).
- Schema parity with the production database.
- Compatibility with the same repository code.

## Considered Options

1. **SQLite for dev/tests; PostgreSQL in production.**
2. **Dockerized PostgreSQL everywhere.**
3. **In-memory pglite.**

## Decision Outcome

**Chosen option: SQLite for dev/tests, PostgreSQL in production.** SQLite
keeps the contributor onboarding path frictionless and tests fast; the
repository layer (ADR 0017) abstracts the differences. Where queries
require Postgres-only features (e.g. JSONB GIN), they are guarded by
parameterised builders and integration tests run against PostgreSQL in CI.

### Positive Consequences

- `npm test` runs against an in-process SQLite without any setup.
- Migrations are split into a SQLite path and a PostgreSQL path, both
  exercised in CI.

### Negative Consequences

- Two SQL dialects to support; we constrain our SQL to a portable subset
  and isolate Postgres-specific features behind named functions.

## Implementation Notes

- SQLite migrations: `src/database/sqlite-migrations.ts`.
- PostgreSQL migrations: `src/database/migrations.ts`.
- Connection abstraction selects driver based on `DATABASE_URL`.
- Integration tests against PostgreSQL run on every PR via GitHub Actions.

## Validation

- Test suite runs end-to-end without external services in < 2 minutes.
- CI runs the integration suite against PostgreSQL with full migration
  coverage.

## Links

- ADR 0015 — Use PostgreSQL as the primary datastore
- ADR 0017 — Repository pattern for persistence
