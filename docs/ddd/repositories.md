# Repositories

A **repository** is the abstraction that gives the domain layer access to
aggregates without depending on the database. There is **one repository per
aggregate root**; cross-aggregate queries are served by **query services**.

This document is the contract catalogue. Every repository contract listed
here must be implementable against both PostgreSQL (production, ADR 0015)
and SQLite (development, ADR 0016).

## Conventions

- Repositories operate on **aggregates**, not on table rows.
- A repository's `save` method is a single transactional unit-of-work for
  the aggregate.
- Repositories never emit domain events; emission is the application
  service's responsibility.
- Reads return the aggregate **fully loaded** (root + members), unless an
  explicit `summary` projection is documented.
- Errors are wrapped as `RepositoryError` subclasses with a typed reason.

## Aggregate Repositories

### `IEvaluationRepository`

```ts
interface IEvaluationRepository {
  save(evaluation: Evaluation): Promise<void>;
  findById(id: EvaluationId): Promise<Evaluation | null>;
  findByIdOrThrow(id: EvaluationId): Promise<Evaluation>;
  // returns lightweight summaries for queue / dashboard, not full aggregates:
  listSummaries(filter: EvaluationFilter, page: Pagination): Promise<Paged<EvaluationSummary>>;
  countByState(state: EvaluationState): Promise<number>;
}
```

Notes:
- `save` upserts the root and the run; steps are appended via
  `appendStep(...)` to avoid loading the full step list on every write.

```ts
interface IEvaluationRepository {
  appendStep(evaluationId: EvaluationId, step: EvaluationStep): Promise<void>;
}
```

### `IAgentRepository`

```ts
interface IAgentRepository {
  save(agent: Agent): Promise<void>;
  findById(id: AgentId): Promise<Agent | null>;
  findByFingerprint(fp: Fingerprint): Promise<Agent | null>;
  list(filter: AgentFilter, page: Pagination): Promise<Paged<AgentSummary>>;
}
```

### `IBenchmarkRepository`

```ts
interface IBenchmarkRepository {
  save(benchmark: Benchmark): Promise<void>;
  findById(id: BenchmarkId): Promise<Benchmark | null>;
  list(filter: BenchmarkFilter, page: Pagination): Promise<Paged<BenchmarkSummary>>;
}
```

### `IUserRepository`

```ts
interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  // refresh tokens are part of the User aggregate
  insertRefreshToken(token: RefreshToken): Promise<void>;
  revokeRefreshToken(tokenId: string): Promise<void>;
}
```

### `IMetricSetRepository`

```ts
interface IMetricSetRepository {
  save(set: MetricSet): Promise<void>;
  findById(id: MetricSetId): Promise<MetricSet | null>;
  findByEvaluationId(id: EvaluationId): Promise<MetricSet | null>;
}
```

## Query Services (read-side)

Read-side queries that span aggregates do **not** belong on repositories.
They go on **query services**, which return read-optimised projections.

### `IEvaluationQueryService`

```ts
interface IEvaluationQueryService {
  recentForAgent(agentId: AgentId, limit: number): Promise<EvaluationSummary[]>;
  byCorrelationId(correlationId: string): Promise<EvaluationSummary[]>;
}
```

### `ILeaderboardQueryService`

```ts
interface ILeaderboardQueryService {
  byBenchmark(benchmarkId: BenchmarkId, slice: LeaderboardSlice): Promise<LeaderboardEntry[]>;
  global(slice: LeaderboardSlice): Promise<LeaderboardEntry[]>;
}
```

### `IAnalyticsQueryService`

```ts
interface IAnalyticsQueryService {
  costByAgent(window: TimeWindow): Promise<CostSummary[]>;
  successRateTrend(agentId: AgentId, window: TimeWindow): Promise<TrendPoint[]>;
}
```

Query services are allowed to use raw SQL with `JOIN`s across aggregate
boundaries. They are read-only by contract; tests assert this.

## Implementation Notes

- The implementation surface lives under `src/database/models/` (today's
  layout uses model classes that combine the repository contract and the
  data mapper). A future refactor will split contracts (`src/domain/...`)
  from implementations (`src/infrastructure/...`).
- Both PostgreSQL and SQLite implementations live in the same module,
  guarded by the active connection's dialect.
- A unit-of-work / transaction handle is passed in by the application
  service; the repository never opens its own transactions for top-level
  operations.

## Testing

| Test type      | Strategy                                                |
|----------------|---------------------------------------------------------|
| Unit           | The application service uses an in-memory implementation of `IXRepository`. |
| Integration    | The real repository is exercised against SQLite in dev / Postgres in CI. |
| Architecture   | A static check rejects raw `pg` / `sqlite3` imports outside `src/database/`. |

## Pagination and Filtering

Shared types live in `src/types/`:

```ts
type Pagination = { offset: number; limit: number };       // limit ≤ 200
type Paged<T> = { items: T[]; total: number; pagination: Pagination };
type TimeWindow = { from: ISODate; to: ISODate };          // exclusive `to`
```

All list endpoints use these shapes; clients can rely on them as a
Published Language.
