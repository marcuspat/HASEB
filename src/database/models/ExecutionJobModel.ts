import { db } from '../connection';
import { TaskExecutionResult } from '../../domain/benchmark/TaskExecutionResult';
import { ExecutionJobStatus } from '../../domain/execution/ExecutionJob';

export interface ExecutionJobRow {
  id: string;
  evaluation_id: string;
  benchmark_task_id: string;
  agent_id: string;
  status: ExecutionJobStatus;
  agent_patch: string | null;
  result_passed: number | boolean | null;
  result_execution_time_ms: number | null;
  retry_count: number;
}

/** Thin data-access for the `execution_jobs` table (ADR-009). */
export class ExecutionJobModel {
  static async create(params: {
    id: string;
    evaluationId: string;
    benchmarkTaskId: string;
    agentId: string;
    agentPatch?: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO execution_jobs (id, evaluation_id, benchmark_task_id, agent_id, status, agent_patch)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [params.id, params.evaluationId, params.benchmarkTaskId, params.agentId, params.agentPatch ?? null]
    );
  }

  static async findByEvaluation(evaluationId: string): Promise<ExecutionJobRow[]> {
    const result = await db.query(
      `SELECT * FROM execution_jobs WHERE evaluation_id = $1 ORDER BY created_at ASC`,
      [evaluationId]
    );
    return result.rows as ExecutionJobRow[];
  }

  static async markRunning(id: string): Promise<void> {
    await db.query(
      `UPDATE execution_jobs SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  }

  /** Persist a finished job: its terminal status and flattened result columns. */
  static async saveResult(
    id: string,
    status: ExecutionJobStatus,
    result: TaskExecutionResult
  ): Promise<void> {
    await db.query(
      `UPDATE execution_jobs
       SET status = $1,
           result_passed = $2,
           result_tests_run = $3,
           result_tests_passed = $4,
           result_tests_failed = $5,
           result_execution_time_ms = $6,
           result_stdout = $7,
           result_stderr = $8,
           result_error_message = $9,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [
        status,
        result.passed ? 1 : 0,
        result.testsRun,
        result.testsPassed,
        result.testsFailed,
        result.executionTimeMs,
        result.stdout?.slice(0, 100000) ?? '',
        result.stderr?.slice(0, 100000) ?? '',
        result.errorMessage ?? null,
        id,
      ]
    );
  }
}
