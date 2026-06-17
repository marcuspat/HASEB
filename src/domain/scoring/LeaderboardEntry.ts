export interface LeaderboardEntryProps {
  id: string;
  agentId: string;
  agentName: string;
  modelProvider?: string;
  benchmarkId: string;
  benchmarkName: string;
  resolveRate: number;
  rank?: number;
  percentile?: number;
  totalTasks: number;
  isPublic?: boolean;
  submittedAt?: Date;
}

/**
 * A single ranked row on a benchmark leaderboard. May represent a seeded public
 * baseline (ADR-010) or a run HASEB executed. `rank` and `percentile` are
 * assigned by the owning `Leaderboard` aggregate.
 */
export class LeaderboardEntry {
  readonly id: string;
  readonly agentId: string;
  readonly agentName: string;
  readonly modelProvider?: string;
  readonly benchmarkId: string;
  readonly benchmarkName: string;
  readonly resolveRate: number;
  rank?: number;
  percentile?: number;
  readonly totalTasks: number;
  readonly isPublic: boolean;
  readonly submittedAt: Date;

  constructor(props: LeaderboardEntryProps) {
    this.id = props.id;
    this.agentId = props.agentId;
    this.agentName = props.agentName;
    this.modelProvider = props.modelProvider;
    this.benchmarkId = props.benchmarkId;
    this.benchmarkName = props.benchmarkName;
    this.resolveRate = props.resolveRate;
    this.rank = props.rank;
    this.percentile = props.percentile;
    this.totalTasks = props.totalTasks;
    this.isPublic = props.isPublic ?? true;
    this.submittedAt = props.submittedAt ?? new Date();
  }
}
