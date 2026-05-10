# Reporting & Analytics Context

**Type:** Supporting subdomain.
**Position:** the read-side. Consumes the durable artefacts of the core
contexts and produces leaderboards, trends, and analytics.

## Purpose

Make HASEB's measurements **legible**. The Reporting context turns
completed Evaluations and their MetricSets into views humans use:
- Leaderboard per Benchmark / per Agent family.
- Trend charts per dimension over time.
- Cost analytics per Agent and per Benchmark.

## Ubiquitous Language (local)

- **Leaderboard** — ranked Agents per Benchmark, per Metric Dimension, per
  time window.
- **Slice** — a tuple `(benchmarkId?, agentFamily?, window?, dimension?)`
  that addresses a Leaderboard view.
- **Trend** — time series of a metric for a single Agent.
- **Normalisation** — the per-Benchmark mapping that lets metrics from
  different Benchmarks be compared.

## Aggregates

This context is **read-only** — it does not own aggregates. Its building
blocks are **read models** / projections.

## Read Models

| Read model                | Backed by                                              | Refreshed             |
|---------------------------|--------------------------------------------------------|-----------------------|
| `LeaderboardEntry`        | `evaluations` × `metric_sets` × `agents`               | On `metrics.finalised`|
| `AgentTrendPoint`         | `evaluations` × `metric_sets` aggregated by week       | On `metrics.finalised`|
| `CostSummary`             | `metric_sets` (cost dimension)                         | Materialised view     |

These projections are served by query services (see
[../repositories.md](../repositories.md#query-services-read-side)).

## Use Cases

| Use case                | Application service              | HTTP route                            |
|-------------------------|----------------------------------|---------------------------------------|
| Get the Leaderboard     | `GetLeaderboard` (query)         | `GET /api/v1/leaderboard`             |
| Get an Agent's trend    | `GetAgentTrend` (query)          | `GET /api/v1/agents/{id}/trend`       |
| Get cost analytics      | `GetCostAnalytics` (query)       | `GET /api/v1/analytics/cost`          |

## Domain Services

- `MetricNormaliser` — per-Benchmark normalisation so dimensions are
  comparable.
- (Implicitly) the weighting scheme of the Process Viability Score, which
  this context renders alongside the per-dimension breakdown so that users
  can interpret the composite.

## Components on the Frontend

| Page                                   | Consumes                                                |
|----------------------------------------|---------------------------------------------------------|
| `src/pages/LeaderboardPage.tsx`        | `GET /api/v1/leaderboard`                               |
| `src/pages/AnalyticsPage.tsx`          | `GET /api/v1/analytics/*`                               |
| `src/pages/DashboardPage.tsx`          | summary cards + recent activity                         |
| `src/components/TopAgentsChart.tsx`    | top-N agents by composite score                         |
| `src/components/RecentActivityChart.tsx` | recent Evaluations completion timeline                |

## Boundaries

| Other context              | Interaction                                                       |
|----------------------------|-------------------------------------------------------------------|
| Evaluation                 | Read-only via query services.                                     |
| Metrics                    | Read-only via query services + normalisation.                     |
| Agent Management           | Read-only join for Agent metadata.                                |
| Benchmark Catalog          | Read-only join for Benchmark grouping.                            |
| Notifications & Real-time  | Subscribes to `metrics.finalised` to invalidate cached views.     |

## Caching and Refresh

- Leaderboard responses are cached at the application service for short
  windows (default 30 seconds).
- A subscriber on `metrics.finalised` busts the cache for the affected
  Benchmark and Agent.

## Verification

- Architecture-fitness tests reject any write through Reporting's
  application services.
- Snapshot tests verify Leaderboard rendering against fixed input fixtures.

## Open Questions / Future Work

- Materialised views for the Leaderboard once row counts grow; partition
  the underlying tables by month.
- Export a Parquet snapshot of the metrics warehouse for downstream
  analytics tooling.
