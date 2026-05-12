import {
  CostCollector,
  EfficiencyCollector,
  PerformanceCollector,
  QualityCollector,
  RobustnessCollector,
  createNativeCollectorSet,
} from '../../../src/domain/collectors/native-collectors';
import {
  collectAllDimensions,
  type EvaluationRunSummary,
  type RunStepSummary,
} from '../../../src/domain/metric-collector';

function step(overrides: Partial<RunStepSummary>): RunStepSummary {
  return {
    stepIndex: 0,
    recordedAt: '2026-05-10T00:00:00Z',
    kind: 'tool_call',
    status: 'ok',
    ...overrides,
  };
}

function run(
  overrides: Partial<EvaluationRunSummary> = {},
): EvaluationRunSummary {
  return {
    evaluationId: 'e1',
    runId: 'r1',
    startedAt: '2026-05-10T00:00:00Z',
    completedAt: '2026-05-10T00:01:00Z',
    outcome: 'success',
    steps: [],
    ...overrides,
  };
}

describe('PerformanceCollector', () => {
  test('derives tasksPassed from outcome when not provided', async () => {
    const collector = new PerformanceCollector({ tasksAttempted: 10 });
    const success = await collector.collect(run({ outcome: 'success' }));
    expect(success.tasksPassed).toBe(10);
    expect(success.taskSuccessRate.value).toBeCloseTo(1, 6);

    const failure = await collector.collect(run({ outcome: 'failure' }));
    expect(failure.tasksPassed).toBe(0);
    expect(failure.taskSuccessRate.value).toBeCloseTo(0, 6);
  });

  test('respects explicit tasksPassed and partialCredit', async () => {
    const collector = new PerformanceCollector({
      tasksAttempted: 10,
      tasksPassed: 6,
      partialCredit: 0.4,
    });
    const got = await collector.collect(run());
    expect(got.tasksPassed).toBe(6);
    expect(got.taskSuccessRate.value).toBeCloseTo(0.6, 6);
    expect(got.partialCredit.value).toBeCloseTo(0.4, 6);
  });

  test('rejects invalid configs at construction', () => {
    expect(() => new PerformanceCollector({ tasksAttempted: -1 })).toThrow(
      RangeError,
    );
    expect(
      () =>
        new PerformanceCollector({ tasksAttempted: 5, tasksPassed: 10 }),
    ).toThrow(RangeError);
    expect(
      () =>
        new PerformanceCollector({
          tasksAttempted: 1,
          partialCredit: 1.5,
        }),
    ).toThrow(RangeError);
  });

  test('zero tasksAttempted yields zero success rate without dividing by zero', async () => {
    const collector = new PerformanceCollector({ tasksAttempted: 0 });
    const got = await collector.collect(run());
    expect(got.taskSuccessRate.value).toBe(0);
    expect(got.tasksAttempted).toBe(0);
  });
});

describe('EfficiencyCollector', () => {
  test('measures executionTime from start/completed and averages step latency', async () => {
    const c = new EfficiencyCollector();
    const got = await c.collect(
      run({
        startedAt: '2026-05-10T00:00:00Z',
        completedAt: '2026-05-10T00:00:10Z',
        steps: [
          step({ stepIndex: 0, latencyMs: 100 }),
          step({ stepIndex: 1, latencyMs: 300 }),
        ],
      }),
    );
    expect(got.executionTime.milliseconds).toBe(10_000);
    expect(got.latencyPerStep.milliseconds).toBe(200);
    expect(got.totalSteps).toBe(2);
  });

  test('falls back to execution/totalSteps when step latency missing', async () => {
    const c = new EfficiencyCollector();
    const got = await c.collect(
      run({
        startedAt: '2026-05-10T00:00:00Z',
        completedAt: '2026-05-10T00:00:04Z',
        steps: [step({ stepIndex: 0 }), step({ stepIndex: 1 })],
      }),
    );
    expect(got.executionTime.milliseconds).toBe(4_000);
    expect(got.latencyPerStep.milliseconds).toBe(2_000);
  });

  test('zero-step run reports zero latency', async () => {
    const c = new EfficiencyCollector();
    const got = await c.collect(run({ steps: [] }));
    expect(got.totalSteps).toBe(0);
    expect(got.latencyPerStep.milliseconds).toBe(0);
  });
});

