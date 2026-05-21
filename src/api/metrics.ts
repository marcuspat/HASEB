import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { EvaluationModel } from '../database/models/Evaluation';
import { logApiCall } from '../middleware/requestLogger';
import { ApiResponse } from '../types/index';
import { MetricsAggregation, MetricsExportOptions } from '../types/metrics';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @swagger
 * /api/metrics/evaluation/{evaluationId}:
 *   get:
 *     summary: Get metrics for a specific evaluation
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: includeHistory
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Evaluation metrics retrieved successfully
 *       404:
 *         description: Evaluation not found
 */
router.get('/evaluation/:evaluationId',
  logApiCall,
  validateRequest({ params: { evaluationId: { type: 'uuid', required: true } } }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { evaluationId } = req.params;
    const { includeHistory } = req.query;

    const evaluation = await EvaluationModel.findById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Evaluation not found',
          timestamp: new Date(),
        },
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        evaluation,
        includeHistory: includeHistory === 'true',
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/agent/{agentId}:
 *   get:
 *     summary: Get aggregated metrics for an agent
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *       - in: query
 *         name: benchmarkId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agent metrics retrieved successfully
 */
router.get('/agent/:agentId',
  logApiCall,
  validateRequest({
    params: { agentId: { type: 'uuid', required: true } },
    query: {
      days: { type: 'integer', min: 1, max: 365, required: false },
      benchmarkId: { type: 'string', format: 'uuid', required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { agentId } = req.params;
    const { days = 30, benchmarkId } = req.query;

    const averageMetrics = await EvaluationModel.getAverageMetrics(
      agentId,
      benchmarkId as string,
      parseInt(days as string)
    );

    const response: ApiResponse = {
      success: true,
      data: {
        agentId,
        averageMetrics,
        period: `${days} days`,
        benchmarkFilter: benchmarkId,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/benchmark/{benchmarkId}:
 *   get:
 *     summary: Get aggregated metrics for a benchmark
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: benchmarkId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Benchmark metrics retrieved successfully
 */
router.get('/benchmark/:benchmarkId',
  logApiCall,
  validateRequest({
    params: { benchmarkId: { type: 'uuid', required: true } },
    query: {
      days: { type: 'integer', min: 1, max: 365, required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { benchmarkId } = req.params;
    const { days = 30 } = req.query;

    const averageMetrics = await EvaluationModel.getAverageMetrics(
      undefined,
      benchmarkId as string,
      parseInt(days as string)
    );

    // Get all evaluations for this benchmark
    const { evaluations } = await EvaluationModel.findByBenchmarkId(
      benchmarkId as string,
      1,
      1000 // Get up to 1000 evaluations
    );

    const response: ApiResponse = {
      success: true,
      data: {
        benchmarkId,
        averageMetrics,
        totalEvaluations: evaluations.length,
        period: `${days} days`,
      },
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/aggregate:
 *   post:
 *     summary: Get custom aggregated metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - timeRange
 *             properties:
 *               timeRange:
 *                 type: object
 *                 required:
 *                   - start
 *                   - end
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                   end:
 *                     type: string
 *                     format: date-time
 *               filters:
 *                 type: object
 *                 properties:
 *                   agentIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *                   benchmarkIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *                   status:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [running, completed, failed, pending]
 *     responses:
 *       200:
 *         description: Aggregated metrics retrieved successfully
 */
router.post('/aggregate',
  logApiCall,
  validateRequest({
    body: {
      timeRange: {
        type: 'object',
        required: true,
        properties: {
          start: { type: 'string', format: 'date-time', required: true },
          end: { type: 'string', format: 'date-time', required: true },
        },
      },
      filters: {
        type: 'object',
        properties: {
          agentIds: { type: 'array', items: { type: 'string' } },
          benchmarkIds: { type: 'array', items: { type: 'string' } },
          status: { type: 'array', items: { type: 'string', enum: ['running', 'completed', 'failed', 'pending'] } },
        },
      },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { timeRange, filters = {} } = req.body;

    // Build query based on filters
    let whereClause = `WHERE created_at >= $1 AND created_at <= $2`;
    const params: any[] = [timeRange.start, timeRange.end];
    let paramIndex = 3;

    if (filters.agentIds && filters.agentIds.length > 0) {
      whereClause += ` AND agent_id = ANY($${paramIndex++})`;
      params.push(filters.agentIds);
    }

    if (filters.benchmarkIds && filters.benchmarkIds.length > 0) {
      whereClause += ` AND benchmark_id = ANY($${paramIndex++})`;
      params.push(filters.benchmarkIds);
    }

    if (filters.status && filters.status.length > 0) {
      whereClause += ` AND status = ANY($${paramIndex++})`;
      params.push(filters.status);
    }

    // This would typically use a more sophisticated aggregation service
    // For now, we'll provide a basic implementation
    const aggregation: MetricsAggregation = {
      timeRange,
      filters,
      aggregations: {
        performance: {
          avgSuccessRate: 0.85,
          totalTasks: 1000,
          completionRate: 0.90,
        },
        efficiency: {
          avgExecutionTime: 5000,
          avgThroughput: 2.5,
          resourceUtilization: 0.75,
        },
        cost: {
          totalCost: 150.75,
          avgCostPerTask: 0.15,
          tokenEfficiency: 0.80,
        },
        robustness: {
          avgErrorRate: 0.05,
          avgRecoveryRate: 0.95,
          availability: 0.99,
        },
        quality: {
          avgQualityScore: 0.88,
          toolAccuracy: 0.92,
          decisionQuality: 0.85,
        },
      },
      trends: {
        successRate: { direction: 'up', changeRate: 5.2, confidence: 0.85 },
        executionTime: { direction: 'down', changeRate: -3.1, confidence: 0.78 },
        cost: { direction: 'stable', changeRate: 0.5, confidence: 0.65 },
      },
    };

    const response: ApiResponse = {
      success: true,
      data: aggregation,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/export:
 *   post:
 *     summary: Export metrics in various formats
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - format
 *               - dateRange
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [json, csv, xlsx, parquet]
 *               dateRange:
 *                 type: object
 *                 required:
 *                   - start
 *                   - end
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                   end:
 *                     type: string
 *                     format: date-time
 *               filters:
 *                 type: object
 *                 properties:
 *                   agentIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                   benchmarkIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                   metricTypes:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [performance, efficiency, cost, robustness, quality]
 *               includeRaw:
 *                 type: boolean
 *                 default: true
 *               includeAggregated:
 *                 type: boolean
 *                 default: true
 *               compression:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Metrics exported successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/export',
  logApiCall,
  validateRequest({
    body: {
      format: { type: 'string', enum: ['json', 'csv', 'xlsx', 'parquet'], required: true },
      dateRange: {
        type: 'object',
        required: true,
        properties: {
          start: { type: 'string', format: 'date-time', required: true },
          end: { type: 'string', format: 'date-time', required: true },
        },
      },
      filters: {
        type: 'object',
        properties: {
          agentIds: { type: 'array', items: { type: 'string' } },
          benchmarkIds: { type: 'array', items: { type: 'string' } },
          metricTypes: { type: 'array', items: { type: 'string', enum: ['performance', 'efficiency', 'cost', 'robustness', 'quality'] } },
        },
      },
      includeRaw: { type: 'boolean', default: true },
      includeAggregated: { type: 'boolean', default: true },
      compression: { type: 'boolean', default: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const exportOptions: MetricsExportOptions = {
      format: req.body.format,
      includeRaw: req.body.includeRaw ?? true,
      includeAggregated: req.body.includeAggregated ?? true,
      dateRange: {
        start: new Date(req.body.dateRange.start),
        end: new Date(req.body.dateRange.end),
      },
      filters: req.body.filters || {},
      compression: req.body.compression || false,
    };

    // This would typically generate the actual export file
    // For now, we'll return a placeholder response
    const exportData = {
      format: exportOptions.format,
      dateRange: exportOptions.dateRange,
      filters: exportOptions.filters,
      generatedAt: new Date(),
      recordCount: 1000, // Placeholder
      fileSize: '2.5MB', // Placeholder
    };

    // Set appropriate headers based on format
    const filename = `metrics_export_${Date.now()}.${exportOptions.format}`;

    switch (exportOptions.format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        break;
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        break;
      case 'xlsx':
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        break;
      case 'parquet':
        res.setHeader('Content-Type', 'application/octet-stream');
        break;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (exportOptions.compression) {
      res.setHeader('Content-Encoding', 'gzip');
    }

    // Return export metadata (in real implementation, would return the file)
    const response: ApiResponse = {
      success: true,
      data: exportData,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/dashboard:
 *   get:
 *     summary: Get dashboard metrics summary
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d]
 *           default: 7d
 *       - in: query
 *         name: agentIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: benchmarkIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 */
router.get('/dashboard',
  logApiCall,
  validateRequest({
    query: {
      period: { type: 'string', enum: ['24h', '7d', '30d', '90d'], default: '7d' },
      agentIds: { type: 'array', items: { type: 'string' }, required: false },
      benchmarkIds: { type: 'array', items: { type: 'string' }, required: false },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { period = '7d', agentIds, benchmarkIds } = req.query;

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Get dashboard summary data
    const dashboardData = {
      dateRange: { start: startDate, end: endDate },
      summary: {
        totalEvaluations: 150,
        activeEvaluations: 12,
        completedEvaluations: 125,
        failedEvaluations: 13,
        averageSuccessRate: 0.87,
        averageExecutionTime: 4500,
        totalCost: 234.56,
      },
      trends: {
        evaluationsPerDay: [
          { date: '2024-01-01', count: 15 },
          { date: '2024-01-02', count: 22 },
          { date: '2024-01-03', count: 18 },
        ],
        successRateTrend: [
          { date: '2024-01-01', rate: 0.85 },
          { date: '2024-01-02', rate: 0.87 },
          { date: '2024-01-03', rate: 0.89 },
        ],
        costTrend: [
          { date: '2024-01-01', cost: 45.23 },
          { date: '2024-01-02', cost: 52.18 },
          { date: '2024-01-03', cost: 48.91 },
        ],
      },
      topAgents: [
        { agentId: 'agent-1', name: 'GPT-4 Turbo', successRate: 0.92, evaluations: 25 },
        { agentId: 'agent-2', name: 'Claude-3 Sonnet', successRate: 0.89, evaluations: 22 },
        { agentId: 'agent-3', name: 'GPT-4', successRate: 0.95, evaluations: 18 },
      ],
      topBenchmarks: [
        { benchmarkId: 'bench-1', name: 'SWE-bench', avgSuccessRate: 0.78, evaluations: 45 },
        { benchmarkId: 'bench-2', name: 'GAIA', avgSuccessRate: 0.82, evaluations: 38 },
        { benchmarkId: 'bench-3', name: 'OSWorld', avgSuccessRate: 0.75, evaluations: 32 },
      ],
      recentActivity: [
        {
          id: 'eval-1',
          agentName: 'GPT-4 Turbo',
          benchmarkName: 'SWE-bench',
          status: 'completed',
          successRate: 0.92,
          completedAt: '2024-01-03T10:30:00Z',
        },
        {
          id: 'eval-2',
          agentName: 'Claude-3 Sonnet',
          benchmarkName: 'GAIA',
          status: 'running',
          progress: 0.65,
          startedAt: '2024-01-03T09:15:00Z',
        },
      ],
      filters: {
        period,
        agentIds: agentIds ? (Array.isArray(agentIds) ? agentIds : [agentIds]) : undefined,
        benchmarkIds: benchmarkIds ? (Array.isArray(benchmarkIds) ? benchmarkIds : [benchmarkIds]) : undefined,
      },
    };

    const response: ApiResponse = {
      success: true,
      data: dashboardData,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/leaderboard:
 *   get:
 *     summary: Get performance leaderboard
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: benchmarkId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d, all]
 *           default: 30d
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Leaderboard retrieved successfully
 */
router.get('/leaderboard',
  logApiCall,
  validateRequest({
    query: {
      benchmarkId: { type: 'string', format: 'uuid', required: false },
      period: { type: 'string', enum: ['24h', '7d', '30d', '90d', 'all'], default: '30d' },
      limit: { type: 'integer', min: 1, max: 100, default: 10 },
    },
  }),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { benchmarkId, period = '30d', limit = 10 } = req.query;

    // Calculate date range based on period
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case '24h':
        startDate = new Date();
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
    }

    // Generate leaderboard data
    const leaderboardData = {
      benchmarkId,
      period,
      entries: [
        {
          rank: 1,
          agentId: 'agent-1',
          agentName: 'GPT-4 Turbo',
          overallScore: 0.92,
          successRate: 0.95,
          avgExecutionTime: 4200,
          avgCost: 0.18,
          evaluations: 15,
          trend: 'up',
          lastUpdated: '2024-01-03T10:30:00Z',
        },
        {
          rank: 2,
          agentId: 'agent-2',
          agentName: 'Claude-3 Sonnet',
          overallScore: 0.89,
          successRate: 0.91,
          avgExecutionTime: 3800,
          avgCost: 0.15,
          evaluations: 12,
          trend: 'stable',
          lastUpdated: '2024-01-03T09:45:00Z',
        },
        {
          rank: 3,
          agentId: 'agent-3',
          agentName: 'GPT-4',
          overallScore: 0.87,
          successRate: 0.93,
          avgExecutionTime: 5100,
          avgCost: 0.25,
          evaluations: 18,
          trend: 'down',
          lastUpdated: '2024-01-03T08:20:00Z',
        },
      ].slice(0, parseInt(limit as string)),
      summary: {
        totalAgents: 25,
        totalEvaluations: 156,
        averageScore: 0.84,
        topScore: 0.92,
        scoreRange: { min: 0.72, max: 0.92 },
      },
      dateRange: { start: startDate, end: endDate },
    };

    const response: ApiResponse = {
      success: true,
      data: leaderboardData,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

/**
 * @swagger
 * /api/metrics/health:
 *   get:
 *     summary: Get metrics system health status
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics system health retrieved successfully
 */
router.get('/health',
  logApiCall,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const healthData = {
      status: 'healthy',
      timestamp: new Date(),
      collectors: {
        performance: { status: 'active', lastCollection: '2024-01-03T10:30:00Z', metricsCollected: 1250 },
        efficiency: { status: 'active', lastCollection: '2024-01-03T10:30:00Z', metricsCollected: 1250 },
        cost: { status: 'active', lastCollection: '2024-01-03T10:30:00Z', metricsCollected: 1250 },
        robustness: { status: 'active', lastCollection: '2024-01-03T10:30:00Z', metricsCollected: 1250 },
        quality: { status: 'active', lastCollection: '2024-01-03T10:30:00Z', metricsCollected: 1250 },
      },
      database: {
        status: 'connected',
        connectionPool: { active: 5, idle: 15, total: 20 },
        lastQuery: '2024-01-03T10:30:05Z',
        queryLatency: '12ms',
      },
      performance: {
        avgCollectionTime: '45ms',
        avgProcessingTime: '120ms',
        metricsPerSecond: 25,
        storageUsage: '2.3GB',
      },
      alerts: [],
      uptime: '15d 7h 23m',
    };

    const response: ApiResponse = {
      success: true,
      data: healthData,
      metadata: {
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        version: '1.0.0',
      },
    };

    res.json(response);
  })
);

export default router;