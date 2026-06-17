import { randomUUID } from 'crypto';
import { db } from '../connection';
import { logger } from '../../utils/logger';
import {
  SWE_BENCH_LITE_BENCHMARK_ID,
  ensureSweBenchLiteBenchmark,
} from './leaderboard-seed';

/**
 * Ingests SWE-bench Lite tasks (300) from the HuggingFace datasets API into the
 * `benchmark_tasks` table (ADR-007). Fetched in batches of 100 (3 requests).
 *
 * Idempotent: inserts are ignored on the UNIQUE instance_id. This is NOT run on
 * boot (it makes external HTTP calls) — run manually via `npm run seed:swebench`.
 */

const HF_ROWS_URL =
  'https://datasets-server.huggingface.co/rows' +
  '?dataset=princeton-nlp%2FSWE-bench_Lite&config=default&split=test';

const TOTAL_TASKS = 300;
const BATCH_SIZE = 100;

interface SweBenchRow {
  instance_id: string;
  repo: string;
  base_commit: string;
  problem_statement: string;
  hints_text?: string;
  FAIL_TO_PASS?: string | string[];
  PASS_TO_PASS?: string | string[];
  version?: string;
}

function isSqlite(): boolean {
  return (process.env.DB_TYPE || 'postgresql').toLowerCase() === 'sqlite';
}

/** SWE-bench stores test lists as JSON-encoded strings; normalize to a JSON array string. */
function toJsonArrayString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      return JSON.stringify([value]);
    }
  }
  return '[]';
}

async function fetchBatch(offset: number, length: number): Promise<SweBenchRow[]> {
  const url = `${HF_ROWS_URL}&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HuggingFace fetch failed (${res.status} ${res.statusText}) for offset=${offset}`);
  }
  const json: any = await res.json();
  const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
  return rows.map((r) => r.row as SweBenchRow);
}

/**
 * Fetch SWE-bench Lite tasks and insert them under the given benchmark.
 * @returns the number of rows processed (attempted inserts).
 */
export async function seedSWEBenchLiteTasks(
  benchmarkId: string = SWE_BENCH_LITE_BENCHMARK_ID
): Promise<number> {
  // Ensure the parent benchmark exists (FK target) when run standalone.
  await ensureSweBenchLiteBenchmark();

  const sqlite = isSqlite();
  const sql = sqlite
    ? `INSERT OR IGNORE INTO benchmark_tasks
         (id, benchmark_id, instance_id, repo, base_commit, problem_statement, hints_text, fail_to_pass, pass_to_fail, difficulty, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
    : `INSERT INTO benchmark_tasks
         (id, benchmark_id, instance_id, repo, base_commit, problem_statement, hints_text, fail_to_pass, pass_to_fail, difficulty, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (instance_id) DO NOTHING`;

  let processed = 0;

  for (let offset = 0; offset < TOTAL_TASKS; offset += BATCH_SIZE) {
    const length = Math.min(BATCH_SIZE, TOTAL_TASKS - offset);
    logger.info(`Fetching SWE-bench Lite tasks ${offset}..${offset + length}`);
    const rows = await fetchBatch(offset, length);

    for (const row of rows) {
      if (!row?.instance_id) {
        continue;
      }
      await db.query(sql, [
        randomUUID(),
        benchmarkId,
        row.instance_id,
        row.repo,
        row.base_commit,
        row.problem_statement,
        row.hints_text ?? null,
        // FAIL_TO_PASS = success gate; PASS_TO_PASS = regression-guard set (stored in pass_to_fail).
        toJsonArrayString(row.FAIL_TO_PASS),
        toJsonArrayString(row.PASS_TO_PASS),
        'medium',
        row.version ?? null,
      ]);
      processed += 1;
    }
  }

  logger.info(`SWE-bench Lite ingestion complete: ${processed} tasks processed`);
  return processed;
}

// Allow running directly: `tsx src/database/seeds/swebench-tasks.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSWEBenchLiteTasks()
    .then((count) => {
      logger.info(`SWE-bench seed complete (${count} tasks)`);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('SWE-bench seed failed:', error);
      process.exit(1);
    });
}
