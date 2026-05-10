/**
 * Micro-benchmark: ProcessViabilityCalculator.compute().
 *
 * Run with: `npx tsx benchmarks/process-viability-calculator.bench.ts`
 *
 * Goal: establish a baseline. The calculator is on the hot path of the
 * Metrics context — every finalised MetricSet calls it exactly once. We do
 * not need millions of computations per second in production, but a clean
 * baseline lets us spot regressions.
 *
 * Targets (informational, not enforced in CI):
 *   ≥ 1,000,000 ops/sec on a modern x86-64 CPU.
 *   p99 < 5 µs per computation.
 */

import { performance } from 'node:perf_hooks';
import { DefaultProcessViabilityCalculator } from '../src/domain/process-viability-calculator';
import {
  type MetricDimension,
  createDuration,
  createMoney,
  createPercentage,
  createTokenCount,
} from '../src/domain/metric-set';

const dimensions: MetricDimension[] = [
  {
    dimension: 'performance',
    taskSuccessRate: createPercentage(0.82),
    partialCredit: createPercentage(0.7),
    tasksAttempted: 50,
    tasksPassed: 41,
  },
  {
    dimension: 'efficiency',
    executionTime: createDuration(120_000),
    latencyPerStep: createDuration(800),
    totalSteps: 35,
  },
  {
    dimension: 'cost',
    tokens: createTokenCount(120_000, 18_000),
    estimatedCost: createMoney(0.42),
  },
  {
    dimension: 'robustness',
    toolCallErrorRate: createPercentage(0.04),
    recoveryRate: createPercentage(0.9),
    retries: 3,
  },
  {
    dimension: 'quality',
    toolSelectionAccuracy: createPercentage(0.91),
    parameterAccuracy: createPercentage(0.88),
  },
];

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor((p / 100) * sortedAsc.length)),
  );
  return sortedAsc[idx];
}

function bench(label: string, iterations: number): void {
  const calc = new DefaultProcessViabilityCalculator();

  // Warm-up: let V8 JIT settle.
  for (let i = 0; i < 50_000; i++) calc.compute(dimensions);

  // Latency samples (subset to keep array small).
  const sampleEvery = Math.max(1, Math.floor(iterations / 10_000));
  const samples: number[] = [];

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    if (i % sampleEvery === 0) {
      const s = performance.now();
      calc.compute(dimensions);
      samples.push(performance.now() - s);
    } else {
      calc.compute(dimensions);
    }
  }
  const elapsedMs = performance.now() - t0;

  samples.sort((a, b) => a - b);
  const opsPerSec = (iterations / elapsedMs) * 1000;

  /* eslint-disable no-console */
  console.log(`\n=== ${label} ===`);
  console.log(`  iterations:   ${iterations.toLocaleString()}`);
  console.log(`  elapsed:      ${elapsedMs.toFixed(2)} ms`);
  console.log(`  ops/sec:      ${Math.round(opsPerSec).toLocaleString()}`);
  console.log(
    `  per op p50:   ${percentile(samples, 50).toFixed(4)} ms`,
  );
  console.log(
    `  per op p99:   ${percentile(samples, 99).toFixed(4)} ms`,
  );
  console.log(
    `  per op p99.9: ${percentile(samples, 99.9).toFixed(4)} ms`,
  );
  /* eslint-enable no-console */
}

bench('ProcessViabilityCalculator.compute (hot)', 500_000);
