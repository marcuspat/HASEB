# Agent Management Context

**Type:** Core subdomain.
**Position:** the boundary between HASEB's domain and the Agents under
evaluation, plus the home of the **Execution Agents** that drive different
benchmark kinds.

## Purpose

Two responsibilities sit in this context:

1. **Manage the Agents under evaluation.** Register them, version their
   configuration, expose them to the Orchestrator by ID.
2. **Provide Execution Agents** — internal subclasses of
   `BaseExecutionAgent` — that wrap the external benchmark harnesses
   (SWE-bench, OSWorld, GAIA) behind an Anti-Corruption Layer.

## Ubiquitous Language (local)

- **Agent** — a system under evaluation. Distinct from a Claude-Flow agent
  building HASEB.
- **Agent Profile** — the active configuration of an Agent (provider,
  model, system prompt, tools, parameters).
- **Agent Version** — an immutable snapshot of the Profile. Each profile
  edit produces a new Version.
- **Fingerprint** — the deterministic hash of the active Profile; identifies
  a comparable Agent configuration.
- **Execution Agent** — an internal HASEB component that runs an external
  Agent against a Benchmark of a particular kind.

## Aggregates

### Agent (root)

Members:
- `AgentProfile` (1-to-1, current)
- `AgentVersion[]` (immutable history)

See [../aggregates.md](../aggregates.md#2-agent-aggregate-core).

## Execution Agents

`BaseExecutionAgent` (abstract) defines the lifecycle:

```
abstract class BaseExecutionAgent {
  setup(env: Environment): Promise<void>;
  run(task: BenchmarkTask): AsyncIterable<EvaluationStep>;
  observe(): RunObservations;
  teardown(): Promise<void>;
}
```

Concrete subclasses:

| Class                         | Wraps                       | Source                                  |
|-------------------------------|-----------------------------|-----------------------------------------|
| `SWE_Bench_Agent`             | SWE-bench harness           | `src/agents/SWE_Bench_Agent.ts`         |
| `GUI_Automation_Agent`        | OSWorld / WebArena          | `src/agents/GUI_Automation_Agent.ts`    |
| `General_Reasoning_Agent`     | GAIA / AgentBench           | `src/agents/General_Reasoning_Agent.ts` |

Each subclass owns its [Anti-Corruption Layer](../anti-corruption-layers.md).

## Use Cases

| Use case                  | Application service          | HTTP route                          |
|---------------------------|------------------------------|-------------------------------------|
| Register an Agent         | `RegisterAgent`              | `POST /api/v1/agents`               |
| Update an Agent's Profile | `UpdateAgentProfile`         | `PATCH /api/v1/agents/{id}`         |
| Archive an Agent          | `ArchiveAgent`               | `DELETE /api/v1/agents/{id}`        |
| List Agents               | `ListAgents` (query)         | `GET /api/v1/agents`                |
| Get an Agent              | `GetAgent` (query)           | `GET /api/v1/agents/{id}`           |
| Resolve Execution Agent   | `ResolveExecutionAgent` (internal) | called by Orchestrator        |

## Repositories

- `IAgentRepository` (see [../repositories.md](../repositories.md)).

## Domain Services

- `AgentFingerprinter` — deterministic fingerprint of the Agent Profile.

## Domain Events

- `agent.registered`
- `agent.profile.updated`
- `agent.archived`

## Persistence Mapping

- Tables: `agents`, `agent_versions`.
- Indexes: `agents(fingerprint)` for fast comparable-agent lookup.

## Boundaries

| Other context              | Interaction                                                       |
|----------------------------|-------------------------------------------------------------------|
| Orchestration              | Customer/Supplier: orchestrator resolves Execution Agent here.    |
| Evaluation                 | Customer/Supplier: Evaluation references `agentId`.               |
| External harnesses         | ACL: Execution Agents wrap them.                                  |
| Reporting & Analytics      | Read-only: leaderboards group by Agent.                           |
| Identity & Access          | Generic: every Agent action is attributed to a User.              |

## Versioning Semantics

- An Evaluation references an Agent by `agentId` *and* records the active
  `agentVersionId` at submission time. Re-running the Evaluation produces
  the same answer only if the Agent Version is unchanged.
- Leaderboards include the Version's fingerprint to allow apples-to-apples
  comparisons.

## Open Questions / Future Work

- Add an Execution Agent for streaming / interactive benchmarks if the
  catalogue grows in that direction.
- Allow Agent Profiles to import secrets from a vault rather than storing
  them inline; today, secrets are not part of the Profile and are passed
  in via environment variables at run time.
