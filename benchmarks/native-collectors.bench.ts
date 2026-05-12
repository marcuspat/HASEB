/**
 * Micro-benchmark: full five-dimension collection over a realistic run.
 *
 * Run with: `npx tsx benchmarks/native-collectors.bench.ts`
 *
 * Measures the cost of producing one finalised set of dimensions from a
 * single `EvaluationRunSummary`. Together with the calculator benchmark,
 * this gives us a per-evaluation worst case for the Metrics context.
 *
 * Target (informational): ≥ 100k full collections/sec on a modern CPU
 * for a ~50-step run.
 */

import { performance } from 'node:perf_hooks';
import { createNativeCollectorSet } from '../src/domain/collectors/native-collectors';
import {
  collectAllDimensions,
  type EvaluationRunSummary,
  type RunStepSummary,
} from '../src/domain/metric-collector';

function makeSteps(n: number): RunStepSummary[] {
  const out: RunStepSummary[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      stepIndex: i,
      recordedAt: new Date(Date.UTC(2026, 4, 10, 0, 0, i)).toISOString(),
      kind: i % 5 === 0 ? 'llm_call' : 'tool_call',
      status: i % 13 === 0 ? 'error' : 'ok',
      summary: `step ${i}`,
      latencyMs: 200 + (i % 50),
      tokensInput: 80 + (i % 20),
      tokensOutput: 25 + (i % 10),
      costUsd: 0.0006 + (i % 7) * 0.00002,
      toolSelectionCorrect: i % 3 !== 0,
      parameterCorrect: i % 4 !== 0,
    });
  }
  return out;
}

function makeRun(stepCount: number): EvaluationRunSummary {
  return {
    evaluationId: `e-${stepCount}`,
    runId: `r-${stepCount}`,
    startedAt: '2026-05-10T00:00:00Z',
    completedAt: '2026-05-10T00:01:00Z',
    outcome: 'success',
    steps: makeSteps(stepCount),
  };
}

async function bench(
  label: string,
  iterations: number,
  stepCount: number,
): Promise<void> {
  const run = makeRun(stepCount);
  const set = createNativeCollectorSet({
    performance: { tasksAttempted: 1 },
  });

  // Warm-up.
  for (let i = 0; i < 1_000; i++) await collectAllDimensions(set, run);

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    await collectAllDimensions(set, run);
  }
  const elapsedMs = performance.now() - t0;
  const opsPerSec = (iterations / elapsedMs) * 1000;

  /* eslint-disable no-console */
  console.log(`\n=== ${label} (${stepCount} steps) ===`);
  console.log(`  iterations:   ${iterations.toLocaleString()}`);
  console.log(`  elapsed:      ${elapsedMs.toFixed(2)} ms`);
  console.log(`  full sets/s:  ${Math.round(opsPerSec).toLocaleString()}`);
  console.log(`  per set:      ${(elapsedMs / iterations).toFixed(4)} ms`);
  /* eslint-enable no-console */
}

await bench('collectAllDimensions', 50_000, 50);
await bench('collectAllDimensions', 10_000, 250);
