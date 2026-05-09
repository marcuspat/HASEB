# Domain Events

Domain events record that *something happened* in the past, expressed in the
ubiquitous language. They are immutable, named in past tense, and carry only
the data their consumers need.

This document is the **published catalogue** of HASEB's domain events. Any
producer or consumer must conform to the schemas here.

## Envelope

Every event shares this envelope:

```ts
type DomainEventEnvelope<TPayload, TName extends string> = {
  readonly eventId: string;        // UUID v4 (idempotency key)
  readonly name: TName;            // dotted, lowercase, past-tense
  readonly version: 1 | 2 | ...;   // schema version of the payload
  readonly occurredAt: string;     // ISO 8601 UTC
  readonly correlationId: string;  // groups events from one workflow
  readonly causationId?: string;   // direct cause event, if any
  readonly producer: string;       // e.g. 'orchestration'
  readonly payload: TPayload;
};
```

- `eventId` is the **idempotency key** for consumers.
- `correlationId` is constant across all events of one Evaluation lifecycle.
- `causationId` is the `eventId` of the event that caused this one (e.g.
  `EvaluationStarted` causes the first `EvaluationStepRecorded`).
- `version` allows backward-incompatible payload evolution without renaming
  the event.

## Naming Rules

- Lowercase, dotted, past-tense: `evaluation.submitted`, `metrics.collected`.
- The first segment is the bounded context: `evaluation.*`, `metrics.*`,
  `agent.*`, `benchmark.*`, `user.*`, `queue.*`, `notifications.*`.

## Catalogue

### Evaluation Context

#### `evaluation.submitted` (v1)
Emitted when an Evaluation is created and queued.

```ts
type Payload = {
  evaluationId: string;
  agentId: string;
  benchmarkId: string;
  submittedById: string;
  submittedAt: string;
};
```

Producer: Evaluation application service.
Consumers: Orchestration (queue), Notifications, Reporting (audit log).

#### `evaluation.started` (v1)
Emitted when the orchestrator picks the Evaluation off the queue and begins
executing the LangGraph for it.

```ts
type Payload = {
  evaluationId: string;
  startedAt: string;
  environmentRef: string;
};
```

Producer: Orchestration. Consumers: Notifications, Reporting.

#### `evaluation.step.recorded` (v1)
Emitted for each observed interaction in the run.

```ts
type Payload = {
  evaluationId: string;
  stepIndex: number;
  recordedAt: string;
  kind: 'tool_call' | 'llm_call' | 'screen_action' | 'other';
  status: 'ok' | 'error';
  summary: string;
};
```

Producer: Orchestration / Execution Agent. Consumers: Notifications, Metrics
(streaming dimension collectors).

#### `evaluation.run.completed` (v1)
Emitted when the run finishes (success or oracle-decided failure) and the
trace is durable. Triggers metrics collection.

```ts
type Payload = {
  evaluationId: string;
  runId: string;
  completedAt: string;
  outcome: 'success' | 'failure';
  failureReason?: string;
};
```

Producer: Orchestration. Consumers: Metrics (primary), Notifications.

#### `evaluation.completed` (v1)
Emitted after metrics are finalised and the Evaluation reaches the terminal
`completed` state.

```ts
type Payload = {
  evaluationId: string;
  completedAt: string;
  metricSetId: string;
};
```

Producer: Evaluation application service. Consumers: Reporting, Notifications.

#### `evaluation.failed` (v1)
Emitted when the Evaluation transitions to `failed`.

```ts
type Payload = {
  evaluationId: string;
  failedAt: string;
  reason: string;
  stage: 'queue' | 'environment' | 'execution' | 'collection' | 'analysis';
};
```

#### `evaluation.cancelled` (v1)
```ts
type Payload = {
  evaluationId: string;
  cancelledAt: string;
  cancelledById: string;
  reason: string;
};
```

### Metrics Context

#### `metrics.dimension.collected` (v1)
Emitted as each dimension is collected (one event per dimension).

```ts
type Payload = {
  evaluationId: string;
  metricSetId: string;
  dimension: 'performance' | 'efficiency' | 'cost' | 'robustness' | 'quality';
  collectedAt: string;
};
```

#### `metrics.finalised` (v1)
Emitted when all five dimensions are present and the Process Viability Score
is computed.

```ts
type Payload = {
  evaluationId: string;
  metricSetId: string;
  finalisedAt: string;
  viabilityScore: number;       // 0.0–1.0
  weightingVersion: string;
};
```

#### `metrics.superseded` (v1)
```ts
type Payload = {
  evaluationId: string;
  metricSetId: string;
  replacesMetricSetId: string;
  reason: string;
};
```

### Agent Management Context

#### `agent.registered` (v1)
```ts
type Payload = {
  agentId: string;
  name: string;
  provider: string;
  fingerprint: string;
  registeredAt: string;
};
```

#### `agent.profile.updated` (v1)
```ts
type Payload = {
  agentId: string;
  newVersionId: string;
  versionNumber: number;
  updatedAt: string;
};
```

#### `agent.archived` (v1)
```ts
type Payload = {
  agentId: string;
  archivedAt: string;
};
```

### Benchmark Catalog Context

#### `benchmark.published` (v1)
```ts
type Payload = {
  benchmarkId: string;
  name: string;
  version: string;
  kind: 'code' | 'gui' | 'reasoning';
  taskCount: number;
  publishedAt: string;
};
```

#### `benchmark.deprecated` (v1)
```ts
type Payload = {
  benchmarkId: string;
  deprecatedAt: string;
  replacedByBenchmarkId?: string;
};
```

### Identity & Access Context

#### `user.registered` (v1), `user.authenticated` (v1), `user.password.changed` (v1), `user.deactivated` (v1)
Standard auth events; payloads carry `userId`, timestamps, and
non-sensitive metadata only (no tokens, no password material).

### Queue / Orchestration

#### `queue.enqueued` (v1) / `queue.dequeued` (v1)
Track the orchestrator queue state. Consumed by Notifications and by the
dashboard's queue widget.

## Event Flow Examples

### Submit and Run an Evaluation

```
User → API
  └─→ evaluation.submitted
        └─→ Orchestrator dequeues
              └─→ evaluation.started
                    └─→ evaluation.step.recorded ×N
                          └─→ evaluation.run.completed
                                └─→ Metrics collects 5 dimensions
                                      └─→ metrics.dimension.collected ×5
                                            └─→ metrics.finalised
                                                  └─→ evaluation.completed
```

### Cancel a Running Evaluation

```
User → API (cancel)
  └─→ evaluation.cancelled
        └─→ Orchestrator aborts the LangGraph
              └─→ evaluation.failed (stage='execution', reason='cancelled')
```

## Idempotency and Ordering

- Consumers MUST treat events idempotently using `eventId`.
- Events for a single Evaluation are produced and delivered in order.
- Cross-evaluation ordering is not guaranteed; consumers must not depend on it.

## Versioning Policy

- A new payload field that is **optional** is a v1-compatible change.
- A new payload field that is **required**, or any change to an existing
  field, requires a new `version` (v2, v3, …) and a transition window where
  both versions are emitted.
- Renaming an event is a new event; the old event is deprecated for at least
  one minor release.

## Persistence

Domain events are not durably stored in v1; they are republished on the
in-process bus and over WebSocket. ADR 0021 describes the eventual move to a
durable event store.
