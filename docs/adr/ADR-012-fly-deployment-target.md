# ADR-012: Fly.io as the primary deployment target

- Status: Accepted
- Date: 2026-06-16
- Deciders: HASEB core

## Context

HASEB needs a host that can run Docker-in-Docker style workloads (ADR-008 runs a
container per task), offers a managed Postgres, has a usable free/low tier for an
MVP, and keeps latency reasonable for a global audience. Candidates: Fly.io,
Railway, Render, AWS/GCP.

## Decision

Target **Fly.io** as the primary deployment platform.

- **Docker-native.** Fly deploys OCI images directly and runs Firecracker
  micro-VMs, which suits our container-per-task execution model (ADR-008).
- **Managed Postgres.** Fly Postgres covers the relational store that backs the
  job queue (ADR-009), benchmark tasks, scores, and leaderboard.
- **Cost.** A small free/hobby footprint is enough to stand up the MVP.
- **Global edge.** Apps deploy close to users across regions, keeping the
  public leaderboard and live dashboard responsive.

## Consequences

- The app must build and run from a `Dockerfile` (already the project's
  packaging direction) and read configuration from environment variables
  (`DATABASE_URL`, `JWT_SECRET`, etc.).
- Health checks (`GET /health`) and graceful shutdown (SIGTERM) — both already
  implemented — are used by Fly for rolling deploys.
- Migrations run on boot; the leaderboard seed (ADR-010) runs on boot;
  the SWE-bench task seed is a manual one-off (it fetches 300 rows from
  HuggingFace) — see `npm run seed:swebench`.
- This is a *primary* target, not a lock-in: nothing depends on Fly-specific
  APIs, so Railway/Render/a VM remain fallback options.
