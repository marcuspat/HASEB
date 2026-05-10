/**
 * Domain-event → WebSocket bridge.
 *
 * Subscribes to the in-process DomainEventBus and relays each event as a
 * stable wire envelope on the appropriate topic. This is the seam between
 * the published domain language (events) and the dashboard's transport.
 *
 * Additive: the existing `WebSocketManager.broadcast()` API is untouched.
 * In production, a thin adapter implementing `WireBroadcaster` calls
 * `WebSocketManager.broadcast()`; in tests, an in-memory implementation
 * captures events directly. See `tests/unit/orchestrator/
 * domain-event-websocket-bridge.test.ts`.
 *
 * Topics:
 *   - `evaluation:{id}` — every event whose payload carries `evaluationId`.
 *   - `queue`           — `queue.enqueued` / `queue.dequeued`.
 *   - `agent`           — agent.* events.
 *   - `benchmark`       — benchmark.* events.
 *
 * Topic-routing rules live entirely in this file so the wire protocol can
 * be re-routed without disturbing producers or the bus.
 */

import type {
  DomainEvent,
  DomainEventName,
  DomainEventSubscriber,
} from '../domain/events';

const RELAYED_EVENTS: readonly DomainEventName[] = [
  'evaluation.submitted',
  'evaluation.started',
  'evaluation.step.recorded',
  'evaluation.run.completed',
  'evaluation.completed',
  'evaluation.failed',
  'evaluation.cancelled',
  'metrics.dimension.collected',
  'metrics.finalised',
  'metrics.superseded',
  'agent.registered',
  'agent.profile.updated',
  'agent.archived',
  'benchmark.published',
  'benchmark.deprecated',
  'queue.enqueued',
  'queue.dequeued',
];

/**
 * Output port: anything that knows how to fan an event envelope out to
 * subscribers of a topic. Matches the `WebSocketManager` shape closely
 * enough that a thin adapter can satisfy it.
 */
export interface WireBroadcaster {
  broadcast(topic: string, envelope: DomainEvent): void;
}

export class DomainEventWebSocketBridge {
  private readonly unsubscribers: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly bus: DomainEventSubscriber,
    private readonly broadcaster: WireBroadcaster,
  ) {}

  start(): void {
    if (this.started) return;
    for (const name of RELAYED_EVENTS) {
      const unsub = this.bus.subscribe(name, (event) => this.relay(event));
      this.unsubscribers.push(unsub);
    }
    this.started = true;
  }

  stop(): void {
    while (this.unsubscribers.length > 0) {
      const unsub = this.unsubscribers.pop();
      if (unsub) unsub();
    }
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  /**
   * Maps a domain event to a wire topic. Pure, exposed for testability.
   */
  topicFor(event: DomainEvent): string | null {
    const payload = event.payload as { evaluationId?: string } | undefined;
    if (payload?.evaluationId) return `evaluation:${payload.evaluationId}`;
    if (event.name.startsWith('queue.')) return 'queue';
    if (event.name.startsWith('agent.')) return 'agent';
    if (event.name.startsWith('benchmark.')) return 'benchmark';
    return null;
  }

  private relay(event: DomainEvent): void {
    const topic = this.topicFor(event);
    if (!topic) return;
    this.broadcaster.broadcast(topic, event);
  }
}
