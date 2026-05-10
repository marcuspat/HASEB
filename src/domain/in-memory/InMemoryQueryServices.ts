/**
 * In-memory implementations of the read-side query services.
 *
 * These compose the InMemory* repositories to serve cross-aggregate
 * read models (leaderboards, trends, cost analytics) without a database.
 * Useful in tests and as a reference implementation for the eventual
 * SQL-backed query services.
 *
 * Conventions:
 * - Read-only. The constructors take repositories and a MetricSet store.
 * - Time windows use exclusive `to`.
 * - All sorts are stable and documented per method.
 */

import type {
  AgentId,
  AgentSummary,
  BenchmarkId,
  CostSummary,
  EvaluationId,
  EvaluationSummary,
  IAnalyticsQueryService,
  IEvaluationQueryService,
  ILeaderboardQueryService,
  IMetricSetRepository,
  LeaderboardEntry,
  LeaderboardSlice,
  TimeWindow,
  TrendPoint,
} from '../contracts';
import type {
  CostMetric,
  MetricDimension,
  MetricSet,
  PerformanceMetric,
  ProcessViabilityScore,
} from '../metric-set';
import {
  InMemoryAgentRepository,
  InMemoryEvaluationRepository,
} from './InMemoryRepositories';

interface CompletedEvaluationLike {
  readonly id: EvaluationId;
  readonly agentId: AgentId;
  readonly benchmarkId: BenchmarkId;
  readonly state: string;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly metricSetId?: string | null;
  readonly correlationId?: string | null;
}

function inWindow(timestamp: string, window?: TimeWindow): boolean {
  if (!window) return true;
  return timestamp >= window.from && timestamp < window.to;
}

function findDimension<TName extends MetricDimension['dimension']>(
  set: MetricSet,
  name: TName,
): Extract<MetricDimension, { dimension: TName }> | undefined {
  return set.dimensions.find((d) => d.dimension === name) as
    | Extract<MetricDimension, { dimension: TName }>
    | undefined;
}

function viabilityValue(score: ProcessViabilityScore | null): number {
  if (!score) return 0;
  return score.value.value;
}

function dimensionValue(set: MetricSet, dim: NonNullable<LeaderboardSlice['dimension']>): number {
  switch (dim) {
    case 'performance': {
      const m = findDimension(set, 'performance');
      return m ? m.taskSuccessRate.value : 0;
    }
    case 'efficiency': {
      const m = findDimension(set, 'efficiency');
      if (!m) return 0;
      // Lower-is-better → invert against 30-minute reference, clamped.
      const refMs = 30 * 60 * 1000;
      return Math.max(0, Math.min(1, 1 - m.executionTime.milliseconds / refMs));
    }
    case 'cost': {
      const m = findDimension(set, 'cost');
      if (!m) return 0;
      const refUsd = 10;
      return Math.max(0, Math.min(1, 1 - m.estimatedCost.amount / refUsd));
    }
    case 'robustness': {
      const m = findDimension(set, 'robustness');
      return m ? 1 - m.toolCallErrorRate.value : 0;
    }
    case 'quality': {
      const m = findDimension(set, 'quality');
      return m ? m.parameterAccuracy.value : 0;
    }
  }
}

// --- Evaluation query service -----------------------------------------------

export class InMemoryEvaluationQueryService implements IEvaluationQueryService {
  constructor(private readonly evaluations: InMemoryEvaluationRepository) {}

  async recentForAgent(
    agentId: AgentId,
    limit: number,
  ): Promise<readonly EvaluationSummary[]> {
    const page = await this.evaluations.listSummaries(
      { agentId },
      { offset: 0, limit: Math.max(1, Math.min(200, limit)) },
    );
    return page.items;
  }

  async byCorrelationId(
    _correlationId: string,
  ): Promise<readonly EvaluationSummary[]> {
    // Correlation IDs are not part of the in-memory aggregate shape today;
    // returning empty preserves the contract until the field is wired
    // through. The PG/SQLite implementation will index by correlation_id.
    return [];
  }
}

// --- Leaderboard query service ----------------------------------------------

