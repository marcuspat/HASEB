# Entities

This document catalogues the entities in HASEB. An **entity** has identity
that persists across changes; equality is by identity, not by value.

For full aggregate semantics see [aggregates.md](./aggregates.md). For value
objects (no identity) see [value-objects.md](./value-objects.md).

## Identity Conventions

- Entity identifiers are UUID v4 strings.
- Identifiers are assigned at creation time; they never change.
- Composite identities (`evaluationId + stepIndex`) are used for entities
  that are unique only within their aggregate.

## Catalogue

### `Evaluation` (aggregate root)

| Field             | Type                                       |
|-------------------|--------------------------------------------|
| `id`              | UUID                                       |
| `agentId`         | UUID (Agent)                               |
| `benchmarkId`     | UUID (Benchmark)                           |
| `submittedById`   | UUID (User)                                |
| `state`           | `EvaluationState` value object             |
| `submittedAt`     | timestamp                                  |
| `startedAt`       | timestamp \| null                          |
| `completedAt`     | timestamp \| null                          |
| `runId`           | UUID (EvaluationRun)                       |
| `metricSetId`     | UUID \| null (MetricSet, in Metrics ctx)   |
| `failureReason`   | string \| null                             |

### `EvaluationRun`

The durable trace owned by Evaluation.

| Field             | Type                                |
|-------------------|-------------------------------------|
| `id`              | UUID                                |
| `evaluationId`    | UUID                                |
| `startedAt`       | timestamp                           |
| `completedAt`     | timestamp \| null                   |
| `environmentRef`  | string (e.g. container ID)          |
| `outcome`         | `RunOutcome` value object           |

### `EvaluationStep`

Identity is composite: `(evaluationId, stepIndex)`.

| Field             | Type                                  |
|-------------------|---------------------------------------|
| `evaluationId`    | UUID                                  |
| `stepIndex`       | integer ≥ 0                           |
| `recordedAt`      | timestamp                             |
| `kind`            | `StepKind` (`tool_call`, `llm_call`, `screen_action`, `other`) |
| `payload`         | JSON value (typed per `kind`)         |
| `status`          | `StepStatus` (`ok`, `error`)          |

### `Agent` (aggregate root)

| Field             | Type                              |
|-------------------|-----------------------------------|
| `id`              | UUID                              |
| `name`            | string                            |
| `provider`        | string                            |
| `state`           | `AgentState` (`active`, `archived`) |
| `activeVersionId` | UUID (AgentVersion)               |
| `createdAt`       | timestamp                         |
| `updatedAt`       | timestamp                         |

### `AgentVersion`

| Field             | Type                              |
|-------------------|-----------------------------------|
| `id`              | UUID                              |
| `agentId`         | UUID                              |
| `versionNumber`   | integer (monotonic)               |
| `profile`         | `AgentProfile` value object       |
| `fingerprint`     | string (hash)                     |
| `createdAt`       | timestamp                         |

### `Benchmark` (aggregate root)

| Field                | Type                              |
|----------------------|-----------------------------------|
| `id`                 | UUID                              |
| `name`               | string                            |
| `version`            | string                            |
| `kind`               | `BenchmarkKind` (`code`, `gui`, `reasoning`) |
| `state`              | `BenchmarkState` (`active`, `deprecated`) |
| `previousVersionId`  | UUID \| null                      |
| `oracleSpec`         | `OracleSpec` value object         |
| `taskCount`          | integer                           |
| `publishedAt`        | timestamp                         |

### `BenchmarkTask`

Identity is composite: `(benchmarkId, externalTaskId)`.

| Field                | Type                              |
|----------------------|-----------------------------------|
| `benchmarkId`        | UUID                              |
| `externalTaskId`     | string (from upstream)            |
| `tags`               | string[]                          |
| `payload`            | JSON value (per kind)             |

### `User` (aggregate root)

| Field             | Type                              |
|-------------------|-----------------------------------|
| `id`              | UUID                              |
| `email`           | string (unique)                   |
| `passwordHash`    | string (bcrypt)                   |
| `displayName`     | string                            |
| `roles`           | `Role[]` (value objects)          |
| `state`           | `UserState` (`active`, `disabled`)|
| `createdAt`       | timestamp                         |
| `lastLoginAt`     | timestamp \| null                 |

### `RefreshToken`

| Field             | Type                              |
|-------------------|-----------------------------------|
| `id`              | UUID                              |
| `userId`          | UUID                              |
| `tokenHash`       | string                            |
| `issuedAt`        | timestamp                         |
| `expiresAt`       | timestamp                         |
| `revokedAt`       | timestamp \| null                 |

### `MetricSet` (aggregate root)

| Field                  | Type                                  |
|------------------------|---------------------------------------|
| `id`                   | UUID                                  |
| `evaluationId`         | UUID                                  |
| `state`                | `MetricSetState` (`open`, `finalised`, `superseded`) |
| `dimensions`           | `MetricDimension[]` (value objects)   |
| `viabilityScore`       | `ProcessViabilityScore` \| null       |
| `replacesMetricSetId`  | UUID \| null                          |
| `createdAt`            | timestamp                             |
| `finalisedAt`          | timestamp \| null                     |

## Persistence Mapping

| Entity            | Source file (model)                                      |
|-------------------|----------------------------------------------------------|
| Evaluation        | `src/database/models/Evaluation.ts`                      |
| Agent             | `src/database/models/Agent.ts`                           |
| Benchmark         | `src/database/models/Benchmark.ts`                       |
| User              | `src/database/models/User.ts`                            |
| MetricSet         | (planned) `src/database/models/MetricSet.ts`             |

The mappers translate between the SQL row shape (with snake_case columns)
and the entity shape (camelCase) in a single place per repository.
