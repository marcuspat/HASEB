/**
 * In-memory implementations of the repository contracts.
 *
 * Used to drive application-service tests without a database while the real
 * PostgreSQL / SQLite adapters are still being built. The contracts they
 * satisfy live in `src/domain/contracts/`.
 *
 * Semantics:
 * - Storage is a Map keyed by aggregate id.
 * - Saves are upserts (replace by id).
 * - Pagination is applied after filtering.
 * - All return values are immutable snapshots; the internal store is not
 *   exposed so callers cannot accidentally mutate state.
 * - Construction may take a `seed` array to pre-populate the store.
 */

import type {
  AgentAggregate,
  AgentFilter,
  AgentId,
  AgentSummary,
  BenchmarkAggregate,
  BenchmarkFilter,
  BenchmarkId,
  BenchmarkSummary,
  EvaluationAggregate,
  EvaluationFilter,
  EvaluationId,
  EvaluationState,
  EvaluationStep,
  EvaluationSummary,
  IAgentRepository,
  IBenchmarkRepository,
  IEvaluationRepository,
  IMetricSetRepository,
  IUserRepository,
  MetricSetAggregate,
  MetricSetId,
  Paged,
  Pagination,
  RefreshTokenRecord,
  UserAggregate,
  UserId,
} from '../contracts';
import { RepositoryError } from '../contracts';

interface EvaluationStored extends EvaluationAggregate {
  readonly agentId: AgentId;
  readonly benchmarkId: BenchmarkId;
  readonly state: EvaluationState;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly steps: readonly EvaluationStep[];
}

interface AgentStored extends AgentAggregate {
  readonly name: string;
  readonly provider: string;
  readonly fingerprint: string;
  readonly state: 'active' | 'archived';
}

interface BenchmarkStored extends BenchmarkAggregate {
  readonly name: string;
  readonly version: string;
  readonly kind: 'code' | 'gui' | 'reasoning';
  readonly state: 'active' | 'deprecated';
}

interface UserStored extends UserAggregate {
  readonly email: string;
  readonly refreshTokens: ReadonlyMap<string, RefreshTokenRecord>;
}

function paginate<T>(items: readonly T[], page: Pagination): Paged<T> {
  const slice = items.slice(page.offset, page.offset + page.limit);
  return { items: slice, total: items.length, pagination: page };
}

// --- Evaluation -------------------------------------------------------------

export class InMemoryEvaluationRepository implements IEvaluationRepository {
  private readonly store = new Map<EvaluationId, EvaluationStored>();

  constructor(seed: readonly EvaluationStored[] = []) {
    for (const e of seed) this.store.set(e.id, { ...e, steps: [...e.steps] });
  }

  async save(evaluation: EvaluationAggregate): Promise<void> {
    const e = evaluation as EvaluationStored;
    if (!e.id) throw new RepositoryError('EvaluationAggregate.id is required');
    const existing = this.store.get(e.id);
    this.store.set(e.id, {
      ...e,
      steps: existing ? [...existing.steps] : [...(e.steps ?? [])],
    });
  }

  async findById(id: EvaluationId): Promise<EvaluationAggregate | null> {
    return this.store.get(id) ?? null;
  }

  async findByIdOrThrow(id: EvaluationId): Promise<EvaluationAggregate> {
    const found = await this.findById(id);
    if (!found) throw new RepositoryError(`Evaluation ${id} not found`);
    return found;
  }

  async appendStep(
    evaluationId: EvaluationId,
    step: EvaluationStep,
  ): Promise<void> {
    const existing = this.store.get(evaluationId);
    if (!existing) {
      throw new RepositoryError(`Evaluation ${evaluationId} not found`);
    }
    if (step.evaluationId !== evaluationId) {
      throw new RepositoryError(
        `Step.evaluationId ${step.evaluationId} does not match ${evaluationId}`,
      );
    }
    const expectedIndex = existing.steps.length;
    if (step.stepIndex !== expectedIndex) {
      throw new RepositoryError(
        `Step.stepIndex must be ${expectedIndex}, got ${step.stepIndex}`,
      );
    }
    this.store.set(evaluationId, {
      ...existing,
      steps: [...existing.steps, step],
    });
  }

  async listSummaries(
    filter: EvaluationFilter,
    page: Pagination,
  ): Promise<Paged<EvaluationSummary>> {
    const all = Array.from(this.store.values()).filter((e) => {
      if (filter.state && e.state !== filter.state) return false;
      if (filter.agentId && e.agentId !== filter.agentId) return false;
      if (filter.benchmarkId && e.benchmarkId !== filter.benchmarkId)
        return false;
      return true;
    });
    all.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    const summaries: EvaluationSummary[] = all.map((e) => ({
      id: e.id,
      agentId: e.agentId,
      benchmarkId: e.benchmarkId,
      state: e.state,
      submittedAt: e.submittedAt,
      completedAt: e.completedAt,
    }));
    return paginate(summaries, page);
  }

  async countByState(state: EvaluationState): Promise<number> {
    let n = 0;
    for (const e of this.store.values()) if (e.state === state) n += 1;
    return n;
  }

  // Test-only escape hatch for setting up scenarios.
  __seed(items: readonly EvaluationStored[]): void {
    for (const e of items) {
      this.store.set(e.id, { ...e, steps: [...e.steps] });
    }
  }
}

// --- Agent ------------------------------------------------------------------

