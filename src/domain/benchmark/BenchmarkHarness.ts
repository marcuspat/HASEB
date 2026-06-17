import { BenchmarkTask } from './BenchmarkTask';
import { TaskExecutionResult } from './TaskExecutionResult';

/**
 * Port for executing a benchmark task against an agent-produced patch.
 *
 * The concrete MVP implementation runs each task in an isolated Docker
 * container (ADR-008): clone the repo, check out `baseCommit`, apply the patch,
 * run the test sets with a timeout, and report a `TaskExecutionResult`.
 * Keeping this an interface lets us swap in a local stub (for tests) or a
 * remote sandbox provider without touching domain logic.
 */
export interface BenchmarkHarness {
  /**
   * Run a single task with the agent's unified-diff patch.
   * @param timeoutMs hard wall-clock limit; exceeding it yields a timed-out result.
   */
  executeTask(
    task: BenchmarkTask,
    agentPatch: string,
    timeoutMs: number
  ): Promise<TaskExecutionResult>;

  /**
   * Cheap, side-effect-free check that a patch is well-formed (parseable unified
   * diff) before spending a container on it.
   */
  validatePatch(patch: string): boolean;
}
