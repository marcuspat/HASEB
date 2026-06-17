import { ValueObject } from '../shared/ValueObject';

export interface TaskExecutionResultProps {
  taskId: string;
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  executionTimeMs: number;
  stdout: string;
  stderr: string;
  errorMessage?: string;
}

/**
 * The immutable outcome of running one benchmark task in the harness.
 *
 * Value object: two results are equal when their contents are equal. `passed`
 * is the harness's verdict (all `failToPass` tests passed and no `passToFail`
 * regression). `errorMessage` is set when execution itself failed (patch did
 * not apply, container error, timeout).
 */
export class TaskExecutionResult extends ValueObject {
  readonly taskId: string;
  readonly passed: boolean;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly executionTimeMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly errorMessage?: string;

  constructor(props: TaskExecutionResultProps) {
    super();
    this.taskId = props.taskId;
    this.passed = props.passed;
    this.testsRun = props.testsRun;
    this.testsPassed = props.testsPassed;
    this.testsFailed = props.testsFailed;
    this.executionTimeMs = props.executionTimeMs;
    this.stdout = props.stdout;
    this.stderr = props.stderr;
    this.errorMessage = props.errorMessage;
  }
}
