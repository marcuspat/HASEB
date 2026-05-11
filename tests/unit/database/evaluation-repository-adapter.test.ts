import {
  EvaluationRepositoryAdapter,
  aggregateToLegacyState,
  legacyToAggregateState,
  type EvaluationModelPort,
  type LegacyEvaluationRow,
  type LegacyEvaluationStatus,
} from '../../../src/database/repositories/EvaluationRepositoryAdapter';
import type {
  AgentId,
  BenchmarkId,
  EvaluationAggregate,
  EvaluationId,
} from '../../../src/domain/contracts';
import { RepositoryError } from '../../../src/domain/contracts';

const evalId = (s: string) => s as EvaluationId;
const agentId = (s: string) => s as AgentId;
const benchmarkId = (s: string) => s as BenchmarkId;

class FakeEvaluationModel implements EvaluationModelPort {
  public readonly rows = new Map<string, LegacyEvaluationRow>();
  public readonly logs: Array<{ id: string; log: string }> = [];
  public readonly updates: Array<{
    id: string;
    status: LegacyEvaluationStatus;
    startTime?: Date;
    endTime?: Date;
  }> = [];

  async findById(id: string): Promise<LegacyEvaluationRow | null> {
    return this.rows.get(id) ?? null;
  }
  async list(
    page: number,
    limit: number,
    agentIdF?: string,
    benchmarkIdF?: string,
    status?: string,
  ): Promise<{ evaluations: LegacyEvaluationRow[]; total: number }> {
    const all = Array.from(this.rows.values()).filter((r) => {
      if (agentIdF && r.agentId !== agentIdF) return false;
      if (benchmarkIdF && r.benchmarkId !== benchmarkIdF) return false;
      if (status && r.status !== status) return false;
      return true;
    });
    const offset = (page - 1) * limit;
    return {
      evaluations: all.slice(offset, offset + limit),
      total: all.length,
    };
  }
  async findByStatus(
    status: LegacyEvaluationStatus,
    page: number,
    limit: number,
  ): Promise<{ evaluations: LegacyEvaluationRow[]; total: number }> {
    return this.list(page, limit, undefined, undefined, status);
  }
  async create(data: {
    id?: string;
    agentId: string;
    benchmarkId: string;
    status: LegacyEvaluationStatus;
  }): Promise<LegacyEvaluationRow> {
    const id = data.id ?? `auto-${this.rows.size + 1}`;
    const row: LegacyEvaluationRow = {
      id,
      agentId: data.agentId,
      benchmarkId: data.benchmarkId,
      status: data.status,
      createdAt: new Date('2026-05-10T00:00:00Z'),
    };
    this.rows.set(id, row);
    return row;
  }
  async updateStatusWithTime(
    id: string,
    status: LegacyEvaluationStatus,
    startTime?: Date,
    endTime?: Date,
  ): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return false;
    this.updates.push({ id, status, startTime, endTime });
    this.rows.set(id, {
      ...row,
      status,
      completedAt: endTime ?? row.completedAt ?? null,
    });
    return true;
  }
  async addLog(id: string, log: string): Promise<boolean> {
    if (!this.rows.has(id)) return false;
    this.logs.push({ id, log });
    return true;
  }
}

describe('state mapping', () => {
  test('legacyToAggregateState refines `running` to `collecting` when metricSet exists', () => {
    expect(legacyToAggregateState('running', false)).toBe('running');
    expect(legacyToAggregateState('running', true)).toBe('collecting');
    expect(legacyToAggregateState('pending', false)).toBe('queued');
    expect(legacyToAggregateState('completed', false)).toBe('completed');
    expect(legacyToAggregateState('failed', false)).toBe('failed');
    expect(legacyToAggregateState('cancelled', false)).toBe('cancelled');
  });

  test('aggregateToLegacyState collapses running/collecting/analyzing → running', () => {
    expect(aggregateToLegacyState('queued')).toBe('pending');
    expect(aggregateToLegacyState('running')).toBe('running');
    expect(aggregateToLegacyState('collecting')).toBe('running');
    expect(aggregateToLegacyState('analyzing')).toBe('running');
    expect(aggregateToLegacyState('completed')).toBe('completed');
    expect(aggregateToLegacyState('failed')).toBe('failed');
    expect(aggregateToLegacyState('cancelled')).toBe('cancelled');
  });
});

