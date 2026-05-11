/**
 * WebSocketBroadcasterAdapter — wires the DomainEventWebSocketBridge to
 * the legacy `WebSocketManager` without taking a direct dependency on it.
 *
 * Why duck-typed instead of `import { WebSocketManager }`?
 *   `src/orchestrator/WebSocketManager.ts` lives in the pre-existing tsc
 *   error pile. Importing it would pull those errors into the new code's
 *   compile target. By accepting a `BroadcasterPort` (structural type with
 *   a single `broadcast(topic, message)` method), we keep this adapter
 *   compile-clean while still being plug-compatible at runtime — every
 *   `WebSocketManager` instance satisfies the port.
 *
 * Usage (in `src/server.ts` when ready):
 *   const ws = new WebSocketManager();
 *   ws.initialize(server);
 *   const bridge = new DomainEventWebSocketBridge(
 *     domainEventBus,
 *     new WebSocketBroadcasterAdapter(ws),
 *   );
 *   bridge.start();
 *
 * Routing:
 *   - `evaluation:{id}` envelopes go to `ws.broadcast(id, message)` —
 *     the legacy manager's per-evaluation subscription model still
 *     applies.
 *   - `queue` / `agent` / `benchmark` envelopes go to
 *     `ws.broadcast('__system__', message)`. Clients subscribed to the
 *     pseudo-id `__system__` (or a future broker) receive them; legacy
 *     clients silently ignore them.
 */

import type { DomainEvent } from '../domain/events';
import type { WireBroadcaster } from './DomainEventWebSocketBridge';

export interface WebSocketWireMessage {
  readonly type: string;
  readonly timestamp: Date;
  readonly data: unknown;
}

export interface BroadcasterPort {
  broadcast(topic: string, message: WebSocketWireMessage): void;
}

const EVALUATION_TOPIC_PREFIX = 'evaluation:';
export const SYSTEM_TOPIC_ID = '__system__';

export class WebSocketBroadcasterAdapter implements WireBroadcaster {
  constructor(private readonly manager: BroadcasterPort) {}

  broadcast(topic: string, envelope: DomainEvent): void {
    const routingKey = topic.startsWith(EVALUATION_TOPIC_PREFIX)
      ? topic.slice(EVALUATION_TOPIC_PREFIX.length)
      : SYSTEM_TOPIC_ID;

    const message: WebSocketWireMessage = {
      type: envelope.name,
      timestamp: new Date(envelope.occurredAt),
      data: envelope,
    };

    this.manager.broadcast(routingKey, message);
  }
}
