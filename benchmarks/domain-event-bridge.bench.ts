/**
 * Micro-benchmark: end-to-end publish through bus + bridge + adapter.
 *
 * Run with: `npx tsx benchmarks/domain-event-bridge.bench.ts`
 *
 * Measures the cost of publishing one envelope and having it reach a
 * downstream broadcaster, exercising:
 *   DomainEventBus.publish()
 *     → DomainEventBus handler dispatch (per-correlationId queue)
 *       → DomainEventWebSocketBridge.relay()
 *         → WebSocketBroadcasterAdapter.broadcast()
 *           → Fake manager.broadcast() (no-op)
 *
 * Target (informational): ≥ 200k events/sec on a modern CPU. The bus
 * itself serialises per-correlation, so this is a sequential workload.
 */

import { performance } from 'node:perf_hooks';
import { DomainEventBus } from '../src/domain/event-bus';
import { DomainEventWebSocketBridge } from '../src/orchestrator/DomainEventWebSocketBridge';
import {
  WebSocketBroadcasterAdapter,
  type BroadcasterPort,
  type WebSocketWireMessage,
} from '../src/orchestrator/WebSocketBroadcasterAdapter';

class NoopManager implements BroadcasterPort {
  public received = 0;
  broadcast(_topic: string, _message: WebSocketWireMessage): void {
    this.received += 1;
  }
}

async function bench(label: string, iterations: number): Promise<void> {
  const bus = new DomainEventBus({
    logger: { warn: () => undefined, error: () => undefined },
    idempotencyCacheSize: iterations + 1024,
  });
  const manager = new NoopManager();
  const bridge = new DomainEventWebSocketBridge(
    bus,
    new WebSocketBroadcasterAdapter(manager),
  );
  bridge.start();

  // Warm-up
  for (let i = 0; i < 5_000; i++) {
    await bus.publish(
      'evaluation.step.recorded',
      {
        evaluationId: `warm-${i}`,
        stepIndex: 0,
        recordedAt: '2026-05-10T00:00:00Z',
        kind: 'tool_call',
        status: 'ok',
        summary: 's',
      },
      { eventId: `warm-${i}`, correlationId: `warm-${i}` },
    );
  }

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    await bus.publish(
      'evaluation.step.recorded',
      {
        evaluationId: `e-${i}`,
        stepIndex: i,
        recordedAt: '2026-05-10T00:00:00Z',
        kind: 'tool_call',
        status: 'ok',
        summary: 's',
      },
      { eventId: `bench-${i}`, correlationId: `c-${i}` },
    );
  }
  const elapsedMs = performance.now() - t0;
  const opsPerSec = (iterations / elapsedMs) * 1000;

  /* eslint-disable no-console */
  console.log(`\n=== ${label} ===`);
  console.log(`  iterations:   ${iterations.toLocaleString()}`);
  console.log(`  delivered:    ${manager.received.toLocaleString()}`);
  console.log(`  elapsed:      ${elapsedMs.toFixed(2)} ms`);
  console.log(`  ops/sec:      ${Math.round(opsPerSec).toLocaleString()}`);
  console.log(`  per op (avg): ${(elapsedMs / iterations).toFixed(4)} ms`);
  /* eslint-enable no-console */
}

await bench('bus → bridge → adapter (hot)', 100_000);
