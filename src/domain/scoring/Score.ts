import { ValueObject } from '../shared/ValueObject';

export interface ScoreProps {
  agentId: string;
  benchmarkId: string;
  evaluationId: string;
  /** Fraction of tasks resolved, in [0, 1]. The headline SWE-bench metric. */
  resolveRate: number;
  totalTasks: number;
  resolvedTasks: number;
  failedTasks: number;
  timedOutTasks: number;
  avgExecutionTimeMs: number;
  computedAt: Date;
}

/**
 * The immutable result of scoring one evaluation: how an agent did on a
 * benchmark. Value object — equal when contents are equal.
 */
export class Score extends ValueObject {
  readonly agentId: string;
  readonly benchmarkId: string;
  readonly evaluationId: string;
  readonly resolveRate: number;
  readonly totalTasks: number;
  readonly resolvedTasks: number;
  readonly failedTasks: number;
  readonly timedOutTasks: number;
  readonly avgExecutionTimeMs: number;
  readonly computedAt: Date;

  constructor(props: ScoreProps) {
    super();
    this.agentId = props.agentId;
    this.benchmarkId = props.benchmarkId;
    this.evaluationId = props.evaluationId;
    this.resolveRate = props.resolveRate;
    this.totalTasks = props.totalTasks;
    this.resolvedTasks = props.resolvedTasks;
    this.failedTasks = props.failedTasks;
    this.timedOutTasks = props.timedOutTasks;
    this.avgExecutionTimeMs = props.avgExecutionTimeMs;
    this.computedAt = props.computedAt;
  }

  /**
   * Build a Score from raw task counts, deriving the resolve rate.
   */
  static fromCounts(params: {
    agentId: string;
    benchmarkId: string;
    evaluationId: string;
    totalTasks: number;
    resolvedTasks: number;
    failedTasks: number;
    timedOutTasks: number;
    avgExecutionTimeMs: number;
    computedAt?: Date;
  }): Score {
    const resolveRate =
      params.totalTasks > 0 ? params.resolvedTasks / params.totalTasks : 0;
    return new Score({
      ...params,
      resolveRate,
      computedAt: params.computedAt ?? new Date(),
    });
  }
}
