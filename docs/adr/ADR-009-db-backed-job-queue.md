# ADR-009: Database-backed job queue (no Redis) for the MVP

- Status: Accepted
- Date: 2026-06-16
- Deciders: HASEB core

## Context

Evaluations fan out into many per-task execution jobs that must be queued,
processed, retried, and observed. A common reflex is to reach for Redis +
BullMQ. That adds an operational dependency (another managed service, another
failure mode) before we have the scale to justify it.

The codebase already ships an `EvaluationQueue` (in-memory queue) and a
`WebSocketManager`, and a relational database is already a hard dependency.

## Decision

For the MVP, use the **existing `EvaluationQueue` backed by the database** for
durability — **no Redis**.

- Jobs are persisted in the `execution_jobs` table (status, retry count,
  timestamps, result columns) so queue state survives a restart.
- The in-memory queue drives ordering/processing within a worker; the database
  is the source of truth and the recovery log.
- Status transitions (`pending → running → completed | failed | timeout`) are
  written to the row and emitted as Socket.io events (ADR-011).

## Consequences

- **One fewer moving part** to deploy, secure, and pay for. Fits the single
  worker + container-per-task MVP (ADR-008).
- Throughput is bounded by the database and a single worker — acceptable for
  300-task SWE-bench Lite runs.
- **Revisit at scale.** When we need multiple concurrent workers with low-latency
  coordination and high job throughput, introduce Redis/BullMQ (or
  `SELECT ... FOR UPDATE SKIP LOCKED` on Postgres) behind the same queue
  abstraction. The domain talks to a queue, not to Redis, so this is swappable.