export class InMemoryAgentRepository implements IAgentRepository {
  private readonly store = new Map<AgentId, AgentStored>();
  private readonly byFingerprint = new Map<string, AgentId>();

  constructor(seed: readonly AgentStored[] = []) {
    for (const a of seed) this.put(a);
  }

  private put(a: AgentStored): void {
    const previous = this.store.get(a.id);
    if (previous && previous.fingerprint !== a.fingerprint) {
      this.byFingerprint.delete(previous.fingerprint);
    }
    this.store.set(a.id, a);
    this.byFingerprint.set(a.fingerprint, a.id);
  }

  async save(agent: AgentAggregate): Promise<void> {
    this.put(agent as AgentStored);
  }

  async findById(id: AgentId): Promise<AgentAggregate | null> {
    return this.store.get(id) ?? null;
  }

  async findByFingerprint(fp: string): Promise<AgentAggregate | null> {
    const id = this.byFingerprint.get(fp);
    return id ? (this.store.get(id) ?? null) : null;
  }

  async list(
    filter: AgentFilter,
    page: Pagination,
  ): Promise<Paged<AgentSummary>> {
    const all = Array.from(this.store.values()).filter((a) => {
      if (filter.provider && a.provider !== filter.provider) return false;
      if (filter.state && a.state !== filter.state) return false;
      return true;
    });
    const summaries: AgentSummary[] = all.map((a) => ({
      id: a.id,
      name: a.name,
      provider: a.provider,
      fingerprint: a.fingerprint,
      state: a.state,
    }));
    return paginate(summaries, page);
  }
}

// --- Benchmark --------------------------------------------------------------

export class InMemoryBenchmarkRepository implements IBenchmarkRepository {
  private readonly store = new Map<BenchmarkId, BenchmarkStored>();

  constructor(seed: readonly BenchmarkStored[] = []) {
    for (const b of seed) this.store.set(b.id, b);
  }

  async save(benchmark: BenchmarkAggregate): Promise<void> {
    this.store.set(benchmark.id, benchmark as BenchmarkStored);
  }

  async findById(id: BenchmarkId): Promise<BenchmarkAggregate | null> {
    return this.store.get(id) ?? null;
  }

  async list(
    filter: BenchmarkFilter,
    page: Pagination,
  ): Promise<Paged<BenchmarkSummary>> {
    const all = Array.from(this.store.values()).filter((b) => {
      if (filter.kind && b.kind !== filter.kind) return false;
      if (filter.state && b.state !== filter.state) return false;
      return true;
    });
    const summaries: BenchmarkSummary[] = all.map((b) => ({
      id: b.id,
      name: b.name,
      version: b.version,
      kind: b.kind,
      state: b.state,
    }));
    return paginate(summaries, page);
  }
}

// --- User -------------------------------------------------------------------

export class InMemoryUserRepository implements IUserRepository {
  private readonly store = new Map<UserId, UserStored>();
  private readonly byEmail = new Map<string, UserId>();

  constructor(seed: readonly UserStored[] = []) {
    for (const u of seed) this.put(u);
  }

  private put(u: UserStored): void {
    const previous = this.store.get(u.id);
    if (previous && previous.email !== u.email) {
      this.byEmail.delete(previous.email);
    }
    this.store.set(u.id, {
      ...u,
      refreshTokens: new Map(u.refreshTokens ?? new Map()),
    });
    this.byEmail.set(u.email, u.id);
  }

  async save(user: UserAggregate): Promise<void> {
    this.put(user as UserStored);
  }

  async findById(id: UserId): Promise<UserAggregate | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<UserAggregate | null> {
    const id = this.byEmail.get(email);
    return id ? (this.store.get(id) ?? null) : null;
  }

  async insertRefreshToken(token: RefreshTokenRecord): Promise<void> {
    const user = this.store.get(token.userId);
    if (!user) {
      throw new RepositoryError(`User ${token.userId} not found`);
    }
    const tokens = new Map(user.refreshTokens);
    tokens.set(token.id, token);
    this.store.set(user.id, { ...user, refreshTokens: tokens });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    for (const user of this.store.values()) {
      const existing = user.refreshTokens.get(tokenId);
      if (!existing) continue;
      const tokens = new Map(user.refreshTokens);
      tokens.set(tokenId, {
        ...existing,
        revokedAt: existing.revokedAt ?? new Date().toISOString(),
      });
      this.store.set(user.id, { ...user, refreshTokens: tokens });
      return;
    }
    throw new RepositoryError(`Refresh token ${tokenId} not found`);
  }
}

// --- MetricSet --------------------------------------------------------------

export class InMemoryMetricSetRepository implements IMetricSetRepository {
  private readonly store = new Map<MetricSetId, MetricSetAggregate>();
  private readonly byEvaluation = new Map<EvaluationId, MetricSetId>();

  async save(set: MetricSetAggregate): Promise<void> {
    this.store.set(set.id, set);
    const evalId = (set as { evaluationId?: EvaluationId }).evaluationId;
    if (evalId) this.byEvaluation.set(evalId, set.id);
  }

  async findById(id: MetricSetId): Promise<MetricSetAggregate | null> {
    return this.store.get(id) ?? null;
  }

  async findByEvaluationId(
    id: EvaluationId,
  ): Promise<MetricSetAggregate | null> {
    const setId = this.byEvaluation.get(id);
    return setId ? (this.store.get(setId) ?? null) : null;
  }
}
