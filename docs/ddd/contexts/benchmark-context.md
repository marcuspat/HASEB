# Benchmark Catalog Context

**Type:** Supporting subdomain.
**Position:** the curator of the benchmark library. Conformist to upstream
benchmark projects.

## Purpose

Catalogue the available benchmarks, version them, store their task corpus,
and expose them to the Orchestrator. The catalog is the **single source of
truth** for what each Benchmark contains and how its outcomes are judged.

## Ubiquitous Language (local)

- **Benchmark** — a published task suite (e.g. SWE-bench v2.1, GAIA v1.0).
- **Benchmark Task** — one problem instance inside a Benchmark.
- **Oracle Spec** — the rules that decide whether a Run succeeded.
- **Benchmark Kind** — `code`, `gui`, or `reasoning`. Drives which Execution
  Agent the Orchestrator picks.

## Aggregates

### Benchmark (root)

Members:
- `BenchmarkTask[]` (immutable per version)
- `OracleSpec` (1-to-1)

See [../aggregates.md](../aggregates.md#3-benchmark-aggregate-supporting).

## Conformist Relationship

The Catalog **conforms** to upstream benchmark specifications. We do not
ask SWE-bench / GAIA / OSWorld maintainers to change their formats; we
ingest, version, and trace.

- An importer script reads the upstream manifest and writes a new
  `Benchmark` aggregate via `PublishBenchmark`.
- The upstream version string is preserved in `Benchmark.version`.
- The `previousVersionId` field links chronological versions.

## Use Cases

| Use case                    | Application service        | HTTP route                                      |
|-----------------------------|----------------------------|-------------------------------------------------|
| Publish a Benchmark         | `PublishBenchmark`         | `POST /api/v1/benchmarks`                       |
| Deprecate a Benchmark       | `DeprecateBenchmark`       | `POST /api/v1/benchmarks/{id}/deprecate`        |
| List Benchmarks             | `ListBenchmarks` (query)   | `GET /api/v1/benchmarks`                        |
| Get a Benchmark             | `GetBenchmark` (query)     | `GET /api/v1/benchmarks/{id}`                   |
| List Benchmark Tasks        | `ListTasks` (query)        | `GET /api/v1/benchmarks/{id}/tasks`             |

## Repositories

- `IBenchmarkRepository`.

## Domain Events

- `benchmark.published`
- `benchmark.deprecated`

## Domain Services

- `RunOutcomeOracle` lives logically in the Evaluation context, but its
  concrete strategies (`UnitTestOracle`, `RubricOracle`,
  `ReferenceMatchOracle`, `CustomOracle`) are constructed from `OracleSpec`
  defined here.

## Persistence Mapping

- Tables: `benchmarks`, `benchmark_tasks`.
- Indexes:
  - `benchmarks(name, version)` unique.
  - `benchmark_tasks(benchmark_id, external_task_id)` unique.

## Versioning Rules

- Publishing a Benchmark with the same `name` and a new `version` creates a
  new aggregate; tasks and oracle are version-pinned.
- Deprecation is non-destructive: completed Evaluations against deprecated
  Benchmarks remain queryable for historical comparison; the Leaderboard
  surfaces the deprecation marker.

## Boundaries

| Other context              | Interaction                                                       |
|----------------------------|-------------------------------------------------------------------|
| Orchestration              | Customer/Supplier: looks up Benchmark + tasks.                    |
| Evaluation                 | Customer/Supplier: validates `benchmarkId` at submission time.    |
| Reporting & Analytics      | Read-only: groups Leaderboard by Benchmark.                       |
| External Benchmark Specs   | Conformist (read-only ingest).                                    |

## Open Questions / Future Work

- Importer pipelines per benchmark (today seed-data only); these would
  schedule periodic ingest of upstream updates.
- Versioned diff view between Benchmark versions for auditors.
