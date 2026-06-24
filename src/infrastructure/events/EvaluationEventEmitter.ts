import { WebSocketManager } from '../../orchestrator/WebSocketManager';

/**
 * Typed facade over WebSocketManager for the evaluation lifecycle events the
 * frontend listens to (ADR-011). Each event is emitted to the Socket.io room
 * named after the evaluation id, so a client that `join`s that room receives
 * live progress.
 */
export class EvaluationEventEmitter {
  constructor(private readonly ws: WebSocketManager) {}

  queued(evaluationId: string, agentId: string): void {
    this.emit(evaluationId, 'evaluation:queued', { evaluationId, agentId, timestamp: new Date().toISOString() });
  }

  started(evaluationId: string): void {
    this.emit(evaluationId, 'evaluation:started', { evaluationId, timestamp: new Date().toISOString() });
  }

  taskStarted(evaluationId: string, taskId: string): void {
    this.emit(evaluationId, 'task:started', { evaluationId, taskId, timestamp: new Date().toISOString() });
  }

  taskCompleted(evaluationId: string, taskId: string, passed: boolean, executionTimeMs: number): void {
    this.emit(evaluationId, 'task:completed', {
      evaluationId,
      taskId,
      passed,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });
  }

  evaluationCompleted(
    evaluationId: string,
    score: { resolveRate: number; totalTasks: number; resolvedTasks: number }
  ): void {
    this.emit(evaluationId, 'evaluation:completed', { evaluationId, score, timestamp: new Date().toISOString() });
  }

  evaluationFailed(evaluationId: string, error: string): void {
    this.emit(evaluationId, 'evaluation:failed', { evaluationId, error, timestamp: new Date().toISOString() });
  }

  private emit(evaluationId: string, event: string, payload: Record<string, unknown>): void {
    this.ws.emitToEvaluation(evaluationId, event, payload);
  }
}
