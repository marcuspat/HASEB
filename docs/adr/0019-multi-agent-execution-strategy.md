# ADR 0019: Adopt a multi-agent execution strategy

- **Status:** Accepted
- **Date:** 2026-05-09
- **Deciders:** HASEB core team
- **Tags:** agents, orchestration

## Context and Problem Statement

HASEB evaluates agents across heterogeneous environments: code-generation
benchmarks (SWE-bench), GUI environments (OSWorld, WebArena), and
general-reasoning suites (GAIA, AgentBench). A single executor cannot
faithfully model these execution profiles.

How should HASEB structure its execution agents?

## Decision Drivers

- Clean separation between benchmark protocol and the orchestrator core.
- Pluggability: new benchmarks should not require changes to existing
  agents.
- Consistent metrics emission regardless of agent type.
- Compatibility with multi-agent verification (ADR 0022).

## Considered Options

1. **Per-environment agents** with a shared `BaseExecutionAgent`.
2. **Single configurable executor with strategy objects.**
3. **External processes per benchmark (one binary per harness).**

## Decision Outcome

**Chosen option: Per-environment execution agents over a shared base.**
The base class enforces the standard lifecycle (setup, run, observe,
teardown) and metrics emission, while each subclass owns the protocol
quirks of its environment.

### Positive Consequences

- New benchmarks added by extending the base class.
- Each agent is independently testable with the harness mocked.
- Metrics emission is uniform across agents.

### Negative Consequences

- Some duplication where two agents share quirks; mitigated by extracting
  shared utilities into `src/agents/` helpers as patterns appear.

## Implementation Notes

- Base class: `src/agents/BaseExecutionAgent.ts`.
- Initial concrete agents:
  - `SWE_Bench_Agent.ts` — code-generation evaluation.
  - `GUI_Automation_Agent.ts` — OSWorld / WebArena.
  - `General_Reasoning_Agent.ts` — GAIA / AgentBench.
- Anti-corruption layer: each agent translates external harness data into
  the HASEB domain model.

## Validation

- Adding a new agent requires changes only to `src/agents/` and a new
  benchmark configuration; the orchestrator stays untouched.
- Agent unit tests cover the base lifecycle and protocol-specific edge
  cases.

## Links

- ADR 0018 — Use LangGraph for evaluation orchestration
- ADR 0020 — Multi-dimensional metrics collection
- DDD: [`../ddd/contexts/agent-context.md`](../ddd/contexts/agent-context.md)
