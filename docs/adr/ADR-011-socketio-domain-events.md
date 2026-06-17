# ADR-011: Socket.io for real-time domain events

- Status: Accepted
- Date: 2026-06-16
- Deciders: HASEB core

## Context

Watching an evaluation should feel live: as 300 tasks queue, start, and resolve,
the dashboard should update without polling. The codebase already includes a
`WebSocketManager` built on Socket.io.

## Decision

Use the **existing `WebSocketManager` + Socket.io** to broadcast evaluation
progress as named domain events. The canonical event set is:

| Event                  | Emitted when                                    |
| ---------------------- | ----------------------------------------------- |
| `evaluation:queued`    | An evaluation is accepted and its jobs enqueued |
| `evaluation:started`   | The evaluation begins processing                |
| `task:started`         | A single benchmark task begins executing        |
| `task:completed`       | A single benchmark task finishes (pass/fail)    |
| `evaluation:completed` | All tasks are done and a score is computed      |

Event names map 1:1 to domain events (`ExecutionJobStarted`,
`ExecutionJobCompleted`, `ScoreComputed`, …). The domain raises events; an
adapter forwards them to Socket.io rooms keyed by evaluation id.

## Consequences

- **No new infrastructure** — Socket.io is already wired in.
- Clients subscribe per-evaluation room and receive incremental progress
  (e.g. "147/300 tasks completed"), enabling live progress bars and counters.
- Domain code depends on a domain-event abstraction, not on Socket.io directly,
  so the transport can change without touching domain logic.
- Event names are a public contract for the frontend; changing them is a
  breaking change and must be versioned.
- At-most-once delivery (Socket.io) is fine for progress UI; the database
  remains the source of truth for final results (ADR-009).
