# Tactical Design

This document explains how HASEB applies tactical DDD patterns inside each
bounded context. For per-context detail, see the pages under
[contexts/](./contexts/).

## Building Blocks

### Entities

An **entity** has identity that persists across state changes. Two entities
with the same field values are still different if their identities differ.

In HASEB:

- `Agent` (UUID), `Benchmark` (UUID), `Evaluation` (UUID), `User` (UUID).
- `EvaluationStep` is an entity *inside* the Evaluation aggregate; its
  identity is `(evaluationId, stepIndex)`.
- All entity identifiers are UUID v4 strings unless otherwise noted.

### Value Objects

A **value object** is defined by its attributes; equality is structural.
Value objects are immutable.

In HASEB:

- `Money { amount, currency }`.
- `Duration { milliseconds }`.
- `TokenCount { input, output }`.
- `MetricDimension`, with five subtypes (Performance, Efficiency, Cost,
  Robustness, Quality), each carrying a typed payload.
- `ProcessViabilityScore { value: number; weights: { ... } }`.
- See [value-objects.md](./value-objects.md) for the full catalogue.

### Aggregates

An **aggregate** is a cluster of entities and value objects with a single
**root**. Outside callers reference the aggregate by the root's ID and
mutate it only through the root.

HASEB's aggregates and their roots:

| Aggregate                | Root              | Members                                     |
|--------------------------|-------------------|---------------------------------------------|
| Evaluation               | `Evaluation`      | `EvaluationRun`, `EvaluationStep[]`         |
| Agent                    | `Agent`           | `AgentProfile`, `AgentVersion[]`            |
| Benchmark                | `Benchmark`       | `BenchmarkTask[]`, `OracleSpec`             |
| User                     | `User`            | `Role[]`, `RefreshToken[]`                  |
| MetricSet                | `MetricSet`       | `MetricDimension[]`, `ProcessViabilityScore`|

See [aggregates.md](./aggregates.md) for invariants per aggregate.

### Domain Events

A **domain event** records that something happened in the past, expressed in
the ubiquitous language. Names are past-tense; payloads are immutable.

Examples:

- `EvaluationSubmitted`
- `EvaluationStarted`
- `EvaluationStepRecorded`
- `EvaluationRunCompleted`
- `MetricsCollected`
- `EvaluationCompleted`
- `EvaluationFailed`

See [domain-events.md](./domain-events.md) for the catalogue and schemas.

### Domain Services

A **domain service** holds stateless behaviour that doesn't fit on a single
entity or aggregate. Examples in HASEB:

- `ProcessViabilityCalculator` — composes the five Metric Dimensions into the
  composite score.
- `EvaluationScheduler` — picks the next Evaluation to run from the queue.
- `AgentFingerprinter` — produces a stable hash from an Agent configuration.

See [domain-services.md](./domain-services.md).

### Application Services

An **application service** orchestrates a single use case. It does not
contain business rules; it coordinates aggregates and emits events.

In HASEB:

- `SubmitEvaluation` — validates input, creates the `Evaluation` aggregate,
  enqueues it, emits `EvaluationSubmitted`.
- `ExecuteEvaluation` — drives the LangGraph for one Evaluation.
- `CollectMetrics` — runs the five collectors and persists `MetricSet`.
- `IssueAuthToken` — verifies credentials and issues a JWT.

See [application-services.md](./application-services.md).

### Repositories

One repository per aggregate root. Repositories return aggregates fully
loaded; they never expose the underlying SQL rows.

| Aggregate     | Repository contract                                 |
|---------------|-----------------------------------------------------|
| Evaluation    | `IEvaluationRepository`                             |
| Agent         | `IAgentRepository`                                  |
| Benchmark     | `IBenchmarkRepository`                              |
| User          | `IUserRepository`                                   |
| MetricSet     | `IMetricSetRepository`                              |

See [repositories.md](./repositories.md) for the full contracts.

### Factories

When constructing an aggregate is non-trivial (validation across fields,
default value objects), HASEB uses **factories** rather than burdening the
constructor.

- `EvaluationFactory.fromSubmission(...)` — accepts the API DTO and produces
  a fully-formed `Evaluation` aggregate, or throws a typed validation error.
- `AgentFactory.register(...)` — same pattern for Agent registration.

### Specifications

Where a query rule is reused (e.g. "completed evaluations of agent X within
the last week"), HASEB encodes it as a **specification** that can be applied
in-memory and as a query predicate.

## Layering

```
+---------------------------------------------------+
|                  HTTP / WebSocket                 |  Adapters (Express, socket.io)
+----------------------+----------------------------+
                       |
+----------------------+----------------------------+
|                Application Services               |  Use cases. Coordinate aggregates.
+----------------------+----------------------------+
                       |
+----------------------+----------------------------+
|                  Domain Layer                     |  Aggregates, entities, VOs,
|         (no framework / library imports)          |  domain services, events.
+----------------------+----------------------------+
                       |
+----------------------+----------------------------+
|         Infrastructure: Repositories, ACL         |  pg, sqlite, harness adapters.
+---------------------------------------------------+
```

The domain layer **never** imports `express`, `pg`, `sqlite3`, `socket.io`,
or any harness SDK. Where it needs them, it depends on **ports** (interfaces)
implemented by the infrastructure layer.

## Invariants and Consistency

- **Within an aggregate:** strong consistency. Each aggregate is updated in a
  single transaction.
- **Across aggregates:** eventual consistency via domain events. The
  Metrics aggregate is updated *after* the Evaluation is marked completed.
- **Cross-context references:** by ID only, not by direct object reference.

## Error Handling

- Domain errors are typed and never expose framework details.
- The application service layer translates domain errors into HTTP status
  codes (or WebSocket error events) at the boundary.
- Persistence errors are wrapped by the repository layer and surfaced as
  `RepositoryError` to the application layer.

## Testing Strategy

| Layer                  | Test type                  | Dependencies              |
|------------------------|----------------------------|---------------------------|
| Domain                 | Unit (Jest)                | None                      |
| Application services   | Unit (Jest, mocked ports)  | Test doubles              |
| Repositories           | Integration (Jest)         | SQLite (dev), Postgres CI |
| HTTP adapters          | Integration (supertest)    | Real express + mocked DI  |
| WebSocket adapters     | Integration                | `socket.io` test client   |
| End-to-end             | Playwright                 | Full stack                |
