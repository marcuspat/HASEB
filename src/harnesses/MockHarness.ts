import { BenchmarkHarness } from '../domain/benchmark/BenchmarkHarness';
import { BenchmarkTask } from '../domain/benchmark/BenchmarkTask';
import { TaskExecutionResult } from '../domain/benchmark/TaskExecutionResult';

/**
 * Deterministic-ish stub harness used to prove the end-to-end pipeline without
 * Docker. Each task "passes" with probability `successRate`. Enabled via
 * `USE_MOCK_HARNESS=true` (the default for the first deploy).
 */
export class MockHarness implements BenchmarkHarness {
  constructor(private readonly successRate: number = 0.7) {}

  validatePatch(_patch: string): boolean {
    return true;
  }

  async executeTask(
    task: BenchmarkTask,
    _agentPatch: string,
    _timeoutMs: number
  ): Promise<TaskExecutionResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const testsRun = task.failToPass.length || 1;
    const passed = Math.random() < this.successRate;
    const testsPassed = passed ? testsRun : Math.floor(testsRun * Math.random());
    const testsFailed = testsRun - testsPassed;

    return new TaskExecutionResult({
      taskId: task.id,
      passed,
      testsRun,
      testsPassed,
      testsFailed,
      executionTimeMs: 100,
      stdout: `[mock] ran ${testsRun} tests for ${task.instanceId}: ${passed ? 'PASS' : 'FAIL'}`,
      stderr: '',
    });
  }
}
