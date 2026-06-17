import { TaskExecutionResult } from '../benchmark/TaskExecutionResult';

export type ExecutionJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface ExecutionJobProps {
  id: string;
  evaluationId: string;
  benchmarkTaskId: string;
  agentId: string;
  status?: ExecutionJobStatus;
  agentPatch?: string;
  result?: TaskExecutionResult;
  startedAt?: Date;
  completedAt?: Date;
  retryCount?: number;
}

/**
 * One unit of work: run a single benchmark task for a single agent as part of an
 * evaluation. Persisted in `execution_jobs` and driven through the queue
 * (ADR-009). Identity is `id`; status and result mutate as the job progresses.
 */
export class ExecutionJob {
  readonly id: string;
  readonly evaluationId: string;
  readonly benchmarkTaskId: string;
  readonly agentId: string;
  status: ExecutionJobStatus;
  agentPatch?: string;
  result?: TaskExecutionResult;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;

  constructor(props: ExecutionJobProps) {
    this.id = props.id;
    this.evaluationId = props.evaluationId;
    this.benchmarkTaskId = props.benchmarkTaskId;
    this.agentId = props.agentId;
    this.status = props.status ?? 'pending';
    this.agentPatch = props.agentPatch;
    this.result = props.result;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.retryCount = props.retryCount ?? 0;
  }

  /** Mark the job as started. */
  start(at: Date = new Date()): void {
    this.status = 'running';
    this.startedAt = at;
  }

  /** Record a successful or failed completion from a harness result. */
  complete(result: TaskExecutionResult, at: Date = new Date()): void {
    this.result = result;
    this.status = result.passed ? 'completed' : 'failed';
    this.completedAt = at;
  }

  /** Mark the job as failed (infrastructure error, patch rejected, etc.). */
  fail(at: Date = new Date()): void {
    this.status = 'failed';
    this.completedAt = at;
  }

  /** Mark the job as timed out. */
  timeout(at: Date = new Date()): void {
    this.status = 'timeout';
    this.completedAt = at;
  }

  /** Reset to pending for a retry, incrementing the retry counter. */
  scheduleRetry(): void {
    this.retryCount += 1;
    this.status = 'pending';
    this.startedAt = undefined;
    this.completedAt = undefined;
    this.result = undefined;
  }
}
