# ADR-010: Seed known public leaderboard data on startup

- Status: Accepted
- Date: 2026-06-16
- Deciders: HASEB core

## Context

A leaderboard that is empty on first load makes the product look dead and gives
visitors nothing to compare their own runs against. Generating real data
requires running full evaluations, which is expensive and cannot happen before
the first user arrives.

## Decision

**Seed known public SWE-bench Lite resolve rates on startup** so the leaderboard
shows real, attributable data from day one.

- The seed inserts a curated set of published model results (e.g. Claude 3.5
  Sonnet, GPT-4o, Llama-3.1-405B, Gemini 1.5 Pro …) as `is_public` leaderboard
  entries, then computes ranks and percentiles.
- **Source:** the official SWE-bench leaderboard at https://swebench.com
  (SWE-bench Lite split). Each entry records `model_provider` and the published
  `resolve_rate` over 300 tasks.
- The seed is **idempotent** (`UNIQUE(agent_id, benchmark_id)` +
  insert-or-ignore, then recompute ranks), so it is safe to run on every boot.

## Consequences

- The leaderboard is populated and credible immediately; user-submitted runs are
  ranked against recognizable baselines.
- Seeded rows are clearly public/reference data, distinct from runs HASEB
  actually executed. Provenance is the published leaderboard, not our harness.
- Published numbers drift as the upstream leaderboard updates; the seed list is
  a point-in-time snapshot and should be refreshed periodically.
- Booting never leaves an empty leaderboard, but the seed must not clobber real
  computed entries — hence insert-or-ignore rather than upsert-overwrite.
