/**
 * Evaluation state machine.
 *
 * Encodes the strict DAG documented in
 * `docs/ddd/contexts/evaluation-context.md`. Produced as a small, pure
 * helper module so the existing `EvaluationModel` can adopt it
 * incrementally without changing its persistence shape.
 *
 *     queued ──► running ──► collecting ──► analyzing ──► completed
 *        │         │             │              │
 *        │         │             └─► failed     └─► failed
 *        ├─► cancelled            │
 *        └─► failed                └─► failed
 *                  │
 *                  └─► cancelled
 *
 * - Terminal states (`completed`, `failed`, `cancelled`) accept no further
 *   transitions.
 * - `cancel()` is allowed only from `queued` or `running`.
 * - `fail(stage)` is allowed from any non-terminal state.
 */

import type { EvaluationState } from './contracts';
import type { EvaluationFailureStage } from './events';

export const TERMINAL_STATES = ['completed', 'failed', 'cancelled'] as const;
export type TerminalEvaluationState = (typeof TERMINAL_STATES)[number];

const HAPPY_PATH: Readonly<Record<EvaluationState, readonly EvaluationState[]>> =
  Object.freeze({
    queued: ['running'],
    running: ['collecting'],
    collecting: ['analyzing'],
    analyzing: ['completed'],
    completed: [],
    failed: [],
    cancelled: [],
  });

const CANCELLABLE_FROM: ReadonlySet<EvaluationState> = new Set<EvaluationState>([
  'queued',
  'running',
]);

const FAILABLE_FROM: ReadonlySet<EvaluationState> = new Set<EvaluationState>([
  'queued',
  'running',
  'collecting',
  'analyzing',
]);

export class IllegalStateTransitionError extends Error {
  constructor(
    public readonly from: EvaluationState,
    public readonly to: EvaluationState,
  ) {
    super(`Illegal transition: ${from} → ${to}`);
    this.name = 'IllegalStateTransitionError';
  }
}

export function isTerminal(state: EvaluationState): boolean {
  return (TERMINAL_STATES as readonly EvaluationState[]).includes(state);
}

/**
 * Returns the set of states reachable from `state` in a single transition.
 * Useful for UI affordances and tests.
 */
export function nextAllowedStates(
  state: EvaluationState,
): readonly EvaluationState[] {
  if (isTerminal(state)) return [];
  const allowed: EvaluationState[] = [...HAPPY_PATH[state]];
  if (CANCELLABLE_FROM.has(state)) allowed.push('cancelled');
  if (FAILABLE_FROM.has(state)) allowed.push('failed');
  return Object.freeze(allowed);
}

export function canTransition(
  from: EvaluationState,
  to: EvaluationState,
): boolean {
  return nextAllowedStates(from).includes(to);
}

export function assertTransition(
  from: EvaluationState,
  to: EvaluationState,
): void {
  if (!canTransition(from, to)) {
    throw new IllegalStateTransitionError(from, to);
  }
}

/**
 * Convenience: derive the failure stage that goes onto `evaluation.failed`
 * from the state we failed *out of*. Mirrors the rule in
 * `docs/ddd/domain-events.md`.
 */
export function failureStageFrom(
  from: EvaluationState,
): EvaluationFailureStage {
  switch (from) {
    case 'queued':
      return 'queue';
    case 'running':
      return 'execution';
    case 'collecting':
      return 'collection';
    case 'analyzing':
      return 'analysis';
    default:
      // failed/cancelled/completed are terminal; assertTransition will throw
      // before we get here, but keep a defensive default.
      return 'execution';
  }
}

/**
 * Tiny stateful wrapper for callers that prefer object semantics. Holds
 * the current state and offers `start()`, `markRunCompleted()`, etc.
 *
 * This is *purely a helper*: the authoritative state lives in the
 * Evaluation aggregate. Nothing here touches persistence.
 */
export class EvaluationLifecycle {
  constructor(private current: EvaluationState) {}

  state(): EvaluationState {
    return this.current;
  }

  transition(to: EvaluationState): void {
    assertTransition(this.current, to);
    this.current = to;
  }

  start(): void {
    this.transition('running');
  }

  markRunCompleted(): void {
    this.transition('collecting');
  }

  markCollected(): void {
    this.transition('analyzing');
  }

  complete(): void {
    this.transition('completed');
  }

  fail(): { stage: EvaluationFailureStage } {
    const stage = failureStageFrom(this.current);
    this.transition('failed');
    return { stage };
  }

  cancel(): void {
    this.transition('cancelled');
  }
}
