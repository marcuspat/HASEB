# ADR 0017: Use the Repository pattern for persistence

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** persistence, ddd, architecture

## Context and Problem Statement

HASEB's domain logic must not depend on the SQL dialect (PostgreSQL vs
SQLite) or on raw SQL strings sprinkled across the codebase. Aggregates
need a stable boundary for persistence.

How should HASEB structure data access?

## Decision Drivers

- Domain code testable without a real database.
- Single place to enforce aggregate invariants on save.
- Compatibility with the SPARC + TDD methodology (ADR 0002).
- Compatibility with future ORM adoption.

## Considered Options

1. **Repository pattern**, one repository per aggregate root, hand-written
   data mappers.
2. **ORM-driven approach** (Prisma / TypeORM) with active records.
3. **Raw SQL in service classes.**

## Decision Outcome

**Chosen option: Repository pattern with hand-written data mappers.**
Repositories live in `src/database/models/` and expose verbs at the
aggregate level (`AgentRepository.findById`, `EvaluationRepository.save`).
Inner SQL is dialect-agnostic where possible and isolated when not.

### Positive Consequences

- Domain services depend on `IRepository` interfaces, not on `pg.Client`.
- Easy to swap SQLite → PostgreSQL (ADR 0016) without touching domain code.
- Aggregate boundaries enforced in code review (no cross-aggregate joins
  inside a single repository method).

### Negative Consequences

- More boilerplate than an ORM; counterbalanced by the absence of ORM
  surprises (lazy loading, n+1).

## Implementation Notes

- One repository per aggregate root: `Agent`, `Benchmark`, `Evaluation`,
  `User`.
- Read-side projections (leaderboards, trend charts) are *not* served via
  aggregate repositories — they are served by query services that talk to
  the database directly with read-optimised SQL.
- Unit-of-work / transaction handling is explicit at the application
  service layer.

## Validation

- All persistence calls go through a repository or a query service.
- A static check rejects raw `pg.Client` imports outside `src/database/`.

## Links

- ADR 0003 — Adopt Domain-Driven Design
- ADR 0015 — Use PostgreSQL as the primary datastore
- DDD: [`../ddd/repositories.md`](../ddd/repositories.md)