describe('CostCollector', () => {
  test('sums per-step tokens and USD', async () => {
    const c = new CostCollector();
    const got = await c.collect(
      run({
        steps: [
          step({ stepIndex: 0, tokensInput: 100, tokensOutput: 30, costUsd: 0.01 }),
          step({ stepIndex: 1, tokensInput: 50, tokensOutput: 20, costUsd: 0.005 }),
        ],
      }),
    );
    expect(got.tokens.input).toBe(150);
    expect(got.tokens.output).toBe(50);
    expect(got.estimatedCost.amount).toBeCloseTo(0.015, 6);
  });

  test('runs with no cost data report zero tokens and zero USD', async () => {
    const c = new CostCollector();
    const got = await c.collect(run({ steps: [step({ stepIndex: 0 })] }));
    expect(got.tokens.input).toBe(0);
    expect(got.tokens.output).toBe(0);
    expect(got.estimatedCost.amount).toBe(0);
  });
});

describe('RobustnessCollector', () => {
  test('measures tool-call error rate and recovery rate', async () => {
    const c = new RobustnessCollector();
    const got = await c.collect(
      run({
        steps: [
          step({ stepIndex: 0, status: 'error' }),
          step({ stepIndex: 1, status: 'ok' }), // recovery after fail
          step({ stepIndex: 2, status: 'error' }),
          step({ stepIndex: 3, status: 'error' }), // no recovery
          step({ stepIndex: 4, status: 'ok' }), // recovery
        ],
      }),
    );
    // 3 tool-call errors of 5 tool-calls = 0.6
    expect(got.toolCallErrorRate.value).toBeCloseTo(0.6, 6);
    // failures-followed-by-something = 3 (steps 0,2,3); recoveries = 2 (steps 0,3)
    expect(got.recoveryRate.value).toBeCloseTo(2 / 3, 6);
    expect(got.retries).toBe(3);
  });

  test('ignores non-tool_call steps for error rate denominator', async () => {
    const c = new RobustnessCollector();
    const got = await c.collect(
      run({
        steps: [
          step({ stepIndex: 0, kind: 'llm_call', status: 'error' }),
          step({ stepIndex: 1, kind: 'tool_call', status: 'ok' }),
        ],
      }),
    );
    expect(got.toolCallErrorRate.value).toBe(0);
    expect(got.retries).toBe(1);
  });

  test('handles empty step list', async () => {
    const c = new RobustnessCollector();
    const got = await c.collect(run({ steps: [] }));
    expect(got.toolCallErrorRate.value).toBe(0);
    expect(got.recoveryRate.value).toBe(0);
    expect(got.retries).toBe(0);
  });
});

describe('QualityCollector', () => {
  test('averages over judged tool-call steps only', async () => {
    const c = new QualityCollector();
    const got = await c.collect(
      run({
        steps: [
          step({
            stepIndex: 0,
            kind: 'tool_call',
            toolSelectionCorrect: true,
            parameterCorrect: false,
          }),
          step({
            stepIndex: 1,
            kind: 'tool_call',
            toolSelectionCorrect: false,
            parameterCorrect: true,
          }),
          step({
            stepIndex: 2,
            kind: 'tool_call', // unjudged
          }),
          step({
            stepIndex: 3,
            kind: 'llm_call', // ignored
            toolSelectionCorrect: true,
          }),
        ],
      }),
    );
    expect(got.toolSelectionAccuracy.value).toBeCloseTo(0.5, 6);
    expect(got.parameterAccuracy.value).toBeCloseTo(0.5, 6);
  });

  test('returns zero accuracy when nothing is judged', async () => {
    const c = new QualityCollector();
    const got = await c.collect(run({ steps: [step({ kind: 'tool_call' })] }));
    expect(got.toolSelectionAccuracy.value).toBe(0);
    expect(got.parameterAccuracy.value).toBe(0);
  });
});

describe('createNativeCollectorSet + collectAllDimensions', () => {
  test('produces one MetricDimension per family', async () => {
    const set = createNativeCollectorSet({
      performance: { tasksAttempted: 1 },
    });
    const dims = await collectAllDimensions(
      set,
      run({
        steps: [
          step({
            stepIndex: 0,
            kind: 'tool_call',
            status: 'ok',
            latencyMs: 100,
            tokensInput: 50,
            tokensOutput: 10,
            costUsd: 0.002,
            toolSelectionCorrect: true,
            parameterCorrect: true,
          }),
        ],
      }),
    );
    expect(dims.map((d) => d.dimension).sort()).toEqual([
      'cost',
      'efficiency',
      'performance',
      'quality',
      'robustness',
    ]);
  });
});
