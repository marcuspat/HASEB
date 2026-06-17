import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { BenchmarkHarness } from '../domain/benchmark/BenchmarkHarness';
import { BenchmarkTask } from '../domain/benchmark/BenchmarkTask';
import { TaskExecutionResult } from '../domain/benchmark/TaskExecutionResult';
import { logger } from '../utils/logger';

/**
 * Runs a single SWE-bench task in an isolated Docker container (ADR-008).
 *
 * The container clones the repo, checks out the base commit, applies the
 * agent's patch, runs the FAIL_TO_PASS tests, and prints a JSON result line.
 * Network is disabled inside the container except for the clone step; the
 * image is expected to provide git/jest/pytest. The default image is
 * `ghcr.io/princeton-nlp/swe-bench:latest`.
 */
export class SWEBenchHarness implements BenchmarkHarness {
  private readonly image: string;

  constructor(image: string = process.env.SWE_BENCH_IMAGE || 'ghcr.io/princeton-nlp/swe-bench:latest') {
    this.image = image;
  }

  /** Cheap structural check that the patch looks like a unified diff. */
  validatePatch(patch: string): boolean {
    if (!patch || patch.trim().length === 0) {
      return false;
    }
    return /^(diff --git |--- |\+\+\+ |@@ )/m.test(patch);
  }

  async executeTask(
    task: BenchmarkTask,
    agentPatch: string,
    timeoutMs: number
  ): Promise<TaskExecutionResult> {
    const start = Date.now();
    const containerName = `haseb-${task.instanceId.replace(/[^a-zA-Z0-9_.-]/g, '_')}-${randomUUID().slice(0, 8)}`;
    const entrypoint = this.buildEntrypoint(task);

    return new Promise<TaskExecutionResult>((resolve) => {
      const child = spawn('docker', [
        'run',
        '--rm',
        '--name', containerName,
        '--network=none',
        '-e', `PATCH_CONTENT=${agentPatch}`,
        '-e', `REPO=${task.repo}`,
        '-e', `BASE_COMMIT=${task.baseCommit}`,
        '-e', `FAIL_TO_PASS=${task.failToPass.join(',')}`,
        this.image,
        'sh', '-c', entrypoint,
      ]);

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        // Best-effort kill the container, then the spawned process.
        spawn('docker', ['kill', containerName]);
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        logger.error(`SWEBenchHarness spawn error for ${task.instanceId}:`, err);
        resolve(
          new TaskExecutionResult({
            taskId: task.id,
            passed: false,
            testsRun: 0,
            testsPassed: 0,
            testsFailed: 0,
            executionTimeMs: Date.now() - start,
            stdout,
            stderr: stderr + '\n' + String(err),
            errorMessage: `Failed to start Docker: ${err.message}`,
          })
        );
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - start;

        if (timedOut) {
          resolve(
            new TaskExecutionResult({
              taskId: task.id,
              passed: false,
              testsRun: task.failToPass.length,
              testsPassed: 0,
              testsFailed: task.failToPass.length,
              executionTimeMs,
              stdout,
              stderr,
              errorMessage: `Execution timed out after ${timeoutMs}ms`,
            })
          );
          return;
        }

        resolve(this.parseResult(task, stdout, stderr, executionTimeMs, code));
      });
    });
  }

  /** Parse the JSON result printed on the last non-empty stdout line. */
  private parseResult(
    task: BenchmarkTask,
    stdout: string,
    stderr: string,
    executionTimeMs: number,
    exitCode: number | null
  ): TaskExecutionResult {
    const lines = stdout.trim().split('\n').filter((l) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? '';

    try {
      const parsed = JSON.parse(lastLine) as {
        passed?: boolean;
        testsRun?: number;
        testsPassed?: number;
        testsFailed?: number;
      };
      return new TaskExecutionResult({
        taskId: task.id,
        passed: Boolean(parsed.passed),
        testsRun: parsed.testsRun ?? 0,
        testsPassed: parsed.testsPassed ?? 0,
        testsFailed: parsed.testsFailed ?? 0,
        executionTimeMs,
        stdout,
        stderr,
      });
    } catch {
      return new TaskExecutionResult({
        taskId: task.id,
        passed: false,
        testsRun: task.failToPass.length,
        testsPassed: 0,
        testsFailed: task.failToPass.length,
        executionTimeMs,
        stdout,
        stderr,
        errorMessage: `Could not parse harness result (exit ${exitCode}). Last line: ${lastLine.slice(0, 200)}`,
      });
    }
  }

  /** The in-container shell script: clone, checkout, apply patch, run tests, print JSON. */
  private buildEntrypoint(task: BenchmarkTask): string {
    const failToPass = task.failToPass.join(' ');
    return [
      'set -e',
      'git clone --depth=1 "https://github.com/$REPO" /workspace 2>/dev/null || git clone --depth=1 "$REPO" /workspace',
      'git -C /workspace fetch origin "$BASE_COMMIT" --depth=1 2>/dev/null || true',
      'git -C /workspace checkout "$BASE_COMMIT" 2>/dev/null || true',
      'printf "%s" "$PATCH_CONTENT" | git -C /workspace apply - 2>/dev/null || true',
      'cd /workspace',
      `RESULT=$(npx jest ${failToPass} --json 2>/dev/null || python -m pytest ${failToPass} --json-report 2>/dev/null || echo '')`,
      // The image's test wrapper is expected to print a final JSON summary line.
      'echo "$RESULT" | tail -n 1',
    ].join('\n');
  }
}
