# ADR-007: SWE-bench Lite as the first (MVP) benchmark

- Status: Accepted
- Date: 2026-06-16
- Deciders: HASEB core

## Context

HASEB needs a first benchmark that is credible, runnable on modest
infrastructure, and produces a number people already understand. The candidate
set includes SWE-bench (full, 2,294 tasks), SWE-bench Lite (300 tasks),
SWE-bench Verified, GAIA, OSWorld, and WebArena.

## Decision

Ship **SWE-bench Lite (300 tasks)** as the MVP benchmark.

Rationale:

- **Prestige / recognition.** SWE-bench is the de-facto standard for evaluating
  coding agents. A SWE-bench Lite number is immediately meaningful to the
  audience we care about.
- **Clear, single-number scoring.** The metric is *resolve rate* — the fraction
  of task instances whose gold `FAIL_TO_PASS` tests pass (and `PASS_TO_PASS`
  stay passing) after the agent's patch is applied. No subjective grading.
- **Well-known public baselines.** swebench.com publishes resolve rates for many
  models, so we can seed a non-empty leaderboard from day one (see ADR-010).
- **Tractable size.** 300 tasks fit a single-worker, container-per-task MVP
  (see ADR-008) without a large compute budget. Full SWE-bench (2,294) and
  OSWorld/WebArena (GUI, heavy VM requirements) are deferred.
- **Active community.** Frequent new submissions keep the comparison set fresh.

## Consequences

- The domain model is shaped around code-patch tasks (repo, base commit,
  problem statement, FAIL_TO_PASS / PASS_TO_FAIL test sets).
- Tasks are ingested from the official HuggingFace dataset
  `princeton-nlp/SWE-bench_Lite` (split `test`).
- Adding GAIA/OSWorld/WebArena later is a new harness implementation behind the
  `BenchmarkHarness` interface, not a re-architecture.
