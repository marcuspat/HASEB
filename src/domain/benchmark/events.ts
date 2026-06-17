import { DomainEvent } from '../shared/DomainEvent';
import { TaskDifficulty } from './BenchmarkTask';

/** Raised when a benchmark task is ingested into the catalog for the first time. */
export class BenchmarkTaskSeeded extends DomainEvent {
  readonly eventType = 'benchmark.task.seeded';

  constructor(
    readonly taskId: string,
    readonly benchmarkId: string,
    readonly instanceId: string,
    readonly difficulty: TaskDifficulty,
    occurredAt?: Date
  ) {
    super(taskId, occurredAt);
  }
}

/** Raised when an existing benchmark task's data is updated (e.g. re-ingested). */
export class BenchmarkTaskUpdated extends DomainEvent {
  readonly eventType = 'benchmark.task.updated';

  constructor(
    readonly taskId: string,
    readonly benchmarkId: string,
    readonly instanceId: string,
    readonly changedFields: string[],
    occurredAt?: Date
  ) {
    super(taskId, occurredAt);
  }
}
