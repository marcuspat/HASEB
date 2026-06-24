import { db } from '../connection';
import { BenchmarkTask, TaskDifficulty } from '../../domain/benchmark/BenchmarkTask';

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toEntity(row: any): BenchmarkTask {
  return new BenchmarkTask({
    id: row.id,
    benchmarkId: row.benchmark_id,
    instanceId: row.instance_id,
    repo: row.repo,
    baseCommit: row.base_commit,
    problemStatement: row.problem_statement,
    hintsText: row.hints_text ?? undefined,
    failToPass: parseJsonArray(row.fail_to_pass),
    passToFail: parseJsonArray(row.pass_to_fail),
    difficulty: (row.difficulty ?? 'medium') as TaskDifficulty,
    version: row.version ?? undefined,
  });
}

/** Data-access for the `benchmark_tasks` table. */
export class BenchmarkTaskModel {
  static async findByBenchmark(benchmarkId: string, limit: number): Promise<BenchmarkTask[]> {
    const result = await db.query(
      `SELECT * FROM benchmark_tasks WHERE benchmark_id = $1 ORDER BY instance_id ASC LIMIT $2`,
      [benchmarkId, limit]
    );
    return result.rows.map(toEntity);
  }

  static async findById(id: string): Promise<BenchmarkTask | null> {
    const result = await db.query(`SELECT * FROM benchmark_tasks WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return toEntity(result.rows[0]);
  }

  static async countByBenchmark(benchmarkId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) AS count FROM benchmark_tasks WHERE benchmark_id = $1`,
      [benchmarkId]
    );
    return parseInt(String(result.rows[0]?.count ?? '0'), 10);
  }
}
