import { DomainEventBus } from '../../../src/domain/event-bus';
import {
  DomainEventWebSocketBridge,
  type WireBroadcaster,
} from '../../../src/orchestrator/DomainEventWebSocketBridge';
import type { DomainEvent } from '../../../src/domain/events';

const silentLogger = { warn: () => undefined, error: () => undefined };

class CapturingBroadcaster implements WireBroadcaster {
  public readonly calls: Array<{ topic: string; envelope: DomainEvent }> = [];
  broadcast(topic: string, envelope: DomainEvent): void {
    this.calls.push({ topic, envelope });
  }
}

describe('DomainEventWebSocketBridge', () => {
  test('relays evaluation.* events to evaluation:{id} topic', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const cap = new CapturingBroadcaster();
    const bridge = new DomainEventWebSocketBridge(bus, cap);
    bridge.start();

    await bus.publish('evaluation.submitted', {
      evaluationId: 'e1',
      agentId: 'a1',
      benchmarkId: 'b1',
      submittedById: 'u1',
      submittedAt: '2026-05-10T00:00:00Z',
    });

    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0].topic).toBe('evaluation:e1');
    expect(cap.calls[0].envelope.name).toBe('evaluation.submitted');
  });

  test('relays metrics.* events that carry evaluationId to evaluation:{id}', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const cap = new CapturingBroadcaster();
    const bridge = new DomainEventWebSocketBridge(bus, cap);
    bridge.start();

    await bus.publish('metrics.finalised', {
      evaluationId: 'e2',
      metricSetId: 'm2',
      finalisedAt: '2026-05-10T00:00:00Z',
      viabilityScore: 0.83,
      weightingVersion: '1.0.0',
    });

    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0].topic).toBe('evaluation:e2');
  });

  test('routes queue.* to "queue" and agent.* to "agent"', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const cap = new CapturingBroadcaster();
    const bridge = new DomainEventWebSocketBridge(bus, cap);
    bridge.start();

    await bus.publish('queue.enqueued', {
      evaluationId: 'e3', // queue events also carry evaluationId; topic precedence picks evaluation:
      position: 1,
      enqueuedAt: '2026-05-10T00:00:00Z',
    });
    await bus.publish('agent.registered', {
      agentId: 'a1',
      name: 'A',
      provider: 'p',
      fingerprint: 'sha256:1',
      registeredAt: '2026-05-10T00:00:00Z',
    });

    const topics = cap.calls.map((c) => c.topic);
    expect(topics).toEqual(['evaluation:e3', 'agent']);
  });

  test('start is idempotent; stop unsubscribes', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const cap = new CapturingBroadcaster();
    const bridge = new DomainEventWebSocketBridge(bus, cap);

    bridge.start();
    bridge.start(); // no-op
    expect(bridge.isStarted()).toBe(true);

    bridge.stop();
    expect(bridge.isStarted()).toBe(false);

    await bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    });
    expect(cap.calls).toHaveLength(0);
  });

  test('topicFor exposes pure mapping for diagnostics', () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const cap = new CapturingBroadcaster();
    const bridge = new DomainEventWebSocketBridge(bus, cap);

    const evalEvent: DomainEvent = {
      eventId: 'x',
      name: 'evaluation.completed',
      version: 1,
      occurredAt: '2026-05-10T00:00:00Z',
      correlationId: 'c',
      producer: 'orchestration',
      payload: { evaluationId: 'e1' } as never,
    };
    expect(bridge.topicFor(evalEvent)).toBe('evaluation:e1');

    const benchmarkEvent: DomainEvent = {
      eventId: 'y',
      name: 'benchmark.published',
      version: 1,
      occurredAt: '2026-05-10T00:00:00Z',
      correlationId: 'c',
      producer: 'benchmark-catalog',
      payload: {
        benchmarkId: 'b1',
        name: 'SWE',
        version: '2.1',
        kind: 'code',
        taskCount: 100,
        publishedAt: '2026-05-10T00:00:00Z',
      } as never,
    };
    expect(bridge.topicFor(benchmarkEvent)).toBe('benchmark');
  });
});
