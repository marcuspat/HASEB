# ADR 0022: Apply Byzantine-fault-tolerant verification with a 0.95 threshold

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** verification, quality, agents

## Context and Problem Statement

HASEB is built and operated in part by AI agents, which can produce
outputs that *look* correct but fail under verification. A single agent's
self-report cannot be trusted as ground truth.

How should HASEB validate agent-produced changes (code, evaluations, or
metric reports) before treating them as authoritative?

## Decision Drivers

- Agents may be incorrect or adversarial.
- Verification must be cheap to execute on every change.
- A bright-line threshold gives clear pass/fail signal.
- Compatibility with `claude-flow@alpha verify` tooling.

## Considered Options

1. **Byzantine-fault-tolerant (BFT) verification: an action is accepted
   only if a quorum of independent verifiers agree above the 0.95 truth
   threshold.**
2. **Single-verifier verification.**
3. **No automated verification; rely on PR review.**

## Decision Outcome

**Chosen option: BFT verification with a 0.95 threshold and auto-rollback
on failure.** This mirrors the project's verification-first culture:
"truth is enforced, not assumed."

### Positive Consequences

- A single misbehaving agent cannot push unverified changes.
- The verification score is a tracked metric on every PR.
- Auto-rollback removes the need for human triage of failed verifications.

### Negative Consequences

- Verification cost is non-zero; we run quorum verification on a sample of
  agent outputs and full verification on changes that touch protected
  modules (orchestrator, persistence, security).

## Implementation Notes

- Tooling: `npx claude-flow@alpha verify init strict` and
  `npx claude-flow@alpha truth`.
- Scope:
  - Code changes: compilation, tests, linting, and type safety form the
    coder-agent verification matrix.
  - Evaluation outputs: results are revalidated by an independent
    `verify-agent` run.
- Threshold: 0.95 truth score.
- Failure handling: `auto-rollback` reverts the change and opens an issue
  with the verifier transcript.

## Validation

- The truth score is logged on every CI run.
- The mean score across the last 100 changes is ≥ 0.97.

## Links

- ADR 0002 — Adopt SPARC + TDD methodology
- `CLAUDE.md` — Verification-First Development