describe('EvaluationRepositoryAdapter', () => {
  const baseAggregate: EvaluationAggregate = {
    id: evalId('e1'),
    agentId: agentId('a1'),
    benchmarkId: benchmarkId('b1'),
    state: 'queued',
    submittedAt: '2026-05-10T00:00:00Z',
    completedAt: null,
  };

  test('save creates a new legacy row when the id is unknown', async () => {
    const model = new FakeEvaluationModel();
    const repo = new EvaluationRepositoryAdapter(model);
    await repo.save(baseAggregate);
    const row = await model.findById('e1');
    expect(row?.status).toBe('pending');
  });

  test('save updates the legacy status when the row exists with a different status', async () => {
    const model = new FakeEvaluationModel();
    await model.create({
      id: 'e1',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'pending',
    });
    const repo = new EvaluationRepositoryAdapter(model);
    await repo.save({ ...baseAggregate, state: 'running' });
    expect(model.updates).toHaveLength(1);
    expect(model.updates[0].status).toBe('running');
    expect(model.updates[0].startTime).toBeInstanceOf(Date);
  });

  test('save is a no-op when the legacy status already matches', async () => {
    const model = new FakeEvaluationModel();
    await model.create({
      id: 'e1',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'pending',
    });
    const repo = new EvaluationRepositoryAdapter(model);
    await repo.save(baseAggregate);
    expect(model.updates).toHaveLength(0);
  });

  test('findById refines `running` → `collecting` when metricSetId attached', async () => {
    const model = new FakeEvaluationModel();
    model.rows.set('e1', {
      id: 'e1',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'running',
      createdAt: '2026-05-10T00:00:00Z',
      metricSetId: 'm1',
    });
    const repo = new EvaluationRepositoryAdapter(model);
    const agg = await repo.findById(evalId('e1'));
    expect(agg?.state).toBe('collecting');
  });

  test('findByIdOrThrow throws RepositoryError when missing', async () => {
    const model = new FakeEvaluationModel();
    const repo = new EvaluationRepositoryAdapter(model);
    await expect(repo.findByIdOrThrow(evalId('missing'))).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  test('appendStep adds a legacy log line and rejects mismatched evaluationId', async () => {
    const model = new FakeEvaluationModel();
    await model.create({
      id: 'e1',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'running',
    });
    const repo = new EvaluationRepositoryAdapter(model);
    await repo.appendStep(evalId('e1'), {
      evaluationId: evalId('e1'),
      stepIndex: 3,
      recordedAt: '2026-05-10T00:00:05Z',
      kind: 'tool_call',
      status: 'ok',
      summary: 'opened file',
    });
    expect(model.logs).toHaveLength(1);
    expect(model.logs[0].log).toContain('step=3');
    expect(model.logs[0].log).toContain('tool_call/ok');

    await expect(
      repo.appendStep(evalId('e1'), {
        evaluationId: evalId('other'),
        stepIndex: 0,
        recordedAt: '2026-05-10T00:00:00Z',
        kind: 'tool_call',
        status: 'ok',
        summary: 'x',
      }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  test('listSummaries paginates by offset/limit and forwards filters', async () => {
    const model = new FakeEvaluationModel();
    for (let i = 0; i < 5; i++) {
      await model.create({
        id: `e${i}`,
        agentId: 'a1',
        benchmarkId: 'b1',
        status: i % 2 === 0 ? 'completed' : 'failed',
      });
    }
    const repo = new EvaluationRepositoryAdapter(model);
    const page1 = await repo.listSummaries(
      { state: 'completed', agentId: agentId('a1') },
      { offset: 0, limit: 2 },
    );
    expect(page1.total).toBe(3);
    expect(page1.items.map((e) => e.id)).toEqual(['e0', 'e2']);

    const page2 = await repo.listSummaries(
      { state: 'completed' },
      { offset: 2, limit: 2 },
    );
    expect(page2.items.map((e) => e.id)).toEqual(['e4']);
  });

  test('countByState delegates to findByStatus and reads total', async () => {
    const model = new FakeEvaluationModel();
    await model.create({
      id: 'a',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'pending',
    });
    await model.create({
      id: 'b',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'pending',
    });
    await model.create({
      id: 'c',
      agentId: 'a1',
      benchmarkId: 'b1',
      status: 'completed',
    });
    const repo = new EvaluationRepositoryAdapter(model);
    expect(await repo.countByState('queued')).toBe(2);
    expect(await repo.countByState('completed')).toBe(1);
    expect(await repo.countByState('cancelled')).toBe(0);
  });
});
