import { DomainEvent } from '../shared/DomainEvent';
import { TaskExecutionResult } from '../benchmark/TaskExecutionResult';

/** Raised when an execution job begins running (maps to `task:started`). */
export class ExecutionJobStarted extends DomainEvent {
  readonly eventType = 'execution.job.started';

  constructor(
    readonly jobId: string,
    readonly evaluationId: string,
    readonly benchmarkTaskId: string,
    readonly agentId: string,
    occurredAt?: Date
  ) {
    super(jobId, occurredAt);
  }
}

/** Raised when an execution job finishes (maps to `task:completed`). */
export class ExecutionJobCompleted extends DomainEvent {
  readonly eventType = 'execution.job.completed';

  constructor(
    readonly jobId: string,
    readonly evaluationId: string,
    readonly benchmarkTaskId: string,
    readonly result: TaskExecutionResult,
    occurredAt?: Date
  ) {
    super(jobId, occurredAt);
  }
}

/** Raised when an execution job fails or times out. */
export class ExecutionJobFailed extends DomainEvent {
  readonly eventType = 'execution.job.failed';

  constructor(
    readonly jobId: string,
    readonly evaluationId: string,
    readonly benchmarkTaskId: string,
    readonly reason: string,
    readonly timedOut: boolean = false,
    occurredAt?: Date
  ) {
    super(jobId, occurredAt);
  }
}
