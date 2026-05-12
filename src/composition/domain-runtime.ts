/**
 * Composition root for the DDD domain runtime.
 *
 * Wires together the in-process domain components (bus, bridge, collectors)
 * and exposes a single value that the rest of the application can depend on.
 * The legacy `src/server.ts` adopts this incrementally by calling
 * `bootstrapDomainRuntime(...)` at startup and passing the resulting
 * `DomainRuntime.bus` to producers.
 *
 * Why a separate composition module?
 *   `src/server.ts` lives in the pre-existing tsc error pile. Putting the
 *   wiring here keeps it compile-clean and lets us write focused tests for
 *   the runtime without touching the server file. A future one-line
 *   import in `src/server.ts` finishes the wiring.
 *
 * Inputs:
 *   - A `BroadcasterPort` (the legacy `WebSocketManager` satisfies it
 *     structurally — see `src/orchestrator/WebSocketBroadcasterAdapter.ts`).
 *   - Optional configuration (logger, idempotency cache size, producer name).
 *
 * Output: a `DomainRuntime` with:
 *   - `bus` — the live `DomainEventPublisher` / `DomainEventSubscriber`.
 *   - `bridge` — the started `DomainEventWebSocketBridge`.
 *   - `repositories` — empty in-memory repos for the legacy seam; swap to
 *     PG/SQLite adapters at the production composition root.
 *   - `queryServices` — read-side services backed by the in-memory repos.
 *   - `viability` — the singleton `ProcessViabilityCalculator`.
 *   - `shutdown()` — stops the bridge and unsubscribes everything.
 */

import { DomainEventBus, type BusOptions } from '../domain/event-bus';
import type {
  DomainEventPublisher,
  DomainEventSubscriber,
} from '../domain/events';
import { DomainEventWebSocketBridge } from '../orchestrator/DomainEventWebSocketBridge';
import {
  WebSocketBroadcasterAdapter,
  type BroadcasterPort,
} from '../orchestrator/WebSocketBroadcasterAdapter';
import {
  InMemoryAgentRepository,
  InMemoryBenchmarkRepository,
  InMemoryEvaluationRepository,
  InMemoryMetricSetRepository,
  InMemoryUserRepository,
} from '../domain/in-memory/InMemoryRepositories';
import {
  InMemoryAnalyticsQueryService,
  InMemoryEvaluationQueryService,
  InMemoryLeaderboardQueryService,
} from '../domain/in-memory/InMemoryQueryServices';
import {
  DefaultProcessViabilityCalculator,
  type ProcessViabilityCalculator,
} from '../domain/process-viability-calculator';

export interface DomainRuntimeOptions {
  /**
   * Adapter that fans envelopes out to subscribers. In production this
   * wraps `WebSocketManager`; in tests it can be a no-op.
   */
  readonly broadcaster: BroadcasterPort;

  /** Optional overrides for the bus. */
  readonly bus?: BusOptions;

  /** Optional viability calculator override (default: shared singleton). */
  readonly viability?: ProcessViabilityCalculator;
}

export interface DomainRuntime {
  readonly bus: DomainEventPublisher & DomainEventSubscriber;
  readonly bridge: DomainEventWebSocketBridge;
  readonly repositories: {
    readonly evaluations: InMemoryEvaluationRepository;
    readonly agents: InMemoryAgentRepository;
    readonly benchmarks: InMemoryBenchmarkRepository;
    readonly users: InMemoryUserRepository;
    readonly metricSets: InMemoryMetricSetRepository;
  };
  readonly queryServices: {
    readonly evaluations: InMemoryEvaluationQueryService;
    readonly leaderboard: InMemoryLeaderboardQueryService;
    readonly analytics: InMemoryAnalyticsQueryService;
  };
  readonly viability: ProcessViabilityCalculator;
  shutdown(): void;
}

export function bootstrapDomainRuntime(
  options: DomainRuntimeOptions,
): DomainRuntime {
  const bus = new DomainEventBus(options.bus);
  const adapter = new WebSocketBroadcasterAdapter(options.broadcaster);
  const bridge = new DomainEventWebSocketBridge(bus, adapter);
  bridge.start();

  const evaluations = new InMemoryEvaluationRepository();
  const agents = new InMemoryAgentRepository();
  const benchmarks = new InMemoryBenchmarkRepository();
  const users = new InMemoryUserRepository();
  const metricSets = new InMemoryMetricSetRepository();

  const evaluationQS = new InMemoryEvaluationQueryService(evaluations);
  const leaderboardQS = new InMemoryLeaderboardQueryService(
    evaluations,
    agents,
    metricSets,
  );
  const analyticsQS = new InMemoryAnalyticsQueryService(evaluations, metricSets);

  const viability =
    options.viability ?? new DefaultProcessViabilityCalculator();

  return {
    bus,
    bridge,
    repositories: { evaluations, agents, benchmarks, users, metricSets },
    queryServices: {
      evaluations: evaluationQS,
      leaderboard: leaderboardQS,
      analytics: analyticsQS,
    },
    viability,
    shutdown(): void {
      bridge.stop();
    },
  };
}
