# ADR 0015: Use PostgreSQL as the primary datastore

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** persistence, database

## Context and Problem Statement

HASEB stores users, agents, benchmarks, evaluation runs, and per-step
metrics. Metrics are inherently semi-structured (different benchmarks
produce different shapes), and we need expressive queries for the
leaderboard and analytics views.

Which primary datastore should HASEB use in production?

## Decision Drivers

- Strong relational semantics for users, agents, benchmarks.
- First-class JSON support (JSONB + GIN indexes) for metrics.
- Operational maturity in managed offerings.
- Connection pooling and observability.

## Considered Options

1. **PostgreSQL (with JSONB for metrics).**
2. **MongoDB.**
3. **MySQL.**
4. **DynamoDB.**

## Decision Outcome

**Chosen option: PostgreSQL.** PostgreSQL gives us strong relational
guarantees for the control plane *and* JSONB plus GIN indexes for
metrics. This avoids splitting the system into two databases.

### Positive Consequences

- Single backup / restore story.
- ACID transactions span control-plane and metrics writes.
- Rich extensions available later (pg_trgm, pgvector if needed).

### Negative Consequences

- Per-step metrics at scale require partitioning; planned via the
  `evaluations` and per-step `evaluation_steps` tables, partitioned by
  month.

## Implementation Notes

- Driver: `pg` with a connection pool in `src/database/connection.ts`.
- Migrations: `src/database/migrations.ts` with explicit up/down scripts.
- Schema documented in `docs/DATABASE_SCHEMA.md`.
- Metrics column shape is JSONB; the `metrics` field has a GIN index.
- Local development uses SQLite (ADR 0016).

## Validation

- Migrations idempotent and reversible in CI.
- Leaderboard queries < 200 ms for 1M evaluation rows in load tests.

## Links

- ADR 0016 — Use SQLite for local development and tests
- ADR 0017 — Repository pattern for persistence
- DDD: [`../ddd/repositories.md`](../ddd/repositories.md)
