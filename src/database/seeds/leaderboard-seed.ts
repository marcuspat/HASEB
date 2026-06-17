import { randomUUID } from 'crypto';
import { db } from '../connection';
import { logger } from '../../utils/logger';

/**
 * Seeds known public SWE-bench Lite resolve rates as public leaderboard entries
 * so the leaderboard shows real, recognizable baselines from day one (ADR-010).
 *
 * Idempotent: safe to run on every boot. Entries are inserted-or-ignored on
 * UNIQUE(agent_id, benchmark_id), then ranks/percentiles are recomputed.
 */

/** Deterministic id for the seeded SWE-bench Lite benchmark (valid UUID for PG). */
export const SWE_BENCH_LITE_BENCHMARK_ID = '00000000-0000-4000-8000-000000000001';
export const SWE_BENCH_LITE_BENCHMARK_NAME = 'SWE-bench Lite';

/**
 * Published SWE-bench Lite resolve rates (300 tasks).
 * Source: the official SWE-bench leaderboard, https://swebench.com
 */
const PUBLIC_RESULTS: Array<{
  agentName: string;
  provider: string;
  resolveRate: number;
  totalTasks: number;
}> = [
  { agentName: 'Claude 3.5 Sonnet (Agentless)', provider: 'anthropic', resolveRate: 0.486, totalTasks: 300 },
  { agentName: 'GPT-4o (Agentless)', provider: 'openai', resolveRate: 0.326, totalTasks: 300 },
  { agentName: 'Claude 3 Opus (Agentless)', provider: 'anthropic', resolveRate: 0.232, totalTasks: 300 },
  { agentName: 'GPT-4 Turbo (Agentless)', provider: 'openai', resolveRate: 0.191, totalTasks: 300 },
  { agentName: 'Claude 3 Sonnet (Agentless)', provider: 'anthropic', resolveRate: 0.183, totalTasks: 300 },
  { agentName: 'Llama-3.1-405B (Agentless)', provider: 'meta', resolveRate: 0.178, totalTasks: 300 },
  { agentName: 'Gemini 1.5 Pro (Agentless)', provider: 'google', resolveRate: 0.156, totalTasks: 300 },
  { agentName: 'GPT-3.5 Turbo (Agentless)', provider: 'openai', resolveRate: 0.087, totalTasks: 300 },
];

function isSqlite(): boolean {
  return (process.env.DB_TYPE || 'postgresql').toLowerCase() === 'sqlite';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensure the SWE-bench Lite benchmark row exists. Required because both the
 * leaderboard and benchmark_tasks reference benchmarks(id). Idempotent.
 */
export async function ensureSweBenchLiteBenchmark(): Promise<string> {
  const sqlite = isSqlite();
  const sql = sqlite
    ? `INSERT OR IGNORE INTO benchmarks (id, name, type, description, dataset, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)`
    : `INSERT INTO benchmarks (id, name, type, description, dataset, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`;

  await db.query(sql, [
    SWE_BENCH_LITE_BENCHMARK_ID,
    SWE_BENCH_LITE_BENCHMARK_NAME,
    'swe-bench',
    'SWE-bench Lite: 300 real-world GitHub issue resolution tasks.',
    'princeton-nlp/SWE-bench_Lite',
    sqlite ? 1 : true,
  ]);

  return SWE_BENCH_LITE_BENCHMARK_ID;
}

async function insertPublicEntries(): Promise<void> {
  const sqlite = isSqlite();
  const sql = sqlite
    ? `INSERT OR IGNORE INTO leaderboard
         (id, agent_id, agent_name, model_provider, benchmark_id, benchmark_name, resolve_rate, total_tasks, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
    : `INSERT INTO leaderboard
         (id, agent_id, agent_name, model_provider, benchmark_id, benchmark_name, resolve_rate, total_tasks, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (agent_id, benchmark_id) DO NOTHING`;

  for (const r of PUBLIC_RESULTS) {
    await db.query(sql, [
      randomUUID(),
      slugify(r.agentName),
      r.agentName,
      r.provider,
      SWE_BENCH_LITE_BENCHMARK_ID,
      SWE_BENCH_LITE_BENCHMARK_NAME,
      r.resolveRate,
      r.totalTasks,
      sqlite ? 1 : true,
    ]);
  }
}

/**
 * Recompute rank (1-based, resolve_rate desc) and percentile (top = 100,
 * bottom = 0) for every entry on the SWE-bench Lite leaderboard.
 */
async function recomputeRanks(): Promise<void> {
  const result = await db.query(
    `SELECT id FROM leaderboard WHERE benchmark_id = $1 ORDER BY resolve_rate DESC`,
    [SWE_BENCH_LITE_BENCHMARK_ID]
  );
  const rows: Array<{ id: string }> = result.rows;
  const n = rows.length;

  for (let i = 0; i < n; i++) {
    const rank = i + 1;
    const percentile = n > 1 ? ((n - rank) / (n - 1)) * 100 : 100;
    await db.query(`UPDATE leaderboard SET rank = $1, percentile = $2 WHERE id = $3`, [
      rank,
      percentile,
      rows[i].id,
    ]);
  }
}

/** Idempotently seed the public leaderboard and recompute rankings. */
export async function seedLeaderboard(): Promise<void> {
  await ensureSweBenchLiteBenchmark();
  await insertPublicEntries();
  await recomputeRanks();
  logger.info(`Leaderboard seeded: ${PUBLIC_RESULTS.length} public SWE-bench Lite entries`);
}

// Allow running directly: `tsx src/database/seeds/leaderboard-seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedLeaderboard()
    .then(() => {
      logger.info('Leaderboard seed complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Leaderboard seed failed:', error);
      process.exit(1);
    });
}
