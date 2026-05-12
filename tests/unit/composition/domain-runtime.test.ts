import { bootstrapDomainRuntime } from '../../../src/composition/domain-runtime';
import type {
  BroadcasterPort,
  WebSocketWireMessage,
} from '../../../src/orchestrator/WebSocketBroadcasterAdapter';

class FakeBroadcaster implements BroadcasterPort {
  public readonly calls: Array<{ topic: string; message: WebSocketWireMessage }> =
    [];
  broadcast(topic: string, message: WebSocketWireMessage): void {
    this.calls.push({ topic, message });
  }
}

const silentLogger = { warn: () => undefined, error: () => undefined };

describe('bootstrapDomainRuntime', () => {
  test('returns a fully wired runtime with bus, bridge, repos, services', () => {
    const runtime = bootstrapDomainRuntime({
      broadcaster: new FakeBroadcaster(),
      bus: { logger: silentLogger },
    });
    try {
      expect(runtime.bus).toBeDefined();
      expect(runtime.bridge.isStarted()).toBe(true);
      expect(runtime.repositories.evaluations).toBeDefined();
      expect(runtime.repositories.agents).toBeDefined();
      expect(runtime.repositories.benchmarks).toBeDefined();
      expect(runtime.repositories.users).toBeDefined();
      expect(runtime.repositories.metricSets).toBeDefined();
      expect(runtime.queryServices.evaluations).toBeDefined();
      expect(runtime.queryServices.leaderboard).toBeDefined();
      expect(runtime.queryServices.analytics).toBeDefined();
      expect(runtime.viability).toBeDefined();
    } finally {
      runtime.shutdown();
    }
  });

  test('bus publish is relayed through the bridge to the broadcaster', async () => {
    const broadcaster = new FakeBroadcaster();
    const runtime = bootstrapDomainRuntime({
      broadcaster,
      bus: { logger: silentLogger },
    });
    try {
      await runtime.bus.publish('evaluation.completed', {
        evaluationId: 'e-final',
        completedAt: '2026-05-10T00:00:00Z',
        metricSetId: 'm-1',
      });
      expect(broadcaster.calls).toHaveLength(1);
      expect(broadcaster.calls[0].topic).toBe('e-final');
      expect(broadcaster.calls[0].message.type).toBe('evaluation.completed');
    } finally {
      runtime.shutdown();
    }
  });

  test('shutdown stops the bridge (further publishes do not reach broadcaster)', async () => {
    const broadcaster = new FakeBroadcaster();
    const runtime = bootstrapDomainRuntime({
      broadcaster,
      bus: { logger: silentLogger },
    });
    runtime.shutdown();
    expect(runtime.bridge.isStarted()).toBe(false);

    await runtime.bus.publish('evaluation.started', {
      evaluationId: 'e1',
      startedAt: '2026-05-10T00:00:00Z',
      environmentRef: 'env-1',
    });
    expect(broadcaster.calls).toHaveLength(0);
  });

  test('viability calculator is usable via the runtime', () => {
    const runtime = bootstrapDomainRuntime({
      broadcaster: new FakeBroadcaster(),
      bus: { logger: silentLogger },
    });
    try {
      expect(typeof runtime.viability.compute).toBe('function');
    } finally {
      runtime.shutdown();
    }
  });
});
