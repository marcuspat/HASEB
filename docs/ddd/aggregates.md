# Aggregates

Aggregates are the unit of consistency in HASEB. Outside callers reference
the aggregate by the root's identity (UUID) and never reach into its
internals.

This document is the catalogue. Each aggregate has:

- A **root** (the entity through which all changes flow).
- A list of **invariants** (conditions that must always hold).
- A list of **commands** (the verbs the application layer uses on it).
- A list of **events** (what gets emitted on each successful command).

## 1. Evaluation Aggregate (Core)

The central aggregate of HASEB.

**Root:** `Evaluation`

**Members:**
- `EvaluationRun` — the durable trace of the agent's interaction (1-to-1).
- `EvaluationStep[]` — ordered observed interactions (0-to-N).

**Invariants:**

1. The lifecycle states form a strict DAG: `queued → running → collecting →
   analyzing → completed | failed | cancelled`. No state may be skipped, and
   a terminal state is final.
2. An Evaluation references exactly one `agentId` and one `benchmarkId`.
   Both must exist when the Evaluation is created (validated at the
   application layer).
3. `EvaluationStep.stepIndex` is contiguous and starts at 0 within an
   Evaluation.
4. `EvaluationStep.recordedAt` is monotonically non-decreasing within an
   Evaluation.
5. `EvaluationRun.completedAt` is set if and only if the state is `completed`
   or `failed`.
6. Cancellation is allowed only from `queued` or `running`.

**Commands:**

| Command                     | Pre-state                        | Post-state              |
|-----------------------------|----------------------------------|-------------------------|
| `submit(...)`               | (none — factory)                 | `queued`                |
| `start()`                   | `queued`                         | `running`               |
| `recordStep(step)`          | `running`                        | `running`               |
| `markRunCompleted()`        | `running`                        | `collecting`            |
| `attachMetrics(metricSet)`  | `collecting`                     | `analyzing`             |
| `markCompleted()`           | `analyzing`                      | `completed`             |
| `fail(reason)`              | any non-terminal                 | `failed`                |
| `cancel(reason)`            | `queued` or `running`            | `cancelled`             |

**Events Emitted:**

- `EvaluationSubmitted`
- `EvaluationStarted`
- `EvaluationStepRecorded`
- `EvaluationRunCompleted`
- `EvaluationCompleted`
- `EvaluationFailed`
- `EvaluationCancelled`

**Repository:** `IEvaluationRepository`.

## 2. Agent Aggregate (Core)

The Agent under evaluation. Distinct from Execution Agents.

**Root:** `Agent`

**Members:**
- `AgentProfile` — provider, model, configuration (1-to-1).
- `AgentVersion[]` — historical versions of the configuration (immutable).

**Invariants:**

1. `agent.fingerprint` is a deterministic hash of the active `AgentProfile`.
2. `AgentVersion` records are immutable; updating a profile produces a new
   version and updates the active pointer.
3. An Agent in state `archived` cannot be selected for new Evaluations.
4. An Agent must have a non-empty `provider` and a non-empty `name`.

**Commands:**

| Command                       | Effect                                                  |
|-------------------------------|---------------------------------------------------------|
| `register(profile)`           | Creates the Agent and the initial AgentVersion.         |
| `updateProfile(profile)`      | Appends a new AgentVersion; updates active fingerprint. |
| `archive()`                   | Marks the Agent unavailable for new Evaluations.        |

**Events:**

- `AgentRegistered`
- `AgentProfileUpdated`
- `AgentArchived`

**Repository:** `IAgentRepository`.

## 3. Benchmark Aggregate (Supporting)

A benchmark suite (e.g. SWE-bench v2.1).

**Root:** `Benchmark`

**Members:**
- `BenchmarkTask[]` — the task corpus (immutable per version).
- `OracleSpec` — how a task attempt is scored.

**Invariants:**

1. `Benchmark.version` is immutable. New versions produce new aggregates,
   linked via `previousVersionId`.
2. The task corpus and oracle are pinned to the version.
3. A Benchmark with state `deprecated` cannot be selected for new Evaluations
   but remains queryable for historical Leaderboard slices.

**Commands:**

| Command                     | Effect                                                |
|-----------------------------|-------------------------------------------------------|
| `publish(...)`              | Creates a new Benchmark with a fixed task corpus.     |
| `deprecate()`               | Marks the Benchmark deprecated.                       |

**Events:**

- `BenchmarkPublished`
- `BenchmarkDeprecated`

**Repository:** `IBenchmarkRepository`.

## 4. User Aggregate (Generic)

**Root:** `User`

**Members:**
- `Role[]`
- `RefreshToken[]` (active session anchors)

**Invariants:**

1. `email` is unique across the system.
2. `passwordHash` is bcrypt-hashed; raw passwords never enter the aggregate.
3. A `RefreshToken` is associated with exactly one User and is invalidated
   on logout or rotation.

**Commands:** `register`, `authenticate`, `rotateRefreshToken`,
`changePassword`, `assignRole`, `revokeRole`, `deactivate`.

**Events:** `UserRegistered`, `UserAuthenticated`, `UserPasswordChanged`,
`UserDeactivated`.

**Repository:** `IUserRepository`.

## 5. MetricSet Aggregate (Core)

The container for one Evaluation's measurements.

**Root:** `MetricSet`

**Members:**
- `MetricDimension[]` — exactly one of each of the five families.
- `ProcessViabilityScore` — composite score (1-to-1).

**Invariants:**

1. A MetricSet is associated with exactly one Evaluation.
2. All five Metric Dimensions are present once a MetricSet is `finalised`.
3. `ProcessViabilityScore.value ∈ [0.0, 1.0]`.
4. A MetricSet is immutable once `finalised`; corrections produce a new
   MetricSet linked via `replacesMetricSetId`.

**Commands:**

| Command                  | Effect                                                |
|--------------------------|-------------------------------------------------------|
| `start(evaluationId)`    | Creates an empty MetricSet for the Evaluation.        |
| `attachDimension(dim)`   | Adds or replaces one dimension (only while not final).|
| `finalise()`             | Locks the set and computes the Viability Score.       |
| `supersede(reason)`      | Marks the set replaced by a new one.                  |

**Events:**

- `MetricsCollected`
- `MetricsFinalised`
- `MetricsSuperseded`

**Repository:** `IMetricSetRepository`.

## Cross-Aggregate Rules

- **Never reach across aggregate boundaries inside a single transaction.**
  Updating an Evaluation and its MetricSet happens in two separate
  transactions, glued by domain events.
- **Reference by identity only.** `Evaluation.metricSetId: UUID | null` —
  never a `MetricSet` instance.
- **Read-side projections cross boundaries** because they're read-only and
  do not enforce aggregate invariants. They live in query services, not in
  repositories.
