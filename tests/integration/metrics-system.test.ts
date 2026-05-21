import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '@/database/connection';
import { orchestrator } from '@/orchestrator/instance';
import metricsRouter from '@/api/metrics';
import orchestratorRouter from '@/api/orchestrator';
import { errorHandler } from '@/middleware/errorHandler';
import { AgentModel } from '@/database/models/Agent';
import { BenchmarkModel } from '@/database/models/Benchmark';
import { EvaluationModel } from '@/database/models/Evaluation';
import { TestDatabase } from '../helpers/test-db';

// Well-formed v4 UUID that will not exist in the database.
const UNKNOWN_UUID = '11111111-1111-4111-8111-111111111111';

// Build an app that mirrors the real server's middleware stack: JSON body
// parsing with a size limit, the API routers, the JSON 404 handler and the
// shared error handler (which converts thrown ValidationError/NotFound/etc.
// into the canonical { success:false, error:{...} } shape).
function buildApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/metrics', metricsRouter);
  app.use('/api/orchestrator', orchestratorRouter);
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found', timestamp: new Date() },
    });
  });
  app.use(errorHandler);
  return app;
}

describe('Metrics System Integration Tests', () => {
  let app: express.Application;
  let testDb: TestDatabase;
  let evaluationId: string;
  let agentId: string;
  let benchmarkId: string;

  beforeAll(async () => {
    testDb = TestDatabase.getInstance();
    await testDb.initialize();
    await orchestrator.initialize();
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.cleanup();

    // Create records through the models so Postgres assigns real v4 UUIDs
    // (the API's UUID validator rejects the all-zero placeholder ids).
    const agent = await AgentModel.create({ name: 'Metrics Agent', type: 'swe' } as any);
    agentId = agent.id;
    const benchmark = await BenchmarkModel.create({
      name: 'Metrics Benchmark',
      type: 'swe-bench',
      dataset: 'metrics-v1',
      isActive: true,
    } as any);
    benchmarkId = benchmark.id;
    const evaluation = await EvaluationModel.create({
      agentId,
      benchmarkId,
      status: 'completed',
      metrics: { taskSuccessRate: 0.9 },
    } as any);
    evaluationId = evaluation.id;

    app = buildApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Metrics API', () => {
    it('returns the performance leaderboard', async () => {
      const response = await request(app).get('/api/metrics/leaderboard').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.entries).toBeDefined();
    });

    it('returns metrics for a specific evaluation', async () => {
      const response = await request(app)
        .get(`/api/metrics/evaluation/${evaluationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.evaluation).toBeDefined();
      expect(response.body.data.evaluation.id).toBe(evaluationId);
    });

    it('returns aggregated metrics for a valid time range', async () => {
      const response = await request(app)
        .post('/api/metrics/aggregate')
        .send({
          timeRange: {
            start: new Date(Date.now() - 3600000).toISOString(),
            end: new Date().toISOString(),
          },
          filters: { status: ['completed'] },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aggregations).toBeDefined();
    });

    it('exports metrics data for a valid request', async () => {
      const response = await request(app)
        .post('/api/metrics/export')
        .send({
          format: 'json',
          dateRange: {
            start: new Date(Date.now() - 3600000).toISOString(),
            end: new Date().toISOString(),
          },
          includeAggregated: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('json');
    });

    it('returns dashboard data', async () => {
      const response = await request(app).get('/api/metrics/dashboard').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
    });

    it('returns metrics system health', async () => {
      const response = await request(app).get('/api/metrics/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Orchestrator API (idle singleton)', () => {
    it('initializes the orchestrator', async () => {
      const response = await request(app).post('/api/orchestrator/initialize').expect(200);

      expect(response.body.success).toBe(true);
    });

    it('reports 404 for status when no evaluation is running', async () => {
      jest.spyOn(orchestrator, 'getCurrentEvaluation').mockReturnValue(null as any);

      const response = await request(app).get('/api/orchestrator/status').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_EVALUATION_RUNNING');
    });

    it('reports 404 for on-demand metrics when no evaluation is running', async () => {
      jest.spyOn(orchestrator, 'isEvaluationRunning').mockReturnValue(false);

      const response = await request(app).post('/api/orchestrator/metrics').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_EVALUATION_RUNNING');
    });
  });

  describe('Validation and error handling', () => {
    it('rejects a non-UUID evaluation id with 400', async () => {
      const response = await request(app)
        .get('/api/metrics/evaluation/not-a-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toBeDefined();
    });

    it('returns 404 for an unknown (well-formed) evaluation id', async () => {
      const response = await request(app)
        .get(`/api/metrics/evaluation/${UNKNOWN_UUID}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects aggregation without a required time range', async () => {
      const response = await request(app)
        .post('/api/metrics/aggregate')
        .send({ filters: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors).toBeDefined();
    });

    it('rejects export with an invalid format', async () => {
      const response = await request(app)
        .post('/api/metrics/export')
        .send({
          format: 'invalid-format',
          dateRange: {
            start: new Date(Date.now() - 3600000).toISOString(),
            end: new Date().toISOString(),
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors).toBeDefined();
    });

    it('surfaces database errors as 500', async () => {
      jest.spyOn(db, 'query').mockRejectedValue(new Error('Database connection failed') as never);

      const response = await request(app)
        .get(`/api/metrics/evaluation/${evaluationId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('rejects an evaluation request missing required fields', async () => {
      const response = await request(app)
        .post('/api/orchestrator/evaluate')
        .send({ benchmarkId: benchmarkId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors).toBeDefined();
    });

    it('rejects an oversized request body with 413', async () => {
      const largePayload = {
        agentId: agentId,
        benchmarkId: benchmarkId,
        configuration: { blob: 'x'.repeat(200 * 1024) },
      };

      const response = await request(app)
        .post('/api/orchestrator/evaluate')
        .send(largePayload)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('returns a JSON 404 for an unmatched route', async () => {
      const response = await request(app)
        .get('/api/metrics/evaluation/')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Concurrency and consistency', () => {
    it('handles concurrent reads of the same evaluation', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(app).get(`/api/metrics/evaluation/${evaluationId}`)
        )
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('returns consistent identifiers across repeated reads', async () => {
      const first = await request(app)
        .get(`/api/metrics/evaluation/${evaluationId}`)
        .expect(200);
      const second = await request(app)
        .get(`/api/metrics/evaluation/${evaluationId}`)
        .expect(200);

      expect(first.body.data.evaluation.id).toBe(second.body.data.evaluation.id);
      expect(first.body.data.evaluation.agentId).toBe(second.body.data.evaluation.agentId);
      expect(first.body.data.evaluation.benchmarkId).toBe(second.body.data.evaluation.benchmarkId);
    });
  });
});
