# Notifications & Real-time Context

**Type:** Supporting subdomain.
**Position:** the live wire from the Orchestrator (and other producers) to
the dashboard and external subscribers.

## Purpose

Deliver domain events from the producing context (mostly Orchestration and
Metrics) to interested consumers in near-real-time, with backpressure and
idempotency. Notifications is **not** a domain owner; it is a transport
adapter that operates on the Published Language defined in
[../domain-events.md](../domain-events.md).

## Ubiquitous Language (local)

- **Topic** — the channel name (e.g. `evaluation:{id}`, `queue`).
- **Subscription** — a client's interest in a Topic.
- **Envelope** — the standard wire format around a domain-event payload.

## Components

| Component               | Source                                          | Role                                  |
|-------------------------|-------------------------------------------------|---------------------------------------|
| `WebSocketManager`      | `src/orchestrator/WebSocketManager.ts`          | Server-side hub; subscriptions, fan-out |
| `useRealTimeUpdates`    | `src/hooks/useRealTimeUpdates.ts`               | Browser-side hook                     |

## Wire Format

See [../integration-patterns.md](../integration-patterns.md#2-websocket-open-host-service)
for the complete protocol. Recap:

```
client -> server: { type: 'subscribe', topic: 'evaluation:abc-123' }
server -> client: { type: 'subscribed', topic: 'evaluation:abc-123' }
server -> client: { type: 'event', envelope: { ... } }
```

## Topics

| Topic                      | Producers                          | Typical consumers                |
|----------------------------|------------------------------------|----------------------------------|
| `evaluation:{id}`          | Orchestration, Evaluation          | Run-detail page                  |
| `metrics:{id}`             | Metrics                            | Run-detail page (metrics tab)    |
| `queue`                    | Orchestration                      | Queue widget                     |
| `notifications:{userId}`   | various (audit, system messages)   | Dashboard layout (toasts, badges)|

## Authorisation

- Subscribers must present a valid JWT (ADR 0014) at connection time.
- Per-topic authorisation:
  - `evaluation:{id}` and `metrics:{id}` require the user to have access to
    the Evaluation (submitter, admin, analyst).
  - `notifications:{userId}` is restricted to that user (or an admin).

## Backpressure

- Server-side per-connection queue depth is bounded; slow clients are
  disconnected after exceeding the high watermark.
- Each topic keeps the **last 100 events** in memory for replay on
  re-subscription. For full history, clients use the REST endpoint that
  returns the persisted Run.

## Idempotency

- Events carry an `eventId` (UUID). Consumers must dedupe on it.
- The `useRealTimeUpdates` hook handles dedup automatically.

## Boundaries

| Other context              | Interaction                                                |
|----------------------------|------------------------------------------------------------|
| Orchestration              | Open Host Service consumer of Orchestration events.        |
| Metrics                    | Subscribes to `metrics.*` events.                          |
| Identity & Access          | Validates connection JWT.                                  |
| Dashboard                  | The browser is the primary consumer.                       |

## Quality / Testing

- A `socket.io` test client exercises subscription / unsubscription /
  replay.
- Property-based tests on dedup logic.
- End-to-end tests verify that a submitted Evaluation produces the
  expected event sequence on the dashboard run page.

## Open Questions / Future Work

- Replace the in-process bus + `socket.io` adapter with an external broker
  (NATS / Kafka) and an SSE / WebSocket gateway when horizontal scaling
  demands it (would amend or supersede ADR 0021).
- Add server-sent-events (SSE) as a fallback transport for clients behind
  proxies that block WebSocket.
