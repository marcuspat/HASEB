import {
  InMemoryAgentRepository,
  InMemoryBenchmarkRepository,
  InMemoryEvaluationRepository,
  InMemoryMetricSetRepository,
  InMemoryUserRepository,
} from '../../../src/domain/in-memory/InMemoryRepositories';
import type {
  AgentId,
  BenchmarkId,
  EvaluationId,
  MetricSetId,
  RefreshTokenRecord,
  UserId,
} from '../../../src/domain/contracts';
import { RepositoryError } from '../../../src/domain/contracts';

const evalId = (s: string) => s as EvaluationId;
const agentId = (s: string) => s as AgentId;
const benchmarkId = (s: string) => s as BenchmarkId;
const userId = (s: string) => s as UserId;
const metricSetId = (s: string) => s as MetricSetId;

describe('InMemoryEvaluationRepository', () => {
  test('save/findById round-trips an aggregate', async () => {
    const repo = new InMemoryEvaluationRepository();
    const aggregate = {
      id: evalId('e1'),
      agentId: agentId('a1'),
      benchmarkId: benchmarkId('b1'),
      state: 'queued' as const,
      submittedAt: '2026-05-10T00:00:00Z',
      completedAt: null,
      steps: [],
    };
    await repo.save(aggregate);
    const got = await repo.findById(evalId('e1'));
    expect(got).toMatchObject({ id: 'e1', state: 'queued' });
  });

  test('findByIdOrThrow throws RepositoryError when missing', async () => {
    const repo = new InMemoryEvaluationRepository();
    await expect(repo.findByIdOrThrow(evalId('missing'))).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  test('appendStep enforces contiguous stepIndex', async () => {
    const repo = new InMemoryEvaluationRepository();
    await repo.save({
      id: evalId('e2'),
      agentId: agentId('a1'),
      benchmarkId: benchmarkId('b1'),
      state: 'running',
      submittedAt: '2026-05-10T00:00:00Z',
      completedAt: null,
      steps: [],
    });
    await repo.appendStep(evalId('e2'), {
      evaluationId: evalId('e2'),
      stepIndex: 0,
      recordedAt: '2026-05-10T00:00:01Z',
      kind: 'tool_call',
      status: 'ok',
      summary: 'first',
    });
    await expect(
      repo.appendStep(evalId('e2'), {
        evaluationId: evalId('e2'),
        stepIndex: 5, // not contiguous
        recordedAt: '2026-05-10T00:00:02Z',
        kind: 'tool_call',
        status: 'ok',
        summary: 'bad',
      }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  test('appendStep rejects mismatched evaluationId', async () => {
    const repo = new InMemoryEvaluationRepository();
    await repo.save({
      id: evalId('e3'),
      agentId: agentId('a1'),
      benchmarkId: benchmarkId('b1'),
      state: 'running',
      submittedAt: '2026-05-10T00:00:00Z',
      completedAt: null,
      steps: [],
    });
    await expect(
      repo.appendStep(evalId('e3'), {
        evaluationId: evalId('different'),
        stepIndex: 0,
        recordedAt: '2026-05-10T00:00:01Z',
        kind: 'tool_call',
        status: 'ok',
        summary: 'x',
      }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  test('listSummaries filters by state and paginates newest-first', async () => {
    const repo = new InMemoryEvaluationRepository();
    for (let i = 0; i < 5; i++) {
      await repo.save({
        id: evalId(`e${i}`),
        agentId: agentId('a1'),
        benchmarkId: benchmarkId('b1'),
        state: i % 2 === 0 ? 'completed' : 'failed',
        submittedAt: `2026-05-10T00:0${i}:00Z`,
        completedAt: null,
        steps: [],
      });
    }
    const page = await repo.listSummaries(
      { state: 'completed' },
      { offset: 0, limit: 10 },
    );
    expect(page.total).toBe(3);
    expect(page.items.map((e) => e.id)).toEqual(['e4', 'e2', 'e0']);
  });

  test('countByState reflects current store', async () => {
    const repo = new InMemoryEvaluationRepository();
    await repo.save({
      id: evalId('q1'),
      agentId: agentId('a1'),
      benchmarkId: benchmarkId('b1'),
      state: 'queued',
      submittedAt: '2026-05-10T00:00:00Z',
      completedAt: null,
      steps: [],
    });
    await repo.save({
      id: evalId('q2'),
      agentId: agentId('a1'),
      benchmarkId: benchmarkId('b1'),
      state: 'queued',
      submittedAt: '2026-05-10T00:00:01Z',
      completedAt: null,
      steps: [],
    });
    expect(await repo.countByState('queued')).toBe(2);
    expect(await repo.countByState('completed')).toBe(0);
  });
});

describe('InMemoryAgentRepository', () => {
  test('findByFingerprint returns the right agent', async () => {
    const repo = new InMemoryAgentRepository();
    await repo.save({
      id: agentId('a1'),
      name: 'A',
      provider: 'anthropic',
      fingerprint: 'sha256:aaa',
      state: 'active',
    });
    await repo.save({
      id: agentId('a2'),
      name: 'B',
      provider: 'openai',
      fingerprint: 'sha256:bbb',
      state: 'active',
    });
    const got = await repo.findByFingerprint('sha256:bbb');
    expect(got?.id).toBe('a2');
  });

  test('list filters by provider and state', async () => {
    const repo = new InMemoryAgentRepository();
    await repo.save({
      id: agentId('a1'),
      name: 'A',
      provider: 'anthropic',
      fingerprint: 'sha256:1',
      state: 'active',
    });
    await repo.save({
      id: agentId('a2'),
      name: 'B',
      provider: 'anthropic',
      fingerprint: 'sha256:2',
      state: 'archived',
    });
    const page = await repo.list(
      { provider: 'anthropic', state: 'active' },
      { offset: 0, limit: 10 },
    );
    expect(page.items.map((a) => a.id)).toEqual(['a1']);
  });
});

describe('InMemoryBenchmarkRepository', () => {
  test('list filters by kind', async () => {
    const repo = new InMemoryBenchmarkRepository();
    await repo.save({
      id: benchmarkId('b1'),
      name: 'SWE',
      version: '2.1',
      kind: 'code',
      state: 'active',
    });
    await repo.save({
      id: benchmarkId('b2'),
      name: 'OSWorld',
      version: '1.0',
      kind: 'gui',
      state: 'active',
    });
    const page = await repo.list({ kind: 'gui' }, { offset: 0, limit: 10 });
    expect(page.items.map((b) => b.id)).toEqual(['b2']);
  });
});

describe('InMemoryUserRepository', () => {
  const baseUser = {
    id: userId('u1'),
    email: 'a@b.c',
    refreshTokens: new Map(),
  } as const;

  test('findByEmail and refresh-token lifecycle', async () => {
    const repo = new InMemoryUserRepository();
    await repo.save(baseUser);
    expect(await repo.findByEmail('a@b.c')).toMatchObject({ id: 'u1' });

    const token: RefreshTokenRecord = {
      id: 't1',
      userId: userId('u1'),
      tokenHash: 'h',
      issuedAt: '2026-05-10T00:00:00Z',
      expiresAt: '2026-05-24T00:00:00Z',
      revokedAt: null,
    };
    await repo.insertRefreshToken(token);
    await repo.revokeRefreshToken('t1');
    await expect(repo.revokeRefreshToken('missing')).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  test('insertRefreshToken rejects unknown user', async () => {
    const repo = new InMemoryUserRepository();
    await expect(
      repo.insertRefreshToken({
        id: 't',
        userId: userId('ghost'),
        tokenHash: 'h',
        issuedAt: '2026-05-10T00:00:00Z',
        expiresAt: '2026-05-24T00:00:00Z',
        revokedAt: null,
      }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe('InMemoryMetricSetRepository', () => {
  test('findByEvaluationId returns the most recent save', async () => {
    const repo = new InMemoryMetricSetRepository();
    await repo.save({
      id: metricSetId('m1'),
      evaluationId: evalId('e1'),
    } as never);
    await repo.save({
      id: metricSetId('m2'),
      evaluationId: evalId('e1'),
    } as never);
    const got = await repo.findByEvaluationId(evalId('e1'));
    expect(got?.id).toBe('m2');
  });

  test('findById returns null for missing', async () => {
    const repo = new InMemoryMetricSetRepository();
    expect(await repo.findById(metricSetId('missing'))).toBeNull();
  });
});
