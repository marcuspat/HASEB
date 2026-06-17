import { DomainEvent } from '../shared/DomainEvent';

/** Raised when an evaluation has been scored (maps to `evaluation:completed`). */
export class ScoreComputed extends DomainEvent {
  readonly eventType = 'scoring.score.computed';

  constructor(
    readonly evaluationId: string,
    readonly agentId: string,
    readonly benchmarkId: string,
    readonly resolveRate: number,
    readonly totalTasks: number,
    occurredAt?: Date
  ) {
    super(evaluationId, occurredAt);
  }
}

/** Raised when a benchmark's leaderboard is re-ranked. */
export class LeaderboardUpdated extends DomainEvent {
  readonly eventType = 'scoring.leaderboard.updated';

  constructor(
    readonly benchmarkId: string,
    readonly entryCount: number,
    occurredAt?: Date
  ) {
    super(benchmarkId, occurredAt);
  }
}
