import {
  InMemoryAgentRepository,
  InMemoryEvaluationRepository,
  InMemoryMetricSetRepository,
} from '../../../src/domain/in-memory/InMemoryRepositories';
import {
  InMemoryAnalyticsQueryService,
  InMemoryEvaluationQueryService,
  InMemoryLeaderboardQueryService,
} from '../../../src/domain/in-memory/InMemoryQueryServices';
import {
  type MetricSet,
  createDuration,
  createMoney,
  createPercentage,
  createTokenCount,
} from '../../../src/domain/metric-set';
import type {
  AgentId,
  BenchmarkId,
  EvaluationId,
  MetricSetId,
} from '../../../src/domain/contracts';

const agentId = (s: string) => s as AgentId;
const benchmarkId = (s: string) => s as BenchmarkId;
const evalId = (s: string) => s as EvaluationId;
const metricSetId = (s: string) => s as MetricSetId;

function metricSet(
  id: string,
  evaluation: string,
  opts: {
    perfSuccess?: number;
    tasksPassed?: number;
    tasksAttempted?: number;
    executionMs?: number;
    costUsd?: number;
    tokensInput?: number;
    tokensOutput?: number;
    parameterAccuracy?: number;
    errorRate?: number;
    viability?: number;
  } = {},
): MetricSet {
  return {
    id: metricSetId(id),
    evaluationId: evalId(evaluation),
    state: 'finalised',
    dimensions: [
      {
        dimension: 'performance',
        taskSuccessRate: createPercentage(opts.perfSuccess ?? 0.8),
        partialCredit: createPercentage(0.7),
        tasksAttempted: opts.tasksAttempted ?? 10,
        tasksPassed: opts.tasksPassed ?? 8,
      },
      {
        dimension: 'efficiency',
        executionTime: createDuration(opts.executionMs ?? 60_000),
        latencyPerStep: createDuration(500),
        totalSteps: 20,
      },
      {
        dimension: 'cost',
        tokens: createTokenCount(
          opts.tokensInput ?? 1000,
          opts.tokensOutput ?? 200,
        ),
        estimatedCost: createMoney(opts.costUsd ?? 0.1),
      },
      {
        dimension: 'robustness',
        toolCallErrorRate: createPercentage(opts.errorRate ?? 0.05),
        recoveryRate: createPercentage(0.9),
        retries: 1,
      },
      {
        dimension: 'quality',
        toolSelectionAccuracy: createPercentage(0.9),
        parameterAccuracy: createPercentage(opts.parameterAccuracy ?? 0.85),
      },
    ],
    viabilityScore: {
      value: createPercentage(opts.viability ?? 0.75),
      weights: {
        performance: 0.35,
        efficiency: 0.15,
        cost: 0.15,
        robustness: 0.15,
        quality: 0.2,
      },
      version: '1.0.0',
    },
    replacesMetricSetId: null,
    createdAt: '2026-05-10T00:00:00Z',
    finalisedAt: '2026-05-10T00:01:00Z',
  };
}

function evaluation(
  id: string,
  agent: string,
  benchmark: string,
  submittedAt: string,
  state: 'queued' | 'running' | 'completed' = 'completed',
) {
  return {
    id: evalId(id),
    agentId: agentId(agent),
    benchmarkId: benchmarkId(benchmark),
    state,
    submittedAt,
    completedAt: state === 'completed' ? submittedAt : null,
    steps: [],
  };
}

describe('InMemoryEvaluationQueryService', () => {
  test('recentForAgent returns newest-first, capped at limit', async () => {
    const evals = new InMemoryEvaluationRepository();
    for (let i = 0; i < 5; i++) {
      await evals.save(
        evaluation(`e${i}`, 'a1', 'b1', `2026-05-1${i}T00:00:00Z`),
      );
    }
    const svc = new InMemoryEvaluationQueryService(evals);
    const got = await svc.recentForAgent(agentId('a1'), 3);
    expect(got.map((e) => e.id)).toEqual(['e4', 'e3', 'e2']);
  });
});

