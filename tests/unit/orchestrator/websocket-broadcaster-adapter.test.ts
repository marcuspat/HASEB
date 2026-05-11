import {
  SYSTEM_TOPIC_ID,
  WebSocketBroadcasterAdapter,
  type BroadcasterPort,
  type WebSocketWireMessage,
} from '../../../src/orchestrator/WebSocketBroadcasterAdapter';
import { DomainEventBus } from '../../../src/domain/event-bus';
import { DomainEventWebSocketBridge } from '../../../src/orchestrator/DomainEventWebSocketBridge';

const silentLogger = { warn: () => undefined, error: () => undefined };

class FakeWebSocketManager implements BroadcasterPort {
  public readonly calls: Array<{ topic: string; message: WebSocketWireMessage }> =
    [];
  broadcast(topic: string, message: WebSocketWireMessage): void {
    this.calls.push({ topic, message });
  }
}

describe('WebSocketBroadcasterAdapter', () => {
  test('routes evaluation:{id} envelopes to the evaluationId routing key', () => {
    const manager = new FakeWebSocketManager();
    const adapter = new WebSocketBroadcasterAdapter(manager);

    adapter.broadcast('evaluation:abc-123', {
      eventId: 'e1',
      name: 'evaluation.started',
      version: 1,
      occurredAt: '2026-05-10T00:00:00Z',
      correlationId: 'c',
      producer: 'orchestration',
      payload: {
        evaluationId: 'abc-123',
        startedAt: '2026-05-10T00:00:00Z',
        environmentRef: 'env-1',
      } as never,
    });

    expect(manager.calls).toHaveLength(1);
    expect(manager.calls[0].topic).toBe('abc-123');
    expect(manager.calls[0].message.type).toBe('evaluation.started');
    expect(manager.calls[0].message.timestamp).toBeInstanceOf(Date);
    expect(manager.calls[0].message.timestamp.toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
    expect((manager.calls[0].message.data as { eventId: string }).eventId).toBe(
      'e1',
    );
  });

  test('routes queue / agent / benchmark topics to the system pseudo-id', () => {
    const manager = new FakeWebSocketManager();
    const adapter = new WebSocketBroadcasterAdapter(manager);

    for (const topic of ['queue', 'agent', 'benchmark']) {
      adapter.broadcast(topic, {
        eventId: 'x',
        name: 'queue.enqueued',
        version: 1,
        occurredAt: '2026-05-10T00:00:00Z',
        correlationId: 'c',
        producer: 'orchestration',
        payload: {
          evaluationId: 'irrelevant',
          position: 0,
          enqueuedAt: '2026-05-10T00:00:00Z',
        } as never,
      });
    }

    expect(manager.calls).toHaveLength(3);
    for (const call of manager.calls) {
      expect(call.topic).toBe(SYSTEM_TOPIC_ID);
    }
  });

  test('end-to-end: bus → bridge → adapter → fake manager', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const manager = new FakeWebSocketManager();
    const adapter = new WebSocketBroadcasterAdapter(manager);
    const bridge = new DomainEventWebSocketBridge(bus, adapter);
    bridge.start();

    await bus.publish('evaluation.completed', {
      evaluationId: 'e-final',
      completedAt: '2026-05-10T00:01:00Z',
      metricSetId: 'm-1',
    });

    expect(manager.calls).toHaveLength(1);
    expect(manager.calls[0].topic).toBe('e-final');
    expect(manager.calls[0].message.type).toBe('evaluation.completed');
  });

  test('message preserves envelope.data verbatim for client inspection', () => {
    const manager = new FakeWebSocketManager();
    const adapter = new WebSocketBroadcasterAdapter(manager);

    const envelope = {
      eventId: 'fixed',
      name: 'metrics.finalised' as const,
      version: 1,
      occurredAt: '2026-05-10T00:00:00Z',
      correlationId: 'c',
      causationId: 'parent',
      producer: 'metrics',
      payload: {
        evaluationId: 'e1',
        metricSetId: 'm1',
        finalisedAt: '2026-05-10T00:00:00Z',
        viabilityScore: 0.91,
        weightingVersion: '1.0.0',
      } as never,
    };
    adapter.broadcast('evaluation:e1', envelope);

    expect(manager.calls[0].message.data).toEqual(envelope);
  });
});