export class InMemoryLeaderboardQueryService
  implements ILeaderboardQueryService
{
  constructor(
    private readonly evaluations: InMemoryEvaluationRepository,
    private readonly agents: InMemoryAgentRepository,
    private readonly metricSets: IMetricSetRepository,
  ) {}

  async byBenchmark(
    benchmarkId: BenchmarkId,
    slice: LeaderboardSlice,
  ): Promise<readonly LeaderboardEntry[]> {
    return this.compute({ benchmarkId, slice });
  }

  async global(slice: LeaderboardSlice): Promise<readonly LeaderboardEntry[]> {
    return this.compute({ slice });
  }

  private async compute(args: {
    readonly benchmarkId?: BenchmarkId;
    readonly slice: LeaderboardSlice;
  }): Promise<readonly LeaderboardEntry[]> {
    const limit = Math.max(1, Math.min(200, args.slice.limit ?? 50));

    // Source: every evaluation in the in-memory store. We lean on
    // `listSummaries` to honour the same paging guarantees.
    const all = await this.evaluations.listSummaries(
      args.benchmarkId
        ? { state: 'completed', benchmarkId: args.benchmarkId }
        : { state: 'completed' },
      { offset: 0, limit: 10_000 },
    );

    type Bucket = {
      readonly agentId: AgentId;
      readonly benchmarkId: BenchmarkId;
      sumViability: number;
      perDim: Record<string, number>;
      perDimCount: number;
      count: number;
    };
    const buckets = new Map<string, Bucket>();

    for (const ev of all.items) {
      if (!inWindow(ev.submittedAt, args.slice.window)) continue;
      const set = await this.metricSets.findByEvaluationId(ev.id);
      if (!set) continue;
      const m = set as MetricSet;

      const key = `${ev.agentId}::${ev.benchmarkId}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          agentId: ev.agentId,
          benchmarkId: ev.benchmarkId,
          sumViability: 0,
          perDim: {},
          perDimCount: 0,
          count: 0,
        };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      bucket.sumViability += viabilityValue(m.viabilityScore);

      for (const dim of m.dimensions) {
        const v = dimensionValue(m, dim.dimension);
        bucket.perDim[dim.dimension] = (bucket.perDim[dim.dimension] ?? 0) + v;
      }
      bucket.perDimCount += 1;
    }

    const agentSummaries = await this.agents.list(
      {},
      { offset: 0, limit: 10_000 },
    );
    const agentNameById = new Map<AgentId, string>(
      agentSummaries.items.map((a: AgentSummary) => [a.id, a.name]),
    );

    const entries: LeaderboardEntry[] = Array.from(buckets.values()).map(
      (b) => {
        const perDimension: Record<string, number> = {};
        for (const [k, v] of Object.entries(b.perDim)) {
          perDimension[k] = b.perDimCount > 0 ? v / b.perDimCount : 0;
        }
        return {
          agentId: b.agentId,
          agentName: agentNameById.get(b.agentId) ?? '(unknown)',
          benchmarkId: b.benchmarkId,
          viabilityScore: b.count > 0 ? b.sumViability / b.count : 0,
          perDimension,
          evaluationsConsidered: b.count,
        };
      },
    );

    const sortKey: (e: LeaderboardEntry) => number = args.slice.dimension
      ? (e) => e.perDimension[args.slice.dimension as string] ?? 0
      : (e) => e.viabilityScore;

    entries.sort((a, b) => sortKey(b) - sortKey(a));
    return entries.slice(0, limit);
  }
}

// --- Analytics query service ------------------------------------------------

export class InMemoryAnalyticsQueryService implements IAnalyticsQueryService {
  constructor(
    private readonly evaluations: InMemoryEvaluationRepository,
    private readonly metricSets: IMetricSetRepository,
  ) {}

  async costByAgent(window: TimeWindow): Promise<readonly CostSummary[]> {
    const all = await this.evaluations.listSummaries(
      { state: 'completed' },
      { offset: 0, limit: 10_000 },
    );

    type Acc = {
      tokensInput: number;
      tokensOutput: number;
      amountUsd: number;
    };
    const byAgent = new Map<AgentId, Acc>();

    for (const ev of all.items) {
      if (!inWindow(ev.submittedAt, window)) continue;
      const set = (await this.metricSets.findByEvaluationId(ev.id)) as
        | MetricSet
        | null;
      if (!set) continue;
      const cost = findDimension(set, 'cost') as CostMetric | undefined;
      if (!cost) continue;

      const acc = byAgent.get(ev.agentId) ?? {
        tokensInput: 0,
        tokensOutput: 0,
        amountUsd: 0,
      };
      acc.tokensInput += cost.tokens.input;
      acc.tokensOutput += cost.tokens.output;
      acc.amountUsd += cost.estimatedCost.amount;
      byAgent.set(ev.agentId, acc);
    }

    return Array.from(byAgent.entries()).map(
      ([agentId, acc]): CostSummary => ({
        agentId,
        window,
        tokensInput: acc.tokensInput,
        tokensOutput: acc.tokensOutput,
        amountUsd: Math.round(acc.amountUsd * 1_000_000) / 1_000_000,
      }),
    );
  }

  async successRateTrend(
    agentId: AgentId,
    window: TimeWindow,
  ): Promise<readonly TrendPoint[]> {
    const all = await this.evaluations.listSummaries(
      { agentId },
      { offset: 0, limit: 10_000 },
    );

    // Bucket by ISO date (UTC day).
    const buckets = new Map<string, { passed: number; total: number }>();

    for (const ev of all.items) {
      if (!inWindow(ev.submittedAt, window)) continue;
      const day = ev.submittedAt.slice(0, 10);
      const bucket = buckets.get(day) ?? { passed: 0, total: 0 };

      const set = (await this.metricSets.findByEvaluationId(ev.id)) as
        | MetricSet
        | null;
      const perf = set
        ? (findDimension(set, 'performance') as PerformanceMetric | undefined)
        : undefined;

      if (perf) {
        bucket.passed += perf.tasksPassed;
        bucket.total += perf.tasksAttempted;
      }
      buckets.set(day, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, { passed, total }]): TrendPoint => ({
        bucketStart: `${day}T00:00:00Z`,
        value: total > 0 ? passed / total : 0,
      }));
  }
}

// Convenience export type to keep external tests narrow.
export type { CompletedEvaluationLike };
