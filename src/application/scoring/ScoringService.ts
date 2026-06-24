import { randomUUID } from 'crypto';
import { db } from '../../database/connection';
import { logger } from '../../utils/logger';
import { Score } from '../../domain/scoring/Score';
import { Leaderboard } from '../../domain/scoring/Leaderboard';
import { LeaderboardEntry } from '../../domain/scoring/LeaderboardEntry';

function isSqlite(): boolean {
  return (process.env.DB_TYPE || 'postgresql').toLowerCase() === 'sqlite';
}

function truthy(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}

/**
 * Computes an evaluation's resolve rate from its execution jobs, persists a
 * Score, and folds the agent's result into the benchmark leaderboard
 * (re-ranking via the Leaderboard aggregate).
 */
export class ScoringService {
  async computeAndSave(
    evaluationId: string,
    agentId: string,
    benchmarkId: string
  ): Promise<Score> {
    const jobs = (
      await db.query(
        `SELECT status, result_passed, result_execution_time_ms
         FROM execution_jobs WHERE evaluation_id = $1`,
        [evaluationId]
      )
    ).rows as Array<{ status: string; result_passed: unknown; result_execution_time_ms: number | null }>;

    const totalTasks = jobs.length;
    const resolvedTasks = jobs.filter((j) => truthy(j.result_passed)).length;
    const timedOutTasks = jobs.filter((j) => j.status === 'timeout').length;
    const failedTasks = jobs.filter((j) => j.status === 'failed' || (!truthy(j.result_passed) && j.status === 'completed')).length;
    const avgExecutionTimeMs =
      totalTasks > 0
        ? jobs.reduce((sum, j) => sum + (j.result_execution_time_ms ?? 0), 0) / totalTasks
        : 0;

    const score = Score.fromCounts({
      agentId,
      benchmarkId,
      evaluationId,
      totalTasks,
      resolvedTasks,
      failedTasks,
      timedOutTasks,
      avgExecutionTimeMs,
    });

    const sqlite = isSqlite();
    const sql = sqlite
      ? `INSERT OR REPLACE INTO scores
           (id, evaluation_id, agent_id, benchmark_id, resolve_rate, total_tasks, resolved_tasks, failed_tasks, timed_out_tasks, avg_execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
      : `INSERT INTO scores
           (id, evaluation_id, agent_id, benchmark_id, resolve_rate, total_tasks, resolved_tasks, failed_tasks, timed_out_tasks, avg_execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (evaluation_id) DO UPDATE SET
           resolve_rate = EXCLUDED.resolve_rate,
           total_tasks = EXCLUDED.total_tasks,
           resolved_tasks = EXCLUDED.resolved_tasks,
           failed_tasks = EXCLUDED.failed_tasks,
           timed_out_tasks = EXCLUDED.timed_out_tasks,
           avg_execution_time_ms = EXCLUDED.avg_execution_time_ms`;

    await db.query(sql, [
      randomUUID(),
      evaluationId,
      agentId,
      benchmarkId,
      score.resolveRate,
      totalTasks,
      resolvedTasks,
      failedTasks,
      timedOutTasks,
      avgExecutionTimeMs,
    ]);

    logger.info(
      `Score computed for evaluation ${evaluationId}: ${resolvedTasks}/${totalTasks} resolved (${(score.resolveRate * 100).toFixed(1)}%)`
    );

    return score;
  }

  /**
   * Upsert the agent's leaderboard entry for the benchmark and recompute ranks
   * via the Leaderboard aggregate.
   */
  async updateLeaderboard(score: Score): Promise<void> {
    const agentRow = (
      await db.query(`SELECT name, configuration FROM agents WHERE id = $1`, [score.agentId])
    ).rows[0] as { name?: string; configuration?: unknown } | undefined;
    const benchmarkRow = (
      await db.query(`SELECT name FROM benchmarks WHERE id = $1`, [score.benchmarkId])
    ).rows[0] as { name?: string } | undefined;

    const agentName = agentRow?.name ?? 'Unknown agent';
    const benchmarkName = benchmarkRow?.name ?? 'Unknown benchmark';
    const modelProvider = extractProvider(agentRow?.configuration);

    const sqlite = isSqlite();
    const upsert = sqlite
      ? `INSERT OR REPLACE INTO leaderboard
           (id, agent_id, agent_name, model_provider, benchmark_id, benchmark_name, resolve_rate, total_tasks, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`
      : `INSERT INTO leaderboard
           (id, agent_id, agent_name, model_provider, benchmark_id, benchmark_name, resolve_rate, total_tasks, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
         ON CONFLICT (agent_id, benchmark_id) DO UPDATE SET
           agent_name = EXCLUDED.agent_name,
           model_provider = EXCLUDED.model_provider,
           resolve_rate = EXCLUDED.resolve_rate,
           total_tasks = EXCLUDED.total_tasks`;

    await db.query(upsert, [
      randomUUID(),
      score.agentId,
      agentName,
      modelProvider,
      score.benchmarkId,
      benchmarkName,
      score.resolveRate,
      score.totalTasks,
    ]);

    // Load all entries for this benchmark into the aggregate, re-rank, persist.
    const rows = (
      await db.query(
        `SELECT id, agent_id, agent_name, model_provider, benchmark_id, benchmark_name, resolve_rate, total_tasks, is_public
         FROM leaderboard WHERE benchmark_id = $1`,
        [score.benchmarkId]
      )
    ).rows as any[];

    const leaderboard = new Leaderboard(
      score.benchmarkId,
      rows.map(
        (r) =>
          new LeaderboardEntry({
            id: r.id,
            agentId: r.agent_id,
            agentName: r.agent_name,
            modelProvider: r.model_provider ?? undefined,
            benchmarkId: r.benchmark_id,
            benchmarkName: r.benchmark_name,
            resolveRate: r.resolve_rate,
            totalTasks: r.total_tasks,
            isPublic: truthy(r.is_public),
          })
      )
    );
    leaderboard.computeRanks();

    for (const entry of leaderboard.entries) {
      await db.query(`UPDATE leaderboard SET rank = $1, percentile = $2 WHERE id = $3`, [
        entry.rank ?? null,
        entry.percentile ?? null,
        entry.id,
      ]);
    }

    logger.info(`Leaderboard updated for benchmark ${score.benchmarkId} (${leaderboard.entries.length} entries)`);
  }
}

function extractProvider(configuration: unknown): string | null {
  if (!configuration) return null;
  try {
    const cfg = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
    return (cfg && typeof cfg === 'object' && (cfg as any).modelProvider) || null;
  } catch {
    return null;
  }
}
