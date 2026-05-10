# Domain-Driven Design Documentation

This directory documents HASEB's domain model using Domain-Driven Design (DDD).
The goal is a single, navigable reference that contributors and AI agents can
read before touching the domain layer, so changes respect bounded contexts and
preserve invariants.

> See **ADR 0003 — Adopt Domain-Driven Design** for the rationale, and
> **ADR 0017 — Repository pattern** for the persistence approach.

## How to read this directory

Read top-to-bottom for a guided tour of the domain, or jump straight to the
context you are working on.

### 1. Strategic design (the big picture)

| Document                                            | Purpose                                                                |
|-----------------------------------------------------|------------------------------------------------------------------------|
| [domain-overview.md](./domain-overview.md)          | One-page elevator pitch of the domain.                                 |
| [ubiquitous-language.md](./ubiquitous-language.md)  | Glossary every contributor must use.                                   |
| [subdomains.md](./subdomains.md)                    | Core / Supporting / Generic classification.                            |
| [bounded-contexts.md](./bounded-contexts.md)        | Catalogue of bounded contexts.                                         |
| [context-map.md](./context-map.md)                  | Relationships between contexts (Customer/Supplier, ACL, Conformist).   |
| [strategic-design.md](./strategic-design.md)        | Patterns at the system level (ACL, OHS, Published Language).           |

### 2. Tactical design (the building blocks)

| Document                                              | Purpose                                                              |
|-------------------------------------------------------|----------------------------------------------------------------------|
| [tactical-design.md](./tactical-design.md)            | How aggregates, entities, VOs, services, and events fit together.    |
| [aggregates.md](./aggregates.md)                      | Aggregate roots, invariants, and consistency boundaries.             |
| [entities.md](./entities.md)                          | Catalogue of entities and identity rules.                            |
| [value-objects.md](./value-objects.md)                | Catalogue of value objects (immutability + equality).                |
| [domain-events.md](./domain-events.md)                | Event catalogue, schemas, and producers / consumers.                 |
| [domain-services.md](./domain-services.md)            | Stateless domain operations that don't belong on aggregates.         |
| [application-services.md](./application-services.md)  | Use-case orchestration; entry points from controllers.               |
| [repositories.md](./repositories.md)                  | Repository contracts per aggregate root.                             |
| [anti-corruption-layers.md](./anti-corruption-layers.md) | Translation layers between contexts and external systems.         |
| [integration-patterns.md](./integration-patterns.md)  | Wire formats, event payloads, and HTTP contracts between contexts.   |

### 3. Per-context detailed design

| Context                                                                                  | Type                  |
|------------------------------------------------------------------------------------------|-----------------------|
| [Evaluation](./contexts/evaluation-context.md)                                           | Core                  |
| [Orchestration](./contexts/orchestration-context.md)                                     | Core                  |
| [Agent Management](./contexts/agent-context.md)                                          | Core                  |
| [Benchmark Catalog](./contexts/benchmark-context.md)                                     | Supporting            |
| [Metrics](./contexts/metrics-context.md)                                                 | Core                  |
| [Reporting & Analytics](./contexts/reporting-context.md)                                 | Supporting            |
| [Identity & Access](./contexts/identity-access-context.md)                               | Generic               |
| [Notifications & Real-time](./contexts/notifications-context.md)                         | Supporting            |

## Conventions

- **Ubiquitous language** is enforced. The glossary is authoritative; class,
  table, and event names must come from it.
- **Aggregate references** between contexts are by **identity only** (UUID),
  never by direct object reference. Cross-context navigation goes through
  application services or domain events.
- **Repositories** are one-per-aggregate-root. Read-side queries that span
  aggregates use **query services**, not repositories.
- **Domain events** are immutable, past-tense, and carry only the data needed
  by their consumers (no full aggregate snapshots unless explicitly required).
- **Anti-corruption layers** wrap every external system (LLM provider,
  benchmark harness, GUI environment) so the domain core never sees their
  vocabulary.

## Source layout mapping

| DDD concept              | Source location                                       |
|--------------------------|-------------------------------------------------------|
| Aggregates / entities    | `src/database/models/`, `src/types/`                  |
| Domain services          | `src/services/`                                       |
| Application services     | `src/api/` (controllers thin, services thick)         |
| Orchestration            | `src/orchestrator/`                                   |
| Execution agents (ACL)   | `src/agents/`                                         |
| Repositories             | `src/database/models/` (mappers + queries)            |
| Read models / projections | `src/database/` (query services)                     |
| Domain events            | `src/orchestrator/WebSocketManager.ts` (publication)  |
| Shared types             | `src/types/`                                          |