describe('InMemoryLeaderboardQueryService', () => {
  test('byBenchmark groups by agent and ranks by viability', async () => {
    const evals = new InMemoryEvaluationRepository();
    const agents = new InMemoryAgentRepository([
      {
        id: agentId('a1'),
        name: 'Agent A',
        provider: 'p',
        fingerprint: 'sha256:1',
        state: 'active',
      },
      {
        id: agentId('a2'),
        name: 'Agent B',
        provider: 'p',
        fingerprint: 'sha256:2',
        state: 'active',
      },
    ]);
    const sets = new InMemoryMetricSetRepository();

    await evals.save(evaluation('e1', 'a1', 'b1', '2026-05-10T00:00:00Z'));
    await evals.save(evaluation('e2', 'a2', 'b1', '2026-05-10T01:00:00Z'));
    await sets.save(metricSet('m1', 'e1', { viability: 0.9 }));
    await sets.save(metricSet('m2', 'e2', { viability: 0.6 }));

    const svc = new InMemoryLeaderboardQueryService(evals, agents, sets);
    const board = await svc.byBenchmark(benchmarkId('b1'), {});
    expect(board.map((e) => e.agentId)).toEqual(['a1', 'a2']);
    expect(board[0].viabilityScore).toBeCloseTo(0.9, 6);
    expect(board[0].agentName).toBe('Agent A');
  });

  test('window filter restricts considered evaluations', async () => {
    const evals = new InMemoryEvaluationRepository();
    const agents = new InMemoryAgentRepository([
      {
        id: agentId('a1'),
        name: 'A',
        provider: 'p',
        fingerprint: 'sha256:1',
        state: 'active',
      },
    ]);
    const sets = new InMemoryMetricSetRepository();

    await evals.save(evaluation('e1', 'a1', 'b1', '2026-05-01T00:00:00Z'));
    await evals.save(evaluation('e2', 'a1', 'b1', '2026-05-10T00:00:00Z'));
    await sets.save(metricSet('m1', 'e1', { viability: 0.9 }));
    await sets.save(metricSet('m2', 'e2', { viability: 0.5 }));

    const svc = new InMemoryLeaderboardQueryService(evals, agents, sets);
    const board = await svc.byBenchmark(benchmarkId('b1'), {
      window: { from: '2026-05-09T00:00:00Z', to: '2026-05-31T00:00:00Z' },
    });
    expect(board[0].evaluationsConsidered).toBe(1);
    expect(board[0].viabilityScore).toBeCloseTo(0.5, 6);
  });

  test('global() with dimension slice ranks by that dimension', async () => {
    const evals = new InMemoryEvaluationRepository();
    const agents = new InMemoryAgentRepository([
      {
        id: agentId('a1'),
        name: 'A',
        provider: 'p',
        fingerprint: 'sha256:1',
        state: 'active',
      },
      {
        id: agentId('a2'),
        name: 'B',
        provider: 'p',
        fingerprint: 'sha256:2',
        state: 'active',
      },
    ]);
    const sets = new InMemoryMetricSetRepository();

    await evals.save(evaluation('e1', 'a1', 'b1', '2026-05-10T00:00:00Z'));
    await evals.save(evaluation('e2', 'a2', 'b1', '2026-05-10T00:00:00Z'));
    // a1 has lower viability but better quality
    await sets.save(
      metricSet('m1', 'e1', { viability: 0.5, parameterAccuracy: 0.99 }),
    );
    await sets.save(
      metricSet('m2', 'e2', { viability: 0.9, parameterAccuracy: 0.5 }),
    );

    const svc = new InMemoryLeaderboardQueryService(evals, agents, sets);
    const board = await svc.global({ dimension: 'quality' });
    expect(board[0].agentId).toBe('a1');
  });
});

describe('InMemoryAnalyticsQueryService', () => {
  test('costByAgent sums tokens and USD across the window', async () => {
    const evals = new InMemoryEvaluationRepository();
    const sets = new InMemoryMetricSetRepository();

    await evals.save(evaluation('e1', 'a1', 'b1', '2026-05-10T00:00:00Z'));
    await evals.save(evaluation('e2', 'a1', 'b1', '2026-05-10T01:00:00Z'));
    await evals.save(evaluation('e3', 'a2', 'b1', '2026-05-10T01:00:00Z'));
    await sets.save(
      metricSet('m1', 'e1', { tokensInput: 100, tokensOutput: 50, costUsd: 0.2 }),
    );
    await sets.save(
      metricSet('m2', 'e2', { tokensInput: 200, tokensOutput: 75, costUsd: 0.3 }),
    );
    await sets.save(
      metricSet('m3', 'e3', { tokensInput: 50, tokensOutput: 10, costUsd: 0.1 }),
    );

    const svc = new InMemoryAnalyticsQueryService(evals, sets);
    const summary = await svc.costByAgent({
      from: '2026-05-09T00:00:00Z',
      to: '2026-05-11T00:00:00Z',
    });

    const a1 = summary.find((s) => s.agentId === 'a1');
    const a2 = summary.find((s) => s.agentId === 'a2');
    expect(a1?.tokensInput).toBe(300);
    expect(a1?.tokensOutput).toBe(125);
    expect(a1?.amountUsd).toBeCloseTo(0.5, 6);
    expect(a2?.tokensInput).toBe(50);
    expect(a2?.amountUsd).toBeCloseTo(0.1, 6);
  });

  test('successRateTrend buckets by UTC day with passed/attempted ratio', async () => {
    const evals = new InMemoryEvaluationRepository();
    const sets = new InMemoryMetricSetRepository();

    await evals.save(evaluation('e1', 'a1', 'b1', '2026-05-10T01:00:00Z'));
    await evals.save(evaluation('e2', 'a1', 'b1', '2026-05-10T05:00:00Z'));
    await evals.save(evaluation('e3', 'a1', 'b1', '2026-05-11T01:00:00Z'));

    await sets.save(
      metricSet('m1', 'e1', { tasksPassed: 8, tasksAttempted: 10 }),
    );
    await sets.save(
      metricSet('m2', 'e2', { tasksPassed: 4, tasksAttempted: 10 }),
    );
    await sets.save(
      metricSet('m3', 'e3', { tasksPassed: 9, tasksAttempted: 10 }),
    );

    const svc = new InMemoryAnalyticsQueryService(evals, sets);
    const trend = await svc.successRateTrend(agentId('a1'), {
      from: '2026-05-09T00:00:00Z',
      to: '2026-05-12T00:00:00Z',
    });

    expect(trend).toEqual([
      { bucketStart: '2026-05-10T00:00:00Z', value: 0.6 }, // 12/20
      { bucketStart: '2026-05-11T00:00:00Z', value: 0.9 }, // 9/10
    ]);
  });
});
