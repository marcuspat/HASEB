/**
 * EvaluationRepositoryAdapter — implements `IEvaluationRepository` against
 * the legacy `EvaluationModel` static-method class.
 *
 * Like the WebSocket adapter, this is duck-typed against an
 * `EvaluationModelPort`. The real `EvaluationModel` lives in the
 * pre-existing tsc error pile, so we accept a structural shape and let
 * the runtime binding happen in `src/server.ts` (or a future composition
 * root). Production code passes `EvaluationModel` directly; tests pass a
 * tiny in-memory fake.
 *
 * State mapping:
 *   The legacy `Evaluation.status` is a *narrower* enum than the DDD
 *   `EvaluationState` (no `collecting` / `analyzing`). We map both ways:
 *
 *     legacy `pending`   <-> aggregate `queued`
 *     legacy `running`   <-> aggregate `running` | `collecting` | `analyzing`
 *                            (lossy: round-tripping `collecting` produces
 *                             legacy `running`)
 *     legacy `completed` <-> aggregate `completed`
 *     legacy `failed`    <-> aggregate `failed`
 *     legacy `cancelled` <-> aggregate `cancelled`
 *
 *   Callers that need to preserve the `collecting`/`analyzing` distinction
 *   should attach a `metricSetId` (set during `collecting`) or rely on
 *   downstream domain events.
 *
 * Filtering:
 *   `EvaluationFilter.state` is translated to a legacy status before
 *   passing to `EvaluationModel.list`. `agentId` / `benchmarkId` are
 *   passed through unchanged.
 *
 * Pagination:
 *   Legacy methods use (page, limit). Repository contract uses
 *   (offset, limit). We convert.
 */

import type {
  AgentId,
  BenchmarkId,
  EvaluationAggregate,
  EvaluationFilter,
  EvaluationId,
  EvaluationState,
  EvaluationStep,
  EvaluationSummary,
  IEvaluationRepository,
  Paged,
  Pagination,
} from '../../domain/contracts';
import { RepositoryError } from '../../domain/contracts';

// --- Legacy persistence shape (duck-typed, additive) ------------------------

export type LegacyEvaluationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface LegacyEvaluationRow {
  readonly id: string;
  readonly agentId: string;
  readonly benchmarkId: string;
  readonly status: LegacyEvaluationStatus;
  readonly createdAt: Date | string;
  readonly startedAt?: Date | string | null;
  readonly completedAt?: Date | string | null;
  readonly metricSetId?: string | null;
  readonly logs?: readonly string[];
}

export interface EvaluationModelPort {
  findById(id: string): Promise<LegacyEvaluationRow | null>;
  list(
    page: number,
    limit: number,
    agentId?: string,
    benchmarkId?: string,
    status?: string,
  ): Promise<{ evaluations: readonly LegacyEvaluationRow[]; total: number }>;
  findByStatus(
    status: LegacyEvaluationStatus,
    page: number,
    limit: number,
  ): Promise<{ evaluations: readonly LegacyEvaluationRow[]; total: number }>;
  create(data: {
    readonly id?: string;
    readonly agentId: string;
    readonly benchmarkId: string;
    readonly status: LegacyEvaluationStatus;
  }): Promise<LegacyEvaluationRow>;
  updateStatusWithTime(
    id: string,
    status: LegacyEvaluationStatus,
    startTime?: Date,
    endTime?: Date,
  ): Promise<boolean>;
  addLog(id: string, log: string): Promise<boolean>;
}

// --- State mapping ----------------------------------------------------------

export function legacyToAggregateState(
  status: LegacyEvaluationStatus,
  hasMetricSet: boolean,
): EvaluationState {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'running':
      // Best-effort refinement: if a metric-set is attached, we're past
      // pure execution. Without finer signal we can't distinguish
      // `collecting` from `analyzing`; default to `collecting`.
      return hasMetricSet ? 'collecting' : 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
  }
}

