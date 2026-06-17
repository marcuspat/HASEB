export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export interface BenchmarkTaskProps {
  id: string;
  benchmarkId: string;
  /** The dataset instance id, e.g. `django__django-12345`. Globally unique. */
  instanceId: string;
  /** `owner/name` of the repository under test. */
  repo: string;
  /** Commit the repository is checked out at before the agent patch is applied. */
  baseCommit: string;
  /** Natural-language description of the issue the agent must resolve. */
  problemStatement: string;
  /** Optional hints provided by the dataset. */
  hintsText?: string;
  /** Tests that fail before the fix and must pass after it (the success gate). */
  failToPass: string[];
  /** Tests that must keep passing (regression guard). */
  passToFail: string[];
  difficulty: TaskDifficulty;
  /** Dataset/version tag the task was ingested from. */
  version?: string;
}

/**
 * A single benchmark task (e.g. one SWE-bench Lite instance).
 *
 * Entity: identity is `id`. The fields mirror the SWE-bench task shape so the
 * Docker harness (ADR-008) can clone `repo`, check out `baseCommit`, apply the
 * agent's patch, and run the `failToPass` / `passToFail` test sets.
 */
export class BenchmarkTask {
  readonly id: string;
  readonly benchmarkId: string;
  readonly instanceId: string;
  readonly repo: string;
  readonly baseCommit: string;
  readonly problemStatement: string;
  readonly hintsText?: string;
  readonly failToPass: string[];
  readonly passToFail: string[];
  readonly difficulty: TaskDifficulty;
  readonly version?: string;

  constructor(props: BenchmarkTaskProps) {
    this.id = props.id;
    this.benchmarkId = props.benchmarkId;
    this.instanceId = props.instanceId;
    this.repo = props.repo;
    this.baseCommit = props.baseCommit;
    this.problemStatement = props.problemStatement;
    this.hintsText = props.hintsText;
    this.failToPass = props.failToPass;
    this.passToFail = props.passToFail;
    this.difficulty = props.difficulty;
    this.version = props.version;
  }
}
