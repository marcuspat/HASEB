# DDD Migration Mission Report

This report tracks the migration from HASEB's pre-DDD source layout to the
model documented in `docs/ddd/`. It is updated at the end of every loop
iteration.

## Status snapshot

| Layer                                             | State         |
|---------------------------------------------------|---------------|
| ADR set (28 ADRs + index + template)              | ✅ Complete    |
| DDD strategic + tactical + per-context docs       | ✅ Complete    |
| Domain event envelope + payload catalogue (types) | ✅ Complete    |
| Repository contracts (interfaces + branded IDs)   | ✅ Complete    |
| MetricSet aggregate types + value objects         | ✅ Complete    |
| `ProcessViabilityCalculator` domain service       | ✅ Complete    |
| `metric_sets` migration (PG + SQLite)             | ✅ Complete    |
| In-memory repository implementations              | ✅ Complete    |
| In-process `DomainEventBus`                       | ✅ Complete    |
| `ProcessViabilityCalculator` micro-benchmark      | ✅ Complete    |
| `DomainEventWebSocketBridge` (envelope relay)     | ✅ Complete    |
| `Evaluation` state-machine enforcement            | ✅ Complete    |
| In-memory read-side query services                | ✅ Complete    |
| Architecture-fitness tests (domain layer purity)  | ✅ Complete    |
| `WebSocketManager.broadcast` → bridge wiring      | ⬜ Open        |
| `EvaluationModel` → `IEvaluationRepository`       | ⬜ Open        |
| `BaseMetricCollector.collect()` canonical method  | ⬜ Open        |
| Pre-existing 859 `tsc` errors                     | ⬜ Out of band |

## Ranked follow-ups (work queue)

The list below is ordered so each item unblocks more downstream work. An
iteration of `/loop` should pick the top open item, ship it with tests,
and update this file.

### Tier 1 — Foundational, immediately buildable

1. ✅ **`metric_sets` migration (PG + SQLite).** — landed in iteration #2 as
   migration `008` in both `src/database/migrations.ts` and
   `src/database/sqlite-migrations.ts`. PG uses JSONB for `dimensions` and
   `viability_score` with GIN indexes; SQLite uses TEXT JSON columns. Both
   include the `evaluation_id` partial-unique index that excludes
   `superseded` rows so a single Evaluation has at most one active set.

2. ✅ **In-memory repository implementations.** — landed in iteration #2 at
   `src/domain/in-memory/InMemoryRepositories.ts`. All five repositories
   implemented with seed support, contiguous-step enforcement, and
   secondary indexes (fingerprint, email).

3. ✅ **In-process `DomainEventBus`.** — landed in iteration #2 at
   `src/domain/event-bus.ts`. Per-correlationId FIFO, eventId-based dedupe
   with LRU-bounded cache, handler isolation, optional logger injection.

4. ✅ **`DomainEventWebSocketBridge` (envelope relay).** — landed in
   iteration #3 at `src/orchestrator/DomainEventWebSocketBridge.ts`.
   Subscribes to all `evaluation.*`, `metrics.*`, `agent.*`, `benchmark.*`,
   and `queue.*` events on the bus; relays them to the right topic via a
   `WireBroadcaster` port. The existing `WebSocketManager` is untouched;
   wiring its `broadcast()` to the bridge is a follow-up below.

4b. **`WebSocketManager.broadcast` → bridge wiring.**
   - Implement a tiny adapter that satisfies `WireBroadcaster` from a
     `WebSocketManager` instance (~10 lines) and bind both at server boot.
   - The bridge already has tests; adapter wiring is a one-shot patch in
     `src/server.ts`.

### Tier 2 — Code-level adoption

5. **`EvaluationModel` adapter satisfying `IEvaluationRepository`.**
   - Thin wrapper around the existing model class so application code can
     depend on the contract instead of the concrete model.
   - No persistence-shape changes.

6. **`BaseMetricCollector.collect()` canonical method.**
   - Promote the existing `start()` flow to a `collect(run)` returning a
     typed `MetricDimension`, matching `docs/ddd/contexts/metrics-context.md`.

7. ✅ **`Evaluation` state-machine enforcement.** — landed in iteration #3
   at `src/domain/evaluation-state-machine.ts`. Pure helper module with
   `canTransition`, `assertTransition`, `nextAllowedStates`,
   `IllegalStateTransitionError`, and an `EvaluationLifecycle` wrapper for
   object-style use. Production aggregates can adopt it incrementally
   without changing persistence shape.

### Tier 3 — Quality and validation

8. ✅ **Architecture-fitness tests (domain-layer purity).** — landed in
   iteration #3 at `tests/unit/architecture/domain-layer-purity.test.ts`.
   Walks `src/domain/**` and rejects (a) cross-layer relative imports,
   (b) forbidden runtime packages (`pg`, `sqlite3`, `socket.io`,
   `express`, `react`, etc.), (c) relative imports that escape
   `src/domain/`, and (d) any reference to the orchestrator-side bridge
   from inside the domain layer.

9. ✅ **Micro-benchmark for `ProcessViabilityCalculator`.** — landed in
   iteration #2 at `benchmarks/process-viability-calculator.bench.ts` with
   `npm run bench`. Reference container measurement: **3.4M ops/sec, p50
   = 0.3 µs, p99 = 0.5 µs** — well above the 1M/sec target.

10. ✅ **In-memory read-side query services.** — landed in iteration #3 at
    `src/domain/in-memory/InMemoryQueryServices.ts`.
    `InMemoryEvaluationQueryService`, `InMemoryLeaderboardQueryService`
    (with window filtering and per-dimension slicing), and
    `InMemoryAnalyticsQueryService` (`costByAgent`, `successRateTrend`).
    All three compose the existing in-memory repositories.

### Out of band

- Pre-existing **859 `tsc` errors** across 75 files (mostly
  `@types/react-router-dom@5` vs `react-router@7` and a `ValidationRule.type`
  string-union mismatch). Tracked separately; the new domain layer is type-clean.

## Loop history

| Iteration | Date       | Outcome                                                   |
|-----------|------------|-----------------------------------------------------------|
| #0        | 2026-05-09 | ADR set + DDD docs (28 ADRs, 18 DDD pages).               |
| #1        | 2026-05-10 | Domain layer foundation (events, contracts, MetricSet, calculator) + 6 test-file repairs + 10 new green tests. |
| #2        | 2026-05-10 | Tier-1 items 1–3 (metric_sets migration, in-memory repos, DomainEventBus) + benchmark + tests. |
| #3        | 2026-05-10 | DomainEventWebSocketBridge + Evaluation state machine + in-memory query services + domain-layer architecture-fitness tests; aggregate contracts widened. 55/55 domain tests green. |

## Conventions for follow-up iterations

- One Tier-1 item or two Tier-2 items per iteration.
- Each iteration commits with a `feat(domain):` / `feat(persistence):` / etc. prefix and updates this file's status table.
- New domain code must compile under strict tsc *for itself* even where the
  repo-wide tsc still has pre-existing errors elsewhere.
- Tests for the new code must be green; broader test-suite repair is a
  separate parallel track.
