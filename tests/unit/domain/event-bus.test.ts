import { DomainEventBus } from '../../../src/domain/event-bus';
import type {
  DomainEvent,
  EvaluationStartedPayload,
  EvaluationStepRecordedPayload,
} from '../../../src/domain/events';

const silentLogger = { warn: () => undefined, error: () => undefined };

describe('DomainEventBus', () => {
  test('delivers events to subscribed handlers', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const received: DomainEvent<'evaluation.started'>[] = [];
    bus.subscribe('evaluation.started', (e) => {
      received.push(e);
    });

    await bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    });

    expect(received).toHaveLength(1);
    expect(received[0].name).toBe('evaluation.started');
    expect(received[0].payload).toMatchObject({ evaluationId: 'e1' });
    expect(typeof received[0].eventId).toBe('string');
    expect(typeof received[0].correlationId).toBe('string');
  });

  test('unsubscribe stops further delivery', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    let count = 0;
    const unsub = bus.subscribe('evaluation.started', () => {
      count += 1;
    });

    await bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    });
    unsub();
    await bus.publish('evaluation.started', {
      evaluationId: 'e2',
      startedAt: '2026-05-10T00:00:01Z',
      environmentRef: 'env-2',
    });

    expect(count).toBe(1);
  });

  test('idempotent dedupe by eventId', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    let count = 0;
    bus.subscribe('evaluation.started', () => {
      count += 1;
    });

    const fixed = {
      eventId: 'fixed-event-id',
      correlationId: 'c',
    };
    await bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    }, fixed);
    await bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    }, fixed);

    expect(count).toBe(1);
  });

  test('preserves order per correlationId across async handlers', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const received: number[] = [];
    bus.subscribe<'evaluation.step.recorded'>(
      'evaluation.step.recorded',
      async (e) => {
        // simulate variable handler latency to force out-of-order delivery if
        // the bus did not serialize per-correlation
        const delay = (e.payload as EvaluationStepRecordedPayload).stepIndex === 0 ? 30 : 0;
        await new Promise((r) => setTimeout(r, delay));
        received.push((e.payload as EvaluationStepRecordedPayload).stepIndex);
      },
    );

    const correlationId = 'corr-1';
    await Promise.all([
      bus.publish(
        'evaluation.step.recorded',
        {
          evaluationId: 'e1',
          stepIndex: 0,
          recordedAt: '2026-05-10T00:00:00Z',
          kind: 'tool_call',
          status: 'ok',
          summary: 's0',
        },
        { correlationId },
      ),
      bus.publish(
        'evaluation.step.recorded',
        {
          evaluationId: 'e1',
          stepIndex: 1,
          recordedAt: '2026-05-10T00:00:01Z',
          kind: 'tool_call',
          status: 'ok',
          summary: 's1',
        },
        { correlationId },
      ),
      bus.publish(
        'evaluation.step.recorded',
        {
          evaluationId: 'e1',
          stepIndex: 2,
          recordedAt: '2026-05-10T00:00:02Z',
          kind: 'tool_call',
          status: 'ok',
          summary: 's2',
        },
        { correlationId },
      ),
    ]);

    expect(received).toEqual([0, 1, 2]);
  });

  test('failing handler does not block other handlers', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    let goodCalls = 0;
    bus.subscribe('evaluation.started', () => {
      throw new Error('boom');
    });
    bus.subscribe('evaluation.started', () => {
      goodCalls += 1;
    });

    await bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    } as EvaluationStartedPayload);

    expect(goodCalls).toBe(1);
  });

  test('LRU eviction caps idempotency-cache size', async () => {
    const bus = new DomainEventBus({
      logger: silentLogger,
      idempotencyCacheSize: 3,
    });
    bus.subscribe('queue.enqueued', () => undefined);

    for (let i = 0; i < 10; i++) {
      await bus.publish(
        'queue.enqueued',
        { evaluationId: `e${i}`, position: i, enqueuedAt: '2026-05-10T00:00:00Z' },
        { eventId: `id-${i}` },
      );
    }

    expect(bus.__seenSize()).toBeLessThanOrEqual(3);
  });

  test('publish carries causationId and producer when supplied', async () => {
    const bus = new DomainEventBus({ logger: silentLogger });
    const received: DomainEvent<'evaluation.started'>[] = [];
    bus.subscribe('evaluation.started', (e) => {
      received.push(e);
    });

    await bus.publish(
      'evaluation.started',
      {
        evaluationId: 'e1',
        startedAt: '2026-05-10T00:00:00Z',
        environmentRef: 'env-1',
      },
      {
        eventId: 'x',
        correlationId: 'c',
        causationId: 'parent',
        producer: 'orchestration',
      },
    );

    expect(received[0].causationId).toBe('parent');
    expect(received[0].producer).toBe('orchestration');
    expect(received[0].correlationId).toBe('c');
  });
});
