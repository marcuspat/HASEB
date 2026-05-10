/**
 * Domain repository contracts (ports).
 *
 * One contract per aggregate root. See docs/ddd/repositories.md and
 * docs/ddd/aggregates.md.
 *
 * Implementations live in `src/database/models/` (today's layout combines
 * mappers and queries). New code should depend on these interfaces, not on
 * the concrete model classes — this is the seam that ADR 0017 (Repository
 * pattern) is built on.
 *
 * NOTE: pre-existing `EvaluationModel`, `AgentModel`, `BenchmarkModel`, and
 * `UserModel` are *not* yet migrated to satisfy these contracts; doing so is
 * tracked under the implementation backlog. The contracts are introduced
 * first so application services and tests can be written against them.
 */

export interface Pagination {
  readonly offset: number;
  readonly limit: number;
}

export interface Paged<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly pagination: Pagination;
}

export interface TimeWindow {
  readonly from: string;
  readonly to: string;
}

// --- Identifiers (branded for safety) ---------------------------------------

export type EvaluationId = string & { readonly __brand: 'EvaluationId' };
export type AgentId = string & { readonly __brand: 'AgentId' };
export type BenchmarkId = string & { readonly __brand: 'BenchmarkId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type MetricSetId = string & { readonly __brand: 'MetricSetId' };

// --- Aggregate-shape forward declarations -----------------------------------
// Concrete shapes live alongside their persistence mappers; contracts declare
// the public-facing fields each aggregate exposes to repositories. This keeps
// the dependency direction pointing *into* the domain layer while still
// letting tests and in-memory implementations type-check their literals.

export interface EvaluationAggregate {
  readonly id: EvaluationId;
  readonly agentId: AgentId;
  readonly benchmarkId: BenchmarkId;
  readonly state: EvaluationState;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly steps?: readonly EvaluationStep[];
}

export interface AgentAggregate {
  readonly id: AgentId;
  readonly name: string;
  readonly provider: string;
  readonly fingerprint: string;
  readonly state: 'active' | 'archived';
}

export interface BenchmarkAggregate {
  readonly id: BenchmarkId;
  readonly name: string;
  readonly version: string;
  readonly kind: 'code' | 'gui' | 'reasoning';
  readonly state: 'active' | 'deprecated';
}

export interface UserAggregate {
  readonly id: UserId;
  readonly email: string;
  readonly refreshTokens?: ReadonlyMap<string, RefreshTokenRecord>;
}

export interface MetricSetAggregate {
  readonly id: MetricSetId;
  readonly evaluationId?: EvaluationId;
}

// --- Repository contracts ---------------------------------------------------

export type EvaluationState =
  | 'queued'
  | 'running'
  | 'collecting'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface EvaluationFilter {
  readonly state?: EvaluationState;
  readonly agentId?: AgentId;
  readonly benchmarkId?: BenchmarkId;
  readonly submittedById?: UserId;
}

export interface EvaluationSummary {
  readonly id: EvaluationId;
  readonly agentId: AgentId;
  readonly benchmarkId: BenchmarkId;
  readonly state: EvaluationState;
  readonly submittedAt: string;
  readonly completedAt: string | null;
}

export interface EvaluationStep {
  readonly evaluationId: EvaluationId;
  readonly stepIndex: number;
  readonly recordedAt: string;
  readonly kind: 'tool_call' | 'llm_call' | 'screen_action' | 'other';
  readonly status: 'ok' | 'error';
  readonly summary: string;
  readonly payload?: unknown;
}

export interface IEvaluationRepository {
  save(evaluation: EvaluationAggregate): Promise<void>;
  findById(id: EvaluationId): Promise<EvaluationAggregate | null>;
  findByIdOrThrow(id: EvaluationId): Promise<EvaluationAggregate>;
  appendStep(evaluationId: EvaluationId, step: EvaluationStep): Promise<void>;
  listSummaries(
    filter: EvaluationFilter,
    page: Pagination,
  ): Promise<Paged<EvaluationSummary>>;
  countByState(state: EvaluationState): Promise<number>;
}

export interface AgentFilter {
  readonly provider?: string;
  readonly state?: 'active' | 'archived';
}

export interface AgentSummary {
  readonly id: AgentId;
  readonly name: string;
  readonly provider: string;
  readonly fingerprint: string;
  readonly state: 'active' | 'archived';
}

export interface IAgentRepository {
  save(agent: AgentAggregate): Promise<void>;
  findById(id: AgentId): Promise<AgentAggregate | null>;
  findByFingerprint(fingerprint: string): Promise<AgentAggregate | null>;
  list(
    filter: AgentFilter,
    page: Pagination,
  ): Promise<Paged<AgentSummary>>;
}

export interface BenchmarkFilter {
  readonly kind?: 'code' | 'gui' | 'reasoning';
  readonly state?: 'active' | 'deprecated';
}

export interface BenchmarkSummary {
  readonly id: BenchmarkId;
  readonly name: string;
  readonly version: string;
  readonly kind: 'code' | 'gui' | 'reasoning';
  readonly state: 'active' | 'deprecated';
}

export interface IBenchmarkRepository {
  save(benchmark: BenchmarkAggregate): Promise<void>;
  findById(id: BenchmarkId): Promise<BenchmarkAggregate | null>;
  list(
    filter: BenchmarkFilter,
    page: Pagination,
  ): Promise<Paged<BenchmarkSummary>>;
}

export interface RefreshTokenRecord {
  readonly id: string;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface IUserRepository {
  save(user: UserAggregate): Promise<void>;
  findById(id: UserId): Promise<UserAggregate | null>;
  findByEmail(email: string): Promise<UserAggregate | null>;
  insertRefreshToken(token: RefreshTokenRecord): Promise<void>;
  revokeRefreshToken(tokenId: string): Promise<void>;
}

export interface IMetricSetRepository {
  save(set: MetricSetAggregate): Promise<void>;
  findById(id: MetricSetId): Promise<MetricSetAggregate | null>;
  findByEvaluationId(id: EvaluationId): Promise<MetricSetAggregate | null>;
}

// --- Read-side query services -----------------------------------------------

export interface IEvaluationQueryService {
  recentForAgent(
    agentId: AgentId,
    limit: number,
  ): Promise<readonly EvaluationSummary[]>;
  byCorrelationId(
    correlationId: string,
  ): Promise<readonly EvaluationSummary[]>;
}

export interface LeaderboardSlice {
  readonly window?: TimeWindow;
  readonly dimension?:
    | 'performance'
    | 'efficiency'
    | 'cost'
    | 'robustness'
    | 'quality';
  readonly limit?: number;
}

export interface LeaderboardEntry {
  readonly agentId: AgentId;
  readonly agentName: string;
  readonly benchmarkId: BenchmarkId;
  readonly viabilityScore: number;
  readonly perDimension: Readonly<Record<string, number>>;
  readonly evaluationsConsidered: number;
}

export interface ILeaderboardQueryService {
  byBenchmark(
    benchmarkId: BenchmarkId,
    slice: LeaderboardSlice,
  ): Promise<readonly LeaderboardEntry[]>;
  global(slice: LeaderboardSlice): Promise<readonly LeaderboardEntry[]>;
}

export interface CostSummary {
  readonly agentId: AgentId;
  readonly window: TimeWindow;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly amountUsd: number;
}

export interface TrendPoint {
  readonly bucketStart: string;
  readonly value: number;
}

export interface IAnalyticsQueryService {
  costByAgent(window: TimeWindow): Promise<readonly CostSummary[]>;
  successRateTrend(
    agentId: AgentId,
    window: TimeWindow,
  ): Promise<readonly TrendPoint[]>;
}

// --- Common error type ------------------------------------------------------

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
