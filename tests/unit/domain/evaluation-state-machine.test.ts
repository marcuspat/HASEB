import {
  EvaluationLifecycle,
  IllegalStateTransitionError,
  TERMINAL_STATES,
  assertTransition,
  canTransition,
  failureStageFrom,
  isTerminal,
  nextAllowedStates,
} from '../../../src/domain/evaluation-state-machine';
import type { EvaluationState } from '../../../src/domain/contracts';

describe('evaluation state machine', () => {
  test('happy path: queued → running → collecting → analyzing → completed', () => {
    const lc = new EvaluationLifecycle('queued');
    lc.start();
    expect(lc.state()).toBe('running');
    lc.markRunCompleted();
    expect(lc.state()).toBe('collecting');
    lc.markCollected();
    expect(lc.state()).toBe('analyzing');
    lc.complete();
    expect(lc.state()).toBe('completed');
  });

  test('canTransition allows the documented edges only', () => {
    expect(canTransition('queued', 'running')).toBe(true);
    expect(canTransition('queued', 'cancelled')).toBe(true);
    expect(canTransition('queued', 'failed')).toBe(true);
    expect(canTransition('queued', 'collecting')).toBe(false);
    expect(canTransition('running', 'collecting')).toBe(true);
    expect(canTransition('collecting', 'analyzing')).toBe(true);
    expect(canTransition('analyzing', 'completed')).toBe(true);
    expect(canTransition('analyzing', 'cancelled')).toBe(false); // not cancellable from analyzing
  });

  test('terminal states accept no further transitions', () => {
    for (const t of TERMINAL_STATES) {
      expect(isTerminal(t)).toBe(true);
      expect(nextAllowedStates(t)).toEqual([]);
      expect(canTransition(t, 'running')).toBe(false);
    }
  });

  test('cancel allowed only from queued/running', () => {
    expect(canTransition('queued', 'cancelled')).toBe(true);
    expect(canTransition('running', 'cancelled')).toBe(true);
    expect(canTransition('collecting', 'cancelled')).toBe(false);
    expect(canTransition('analyzing', 'cancelled')).toBe(false);
  });

  test('fail allowed from any non-terminal state', () => {
    const nonTerminal: EvaluationState[] = [
      'queued',
      'running',
      'collecting',
      'analyzing',
    ];
    for (const s of nonTerminal) {
      expect(canTransition(s, 'failed')).toBe(true);
    }
  });

  test('assertTransition throws IllegalStateTransitionError on illegal moves', () => {
    expect(() => assertTransition('queued', 'completed')).toThrow(
      IllegalStateTransitionError,
    );
    try {
      assertTransition('completed', 'running');
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalStateTransitionError);
      expect((err as IllegalStateTransitionError).from).toBe('completed');
      expect((err as IllegalStateTransitionError).to).toBe('running');
    }
  });

  test('failureStageFrom matches the documented mapping', () => {
    expect(failureStageFrom('queued')).toBe('queue');
    expect(failureStageFrom('running')).toBe('execution');
    expect(failureStageFrom('collecting')).toBe('collection');
    expect(failureStageFrom('analyzing')).toBe('analysis');
  });

  test('lifecycle.fail returns the right stage and transitions to failed', () => {
    const lc = new EvaluationLifecycle('queued');
    expect(lc.fail()).toEqual({ stage: 'queue' });
    expect(lc.state()).toBe('failed');

    const lc2 = new EvaluationLifecycle('running');
    expect(lc2.fail()).toEqual({ stage: 'execution' });
    expect(lc2.state()).toBe('failed');
  });

  test('lifecycle.cancel from queued / running works; from collecting throws', () => {
    const lc = new EvaluationLifecycle('queued');
    lc.cancel();
    expect(lc.state()).toBe('cancelled');

    const lc2 = new EvaluationLifecycle('collecting');
    expect(() => lc2.cancel()).toThrow(IllegalStateTransitionError);
  });

  test('nextAllowedStates includes happy + cancellable + failable transitions', () => {
    expect(nextAllowedStates('queued')).toEqual([
      'running',
      'cancelled',
      'failed',
    ]);
    expect(nextAllowedStates('running')).toEqual([
      'collecting',
      'cancelled',
      'failed',
    ]);
    expect(nextAllowedStates('collecting')).toEqual(['analyzing', 'failed']);
    expect(nextAllowedStates('analyzing')).toEqual(['completed', 'failed']);
  });
});
