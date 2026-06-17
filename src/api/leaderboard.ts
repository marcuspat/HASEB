import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../database/connection';
import { ApiResponse } from '../types/index';

const router = express.Router();

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: Public benchmark leaderboard
 *     description: >
 *       Public-facing showcase endpoint (no auth). Returns public leaderboard
 *       entries sorted by resolve rate descending, with rank and percentile.
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: benchmarkId
 *         schema:
 *           type: string
 *         description: Filter to a single benchmark
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Max entries to return
 *     responses:
 *       200:
 *         description: Leaderboard entries
 */
router.get(
  '/',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const benchmarkId = req.query.benchmarkId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const params: any[] = [];
    let where = 'WHERE is_public = 1';
    if (benchmarkId) {
      params.push(benchmarkId);
      where += ` AND benchmark_id = $${params.length}`;
    }
    params.push(limit);

    const result = await db.query(
      `SELECT id, agent_id, agent_name, model_provider, benchmark_id, benchmark_name,
              resolve_rate, rank, percentile, total_tasks, is_public, submitted_at
       FROM leaderboard
       ${where}
       ORDER BY resolve_rate DESC
       LIMIT $${params.length}`,
      params
    );

    const entries = result.rows.map((row: any) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      modelProvider: row.model_provider,
      benchmarkId: row.benchmark_id,
      benchmarkName: row.benchmark_name,
      resolveRate: row.resolve_rate,
      rank: row.rank,
      percentile: row.percentile,
      totalTasks: row.total_tasks,
      isPublic: Boolean(row.is_public),
      submittedAt: row.submitted_at,
    }));

    const response: ApiResponse = {
      success: true,
      data: { entries, total: entries.length },
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
