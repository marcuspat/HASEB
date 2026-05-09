# Ubiquitous Language

This glossary is **authoritative**. Class names, table names, event names, API
shapes, and dashboard labels must use these terms. Synonyms drift the model;
prefer this document to alternatives, even where alternatives feel natural.

## Core Concepts

### Agent
A software system being evaluated. Identified by a UUID. Carries metadata
about its provider, model, and configuration. *Not* the same as a
Claude-Flow agent that builds HASEB itself.

- Synonym to avoid: "model", "system", "candidate". Use **Agent**.
- Source: `src/database/models/Agent.ts`, `src/agents/`.

### Benchmark
A published task suite with an environment, a corpus, and an oracle.
Examples: SWE-bench, GAIA, OSWorld, AgentBench.

- Synonyms to avoid: "test set", "dataset", "challenge".

### Benchmark Task
A single problem instance inside a Benchmark. A Benchmark contains many tasks;
an Evaluation may run a subset.

### Evaluation
The central aggregate. One run of one Agent against one Benchmark. Has a
lifecycle (`queued`, `running`, `collecting`, `analyzing`, `completed`,
`failed`, `cancelled`). Holds the run record and the produced metrics.

- Synonym to avoid: "experiment", "test run". Use **Evaluation**.

### Evaluation Run
The durable trace produced by executing an Agent against a Benchmark. The Run
is owned by an Evaluation and is the source of truth for metrics.

### Evaluation Step
A single observed interaction within a Run: a tool call, an LLM completion,
a screen action, etc. Steps are ordered and timestamped.

### Metric
A measured quantity derived from an Evaluation Run. Always typed by its
**Metric Dimension** (Performance, Efficiency, Cost, Robustness, Quality).

### Metric Dimension
One of:

| Dimension    | Examples                                                         |
|--------------|------------------------------------------------------------------|
| Performance  | Task success rate, partial credit                                |
| Efficiency   | Execution time, latency-per-step, number of steps                |
| Cost         | Total LLM tokens, USD spent                                      |
| Robustness   | Tool-call error rate, recovery rate                              |
| Quality      | Tool-selection accuracy, parameter accuracy                      |

### Process Viability Score
The composite score computed from the five Metric Dimensions, normalised per
Benchmark. The headline number on the Leaderboard.

### Orchestrator
The LangGraph-driven workflow engine that moves Evaluations through their
lifecycle. Lives in the Orchestration bounded context.

### Execution Agent
A HASEB-internal subclass of `BaseExecutionAgent` that knows how to drive a
specific class of Benchmark (code, GUI, reasoning). Distinct from the
Agent under evaluation.

### Environment
The runtime container or sandbox in which an Execution Agent drives the Agent
under evaluation against a Benchmark Task. Examples: Docker container,
Selenium-controlled browser, headless simulator.

### Leaderboard
A read model: ranked Agents per Benchmark, per Metric Dimension, per time
window. Derived from completed Evaluations.

### Truth Score
A 0.0–1.0 confidence that a HASEB-internal action (a code change, a metric
report) is correct. Verified by a Byzantine-fault-tolerant quorum. Threshold:
0.95 (see ADR 0022).

## Domain Verbs

Use these verbs in code, commit messages, and documentation:

- **Submit** an Evaluation (creates it in `queued` state).
- **Schedule** an Evaluation (queue → running).
- **Execute** an Evaluation (drives the Run).
- **Collect** Metrics (post-Run).
- **Analyse** an Evaluation (Metric → Process Viability Score).
- **Complete** / **Fail** an Evaluation.
- **Replay** an Evaluation Run.
- **Verify** an action against the Truth Score.

## Identifiers and Time

- All entity IDs are UUID v4 strings.
- All timestamps are ISO 8601 with explicit timezone (UTC at rest).
- Money amounts use `Money { amount: number; currency: 'USD' }`; never bare
  floats labelled "USD".

## Anti-Patterns / Words We Don't Use

| Avoid                | Use instead                                  |
|----------------------|----------------------------------------------|
| "test", "test run"   | Evaluation                                   |
| "model"              | Agent                                        |
| "score"              | Metric, Process Viability Score, Truth Score |
| "result"             | Evaluation outcome, Metric                   |
| "job"                | Evaluation (in queue / running)              |
| "experiment"         | Evaluation                                   |
| "trace" (alone)      | Evaluation Run, Evaluation Step              |

## Glossary by Bounded Context

| Concept                     | Owning context                |
|-----------------------------|-------------------------------|
| Agent, Agent Profile        | Agent Management              |
| Benchmark, Benchmark Task   | Benchmark Catalog             |
| Evaluation, Run, Step       | Evaluation                    |
| Orchestrator, Graph, Node   | Orchestration                 |
| Metric, Metric Dimension    | Metrics                       |
| Process Viability Score     | Reporting & Analytics         |
| Leaderboard, Trend          | Reporting & Analytics         |
| User, Role, Token           | Identity & Access             |
| WebSocket Channel, Topic    | Notifications & Real-time     |
