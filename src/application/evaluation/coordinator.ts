import type { EvaluationCoordinator } from './EvaluationCoordinator';

/**
 * Process-wide handle to the wired EvaluationCoordinator. server.ts sets it at
 * startup once the queue and websocket emitter exist; route handlers read it.
 */
let instance: EvaluationCoordinator | null = null;

export function setCoordinator(coordinator: EvaluationCoordinator): void {
  instance = coordinator;
}

export function getCoordinator(): EvaluationCoordinator | null {
  return instance;
}