export function aggregateToLegacyState(
  state: EvaluationState,
): LegacyEvaluationStatus {
  switch (state) {
    case 'queued':
      return 'pending';
    case 'running':
    case 'collecting':
    case 'analyzing':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
  }
}

// --- Row → aggregate / summary ---------------------------------------------

function toISO(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

function rowToAggregate(row: LegacyEvaluationRow): EvaluationAggregate {
  const hasMetricSet = Boolean(row.metricSetId);
  const submittedAt = toISO(row.createdAt) ?? new Date(0).toISOString();
  return {
    id: row.id as EvaluationId,
    agentId: row.agentId as AgentId,
    benchmarkId: row.benchmarkId as BenchmarkId,
    state: legacyToAggregateState(row.status, hasMetricSet),
    submittedAt,
    completedAt: toISO(row.completedAt ?? null),
  };
}

function rowToSummary(row: LegacyEvaluationRow): EvaluationSummary {
  return rowToAggregate(row) as EvaluationSummary;
}

// --- Adapter ----------------------------------------------------------------

export class EvaluationRepositoryAdapter implements IEvaluationRepository {
  constructor(private readonly model: EvaluationModelPort) {}

  async save(evaluation: EvaluationAggregate): Promise<void> {
    const existing = await this.model.findById(evaluation.id);
    const legacyStatus = aggregateToLegacyState(evaluation.state);

    if (!existing) {
      await this.model.create({
        id: evaluation.id,
        agentId: evaluation.agentId,
        benchmarkId: evaluation.benchmarkId,
        status: legacyStatus,
      });
      return;
    }

    if (existing.status === legacyStatus) return;

    const startTime =
      legacyStatus === 'running' ? new Date() : undefined;
    const endTime =
      legacyStatus === 'completed' ||
      legacyStatus === 'failed' ||
      legacyStatus === 'cancelled'
        ? new Date(evaluation.completedAt ?? Date.now())
        : undefined;

    const ok = await this.model.updateStatusWithTime(
      evaluation.id,
      legacyStatus,
      startTime,
      endTime,
    );
    if (!ok) {
      throw new RepositoryError(
        `EvaluationRepositoryAdapter.save: legacy update failed for ${evaluation.id}`,
      );
    }
  }

  async findById(id: EvaluationId): Promise<EvaluationAggregate | null> {
    const row = await this.model.findById(id);
    return row ? rowToAggregate(row) : null;
  }

  async findByIdOrThrow(id: EvaluationId): Promise<EvaluationAggregate> {
    const got = await this.findById(id);
    if (!got) throw new RepositoryError(`Evaluation ${id} not found`);
    return got;
  }

  async appendStep(
    evaluationId: EvaluationId,
    step: EvaluationStep,
  ): Promise<void> {
    if (step.evaluationId !== evaluationId) {
      throw new RepositoryError(
        `Step.evaluationId ${step.evaluationId} does not match ${evaluationId}`,
      );
    }
    const log = `[${step.recordedAt}] step=${step.stepIndex} ${step.kind}/${step.status} ${step.summary}`;
    const ok = await this.model.addLog(evaluationId, log);
    if (!ok) {
      throw new RepositoryError(
        `EvaluationRepositoryAdapter.appendStep: legacy addLog failed for ${evaluationId}`,
      );
    }
  }

  async listSummaries(
    filter: EvaluationFilter,
    page: Pagination,
  ): Promise<Paged<EvaluationSummary>> {
    const limit = Math.max(1, Math.min(200, page.limit));
    const pageNumber = Math.floor(page.offset / limit) + 1;

    const result = await this.model.list(
      pageNumber,
      limit,
      filter.agentId,
      filter.benchmarkId,
      filter.state ? aggregateToLegacyState(filter.state) : undefined,
    );

    return {
      items: result.evaluations.map(rowToSummary),
      total: result.total,
      pagination: page,
    };
  }

  async countByState(state: EvaluationState): Promise<number> {
    const result = await this.model.findByStatus(
      aggregateToLegacyState(state),
      1,
      1,
    );
    return result.total;
  }
}
