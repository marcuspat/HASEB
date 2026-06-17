# ADR-008: Docker container isolation for benchmark task execution

- Status: Accepted
- Date: 2026-06-16
- Deciders: HASEB core

## Context

Each SWE-bench task clones a real repository, checks out a base commit, applies
an agent-produced patch, and runs that repo's test suite. Running these in a
shared process or host is unsafe and unreliable: tasks install conflicting
dependencies, mutate the filesystem, can run arbitrary code from the model's
patch, and leak state into one another.

## Decision

Execute **each benchmark task inside its own ephemeral Docker container**.

The per-task lifecycle is:

1. Start a container from a task-appropriate base image.
2. Clone the repo and check out `base_commit`.
3. Apply the agent's patch (reject if it does not apply cleanly).
4. Run the `FAIL_TO_PASS` (and `PASS_TO_PASS`) test commands with a hard
   timeout.
5. Capture stdout/stderr, pass/fail counts, and exit.
6. Destroy the container.

This is expressed in the domain via the `BenchmarkHarness.executeTask(task,
agentPatch, timeoutMs)` interface, which returns a `TaskExecutionResult`.

## Consequences

- **No cross-task contamination** — every task gets a clean filesystem and
  dependency set.
- **Containment** — untrusted model patches run with no host access, constrained
  CPU/memory, and an enforced timeout (mapped to the `timeout` job status).
- Requires a Docker-capable runtime on workers; the deployment target (ADR-012,
  Fly.io) is Docker-native.
- The MVP runs containers sequentially on a single worker (see ADR-009);
  horizontal parallelism is a later scaling concern.
- The harness is an interface, so a non-Docker implementation (e.g. a local
  stub for tests, or a remote sandbox provider) can be substituted.
