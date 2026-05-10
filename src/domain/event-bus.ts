/**
 * In-process DomainEventBus.
 *
 * Implements both `DomainEventPublisher` and `DomainEventSubscriber`. This is
 * the v1 transport per ADR 0021; a future durable broker will satisfy the
 * same contract.
 *
 * Guarantees:
 * - Per-correlationId in-order delivery: events with the same correlationId
 *   are delivered to subscribers in the order they were published.
 * - Idempotent dedupe by `eventId`: a duplicate publish (same eventId) is
 *   silently dropped.
 * - At-least-once: a failing handler is logged via the optional logger and
 *   does not block other handlers; the producer's `publish` resolves once
 *   all handlers have been invoked (regardless of individual failures).
 *
 * Non-goals (v1):
 * - Durable persistence.
 * - Cross-process delivery.
 */

import type {
  DomainEvent,
  DomainEventName,
  DomainEventPayloads,
  DomainEventPublisher,
  DomainEventSubscriber,
} from './events';

type Handler<TName extends DomainEventName> = (
  event: DomainEvent<TName>,
) => Promise<void> | void;

export interface BusOptions {
  readonly producer?: string;
  readonly idempotencyCacheSize?: number;
  readonly logger?: Pick<Console, 'warn' | 'error'>;
  readonly newId?: () => string;
  readonly clock?: () => Date;
}

interface CorrelationQueue {
  promise: Promise<void>;
}

const DEFAULT_CACHE_SIZE = 4096;
const NO_CORRELATION = '__no_correlation__';

function defaultId(): string {
  // Lightweight UUID v4-ish — good enough for in-process dedupe.
  // Avoids a runtime dependency for a cold path.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class DomainEventBus
  implements DomainEventPublisher, DomainEventSubscriber
{
  private readonly handlers = new Map<DomainEventName, Set<Handler<never>>>();
  private readonly seen = new Set<string>();
  private readonly seenOrder: string[] = [];
  private readonly producer: string;
  private readonly idempotencyCacheSize: number;
  private readonly logger: Pick<Console, 'warn' | 'error'>;
  private readonly newId: () => string;
  private readonly clock: () => Date;
  private readonly correlationQueues = new Map<string, CorrelationQueue>();

  constructor(options: BusOptions = {}) {
    this.producer = options.producer ?? 'haseb';
    this.idempotencyCacheSize =
      options.idempotencyCacheSize ?? DEFAULT_CACHE_SIZE;
    this.logger = options.logger ?? console;
    this.newId = options.newId ?? defaultId;
    this.clock = options.clock ?? (() => new Date());
  }

  subscribe<TName extends DomainEventName>(
    name: TName,
    handler: Handler<TName>,
  ): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      const current = this.handlers.get(name);
      if (current) current.delete(handler as Handler<never>);
    };
  }

  async publish<TName extends DomainEventName>(
    name: TName,
    payload: DomainEventPayloads[TName],
    options: {
      readonly eventId?: string;
      readonly correlationId?: string;
      readonly causationId?: string;
      readonly producer?: string;
      readonly version?: number;
      readonly occurredAt?: string;
    } = {},
  ): Promise<void> {
    const eventId = options.eventId ?? this.newId();
    if (this.seen.has(eventId)) {
      // Idempotent: drop duplicate publish.
      return;
    }
    this.markSeen(eventId);

    const event = {
      eventId,
      name,
      version: options.version ?? 1,
      occurredAt: options.occurredAt ?? this.clock().toISOString(),
      correlationId: options.correlationId ?? eventId,
      causationId: options.causationId,
      producer: options.producer ?? this.producer,
      payload,
    } as unknown as DomainEvent<TName>;

    const handlers = Array.from(this.handlers.get(name) ?? []) as Handler<TName>[];
    if (handlers.length === 0) return;

    const correlationKey = event.correlationId || NO_CORRELATION;
    const previous =
      this.correlationQueues.get(correlationKey)?.promise ?? Promise.resolve();

    const next = previous.then(() => this.runHandlers(event, handlers));
    this.correlationQueues.set(correlationKey, { promise: next });

    try {
      await next;
    } finally {
      // Allow the queue entry to be GC'd if nobody else has chained onto it.
      const queue = this.correlationQueues.get(correlationKey);
      if (queue && queue.promise === next) {
        this.correlationQueues.delete(correlationKey);
      }
    }
  }

  private async runHandlers<TName extends DomainEventName>(
    event: DomainEvent<TName>,
    handlers: readonly Handler<TName>[],
  ): Promise<void> {
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(
          `[DomainEventBus] handler for ${event.name} (eventId=${event.eventId}) failed`,
          err,
        );
      }
    }
  }

  private markSeen(eventId: string): void {
    this.seen.add(eventId);
    this.seenOrder.push(eventId);
    if (this.seenOrder.length > this.idempotencyCacheSize) {
      const evicted = this.seenOrder.shift();
      if (evicted !== undefined) this.seen.delete(evicted);
    }
  }

  // Test helpers ------------------------------------------------------------

  /** Number of cached eventIds, exposed for tests. */
  __seenSize(): number {
    return this.seen.size;
  }

  /** Number of registered handlers across all event names, exposed for tests. */
  __handlerCount(): number {
    let n = 0;
    for (const set of this.handlers.values()) n += set.size;
    return n;
  }
}

/**
 * Singleton bus for the default in-process producer. Adapters
 * (`WebSocketManager`, projection workers) subscribe here.
 */
export const domainEventBus: DomainEventBus = new DomainEventBus({
  producer: 'haseb',
});
