# Application Services

Application services are the **use cases** of HASEB. Each one corresponds
to a single intent (submit an Evaluation, register an Agent, issue a
token). They are *thin*: they orchestrate aggregates and emit events but
contain no business rules.

Controllers (HTTP routes, WebSocket handlers, CLI entry points) call
application services. Application services call domain services and
repositories. The dependency graph is one-directional.

```
HTTP route ──▶ Application Service ──▶ Aggregate (commands)
                       │                  ▲
                       │                  │
                       ▼                  │
                Repositories  ────────────┘
                       │
                       ▼
                Domain Events ───▶ Subscribers
```

## Use-Case Catalogue

### Identity & Access

| Use case                | Application service          | HTTP route                      |
|-------------------------|------------------------------|---------------------------------|
| Register a user         | `RegisterUser`               | `POST /api/v1/auth/register`    |
| Issue auth token        | `IssueAuthToken`             | `POST /api/v1/auth/login`       |
| Refresh access token    | `RefreshAuthToken`           | `POST /api/v1/auth/refresh`     |
| Logout                  | `RevokeRefreshToken`         | `POST /api/v1/auth/logout`      |
| Change password         | `ChangePassword`             | `POST /api/v1/auth/password`    |

### Agent Management

| Use case                  | Application service       | HTTP route                          |
|---------------------------|---------------------------|-------------------------------------|
| Register an agent         | `RegisterAgent`           | `POST /api/v1/agents`               |
| Update agent profile      | `UpdateAgentProfile`      | `PATCH /api/v1/agents/{id}`         |
| Archive an agent          | `ArchiveAgent`            | `DELETE /api/v1/agents/{id}`        |
| List agents               | `ListAgents` (query)      | `GET /api/v1/agents`                |
| Get an agent              | `GetAgent` (query)        | `GET /api/v1/agents/{id}`           |

### Benchmark Catalog

| Use case                  | Application service       | HTTP route                          |
|---------------------------|---------------------------|-------------------------------------|
| Publish a benchmark       | `PublishBenchmark`        | `POST /api/v1/benchmarks`           |
| Deprecate a benchmark     | `DeprecateBenchmark`      | `POST /api/v1/benchmarks/{id}/deprecate` |
| List benchmarks           | `ListBenchmarks` (query)  | `GET /api/v1/benchmarks`            |
| Get a benchmark           | `GetBenchmark` (query)    | `GET /api/v1/benchmarks/{id}`       |

### Evaluation

| Use case                       | Application service       | HTTP route                                  |
|--------------------------------|---------------------------|---------------------------------------------|
| Submit an Evaluation           | `SubmitEvaluation`        | `POST /api/v1/evaluations`                  |
| Cancel an Evaluation           | `CancelEvaluation`        | `POST /api/v1/evaluations/{id}/cancel`      |
| List Evaluations               | `ListEvaluations` (query) | `GET /api/v1/evaluations`                   |
| Get an Evaluation              | `GetEvaluation` (query)   | `GET /api/v1/evaluations/{id}`              |
| Replay an Evaluation Run       | `ReplayEvaluationRun`     | `POST /api/v1/evaluations/{id}/replay`      |

### Orchestration (internal)

| Use case                             | Application service           |
|--------------------------------------|-------------------------------|
| Execute one Evaluation end-to-end    | `ExecuteEvaluation`           |
| Pick next Evaluation from queue      | `DispatchNextEvaluation`      |
| Recover stalled Evaluations          | `ReconcileStalledEvaluations` |

### Metrics

| Use case                       | Application service           | Trigger                                |
|--------------------------------|-------------------------------|----------------------------------------|
| Collect dimensions for a run   | `CollectMetrics`              | event `evaluation.run.completed`       |
| Recompute metrics              | `RecomputeMetrics`            | manual / admin                         |

### Reporting & Analytics

| Use case                   | Application service         | HTTP route                            |
|----------------------------|-----------------------------|---------------------------------------|
| Get the Leaderboard        | `GetLeaderboard` (query)    | `GET /api/v1/leaderboard`             |
| Get an Agent's trend       | `GetAgentTrend` (query)     | `GET /api/v1/agents/{id}/trend`       |
| Get cost analytics         | `GetCostAnalytics` (query)  | `GET /api/v1/analytics/cost`          |

## Service Anatomy (template)

Application services follow a consistent shape:

```ts
class SubmitEvaluation {
  constructor(
    private readonly agents: IAgentRepository,
    private readonly benchmarks: IBenchmarkRepository,
    private readonly evaluations: IEvaluationRepository,
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: SubmitEvaluationInput): Promise<EvaluationId> {
    // 1. Authorize (caller's userId carried in input).
    // 2. Validate references exist and are in valid states.
    const agent = await this.agents.findById(input.agentId);
    const benchmark = await this.benchmarks.findById(input.benchmarkId);
    if (!agent || agent.state === 'archived') throw new InvalidAgentError();
    if (!benchmark || benchmark.state === 'deprecated') throw new InvalidBenchmarkError();

    // 3. Construct the aggregate via factory.
    const evaluation = EvaluationFactory.fromSubmission({ ...input, now: this.clock.now() });

    // 4. Persist transactionally.
    await this.evaluations.save(evaluation);

    // 5. Emit the domain event.
    await this.events.publish('evaluation.submitted', toSubmittedPayload(evaluation));

    return evaluation.id;
  }
}
```

## Conventions

- **One use case per class.** No "service" classes that sprout dozens of
  methods.
- **Inputs are typed DTOs**, not raw Express request bodies. Translation
  happens at the controller layer.
- **No HTTP / framework imports** in application services.
- **Errors are typed.** Controllers map them to HTTP responses; nothing
  framework-specific leaks back into the service.
- **Idempotency.** Use cases that are externally retried (event consumers,
  webhook handlers) accept an idempotency key.
- **Transactions** are opened by the application service via a unit-of-work
  passed to repositories, not inside repositories themselves.

## Source Layout

| Layer                        | Source location              |
|------------------------------|------------------------------|
| HTTP controllers             | `src/api/*.ts`               |
| Application services         | `src/api/*.ts` (today, planned to move to `src/application/`) |
| Domain services              | `src/services/`              |
| Repositories                 | `src/database/models/`       |
| Event publication            | `src/orchestrator/WebSocketManager.ts` (in-process bus) |

A future refactor will extract application services into `src/application/`
to make the layering explicit.
