# Integration Patterns

This document collects the wire formats, event payloads, and HTTP contracts
that bind HASEB's bounded contexts together and to external clients.

For per-context detail, see the pages in [contexts/](./contexts/). For
event schemas, see [domain-events.md](./domain-events.md). For ACLs to
external systems, see [anti-corruption-layers.md](./anti-corruption-layers.md).

## 1. HTTP REST (Open Host Service)

### Versioning

- Mount path: `/api/v1`. A breaking change opens `/api/v2` while v1
  continues serving for at least one minor release.
- Content type: `application/json; charset=utf-8`.
- Authentication: `Authorization: Bearer <jwt>` for all non-public routes
  (see ADR 0014).

### Standard response envelope

Success:
```json
{
  "data": { ... },
  "meta": { "requestId": "uuid", "page": { "offset": 0, "limit": 20, "total": 142 } }
}
```

Error:
```json
{
  "error": {
    "code": "INVALID_AGENT",
    "message": "Agent is archived and cannot be evaluated.",
    "details": { "agentId": "uuid" },
    "requestId": "uuid"
  }
}
```

Error codes are domain-flavoured (`INVALID_AGENT`, `BENCHMARK_DEPRECATED`,
`EVALUATION_NOT_CANCELLABLE`, …). HTTP status mapping is documented per
endpoint in [`docs/API_SPECIFICATIONS.md`](../API_SPECIFICATIONS.md).

### Pagination, filtering, sorting

- `?offset=0&limit=20` for pagination; `limit ≤ 200`.
- `?filter[state]=running&filter[agentId]=uuid` for filters; arrays as
  comma-separated.
- `?sort=-createdAt` for sorting; `-` is descending.

### Idempotency

- Mutating routes accept an `Idempotency-Key` header. The application
  service stores `(key → resourceId)` for at least 24 hours.

## 2. WebSocket (Open Host Service)

### Connection

- URL: `wss://<host>/ws`.
- Authentication: JWT in the connection query string or
  `Authorization` header.
- Library: `socket.io` (server) and `socket.io-client` (browser).

### Channels / topics

| Topic                          | Payload type                | Subscribed by               |
|--------------------------------|-----------------------------|-----------------------------|
| `evaluation:{evaluationId}`    | `evaluation.*` events       | dashboard run page          |
| `metrics:{evaluationId}`       | `metrics.*` events          | dashboard run page          |
| `queue`                        | `queue.*` events            | dashboard queue widget      |
| `notifications:{userId}`       | per-user notifications      | dashboard layout            |

### Subscription protocol

```
client -> server: { type: 'subscribe', topic: 'evaluation:abc-123' }
server -> client: { type: 'subscribed', topic: 'evaluation:abc-123' }
server -> client: { type: 'event', envelope: { ...DomainEventEnvelope } }
```

### Backpressure and replay

- Each subscription returns the **last 100 events** for the topic on
  connect (a small replay buffer in memory). For full replay, clients use
  the REST endpoint that returns the persisted run.
- Slow clients are dropped if their queue depth exceeds 1024 events.

## 3. Inter-Context Integration

### Pattern: Application service call

Used when the call is synchronous and the contexts are tightly coupled
(e.g. Orchestration calling Benchmark Catalog to fetch a `Benchmark`).

- Caller obtains the application service via dependency injection.
- Caller passes typed DTOs (no aggregates across context boundaries).
- The application service returns a typed result or raises a typed error.

### Pattern: Domain event subscription

Used for asynchronous, decoupled flows (Metrics consuming
`evaluation.run.completed`).

- Producer publishes via `DomainEventPublisher`.
- Consumer registers interest via the in-process bus (today) or by
  subscribing to a durable broker (future, see ADR 0021).
- Consumers MUST be idempotent on `eventId`.

### Pattern: Read model query

Used for cross-aggregate read-only queries (Reporting context reading
Evaluation + Agent + Benchmark + MetricSet for the Leaderboard).

- Implemented by query services (see [repositories.md](./repositories.md)).
- Query services may use raw SQL with joins.
- Query services may **not** mutate.

## 4. Persistence Integration

- Migrations live in `src/database/migrations.ts` (PostgreSQL) and
  `src/database/sqlite-migrations.ts` (SQLite). Both are exercised in CI.
- The schema is documented in [`docs/DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md).
- JSONB is used for variable-shape data (Metric Dimensions, payloads).
- All `created_at` / `updated_at` columns are UTC.

## 5. External Integrations

| External system           | Integration mechanism            | ACL location                              |
|---------------------------|----------------------------------|-------------------------------------------|
| SWE-bench                 | Subprocess + stdout transcripts  | `src/agents/SWE_Bench_Agent.ts`           |
| OSWorld / WebArena        | Headless browser driver          | `src/agents/GUI_Automation_Agent.ts`      |
| GAIA / AgentBench         | HTTP / library API               | `src/agents/General_Reasoning_Agent.ts`   |
| LLM providers             | Provider SDKs                    | `src/services/metrics/CostMetricsCollector.ts` |

See [anti-corruption-layers.md](./anti-corruption-layers.md) for the rules
that govern these.

## 6. Time, IDs, and Locale

- All times: ISO 8601 strings with explicit timezone, UTC at rest.
- All IDs: UUID v4 strings.
- Locale: dashboards format times in the viewer's local timezone; APIs
  return UTC.

## 7. Backwards-Compatibility Contract

When a context publishes a contract (REST, WebSocket, or domain event), it
makes the following guarantees:

- Adding optional fields is non-breaking.
- Adding new endpoints / topics / event names is non-breaking.
- Removing or repurposing fields requires a new version (`/api/v2`,
  payload `version: 2`).
- Deprecations follow the policy in [domain-events.md](./domain-events.md).
