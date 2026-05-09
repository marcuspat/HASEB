# Subdomains

HASEB's domain is partitioned into subdomains by **strategic value**. Core
subdomains are the reason HASEB exists; supporting subdomains are
non-trivial but not differentiating; generic subdomains are commodity.

This classification drives investment. We build core subdomains in-house with
the most care; we buy or adopt mature solutions for generic ones.

## Core Subdomains

These are HASEB's reason for being. Investment is highest here; the design,
tests, and verification budgets all bias toward these.

### 1. Evaluation
The lifecycle of a single Agent run against a Benchmark, from submission to
completed Run + Metrics. **The aggregate root of the entire system.**

- Owns the Evaluation aggregate, the Run, and the Steps.
- Owns the lifecycle state machine.
- Bounded context: [Evaluation](./contexts/evaluation-context.md).

### 2. Orchestration
The LangGraph-driven workflow that drives Evaluations end-to-end. Owns
environment lifecycle, retries, queueing, and event publication.

- Bounded context: [Orchestration](./contexts/orchestration-context.md).

### 3. Metrics
The translation from a raw Evaluation Run into the five Metric Dimensions and
the Process Viability Score. Each dimension has a dedicated collector.

- Bounded context: [Metrics](./contexts/metrics-context.md).

### 4. Agent Management
The abstraction over agents under evaluation: registration, configuration,
versioning, and authoring of Execution Agents.

- Bounded context: [Agent Management](./contexts/agent-context.md).

## Supporting Subdomains

These are necessary but not where HASEB earns its keep.

### 5. Benchmark Catalog
Curation of the benchmark library: SWE-bench, GAIA, OSWorld, AgentBench.
Includes versioning of benchmark definitions and oracle code.

- Bounded context: [Benchmark Catalog](./contexts/benchmark-context.md).
- Depends on the upstream benchmark projects (Conformist relationship — see
  [Context Map](./context-map.md)).

### 6. Reporting & Analytics
The leaderboards, trend charts, and analytics that turn the metrics into
human insight.

- Bounded context: [Reporting & Analytics](./contexts/reporting-context.md).

### 7. Notifications & Real-time
The WebSocket channel and downstream notifications that keep the dashboard
live during a run.

- Bounded context: [Notifications & Real-time](./contexts/notifications-context.md).

## Generic Subdomains

These are commodity. We use the smallest amount of in-house code possible.

### 8. Identity & Access
Users, sessions, roles, and JWT issuance. We use stock libraries (`jsonwebtoken`,
`bcryptjs`) and a thin domain layer.

- Bounded context: [Identity & Access](./contexts/identity-access-context.md).

### 9. Logging, Monitoring, and CI/CD
Cross-cutting and not modelled as a domain. Implemented via Winston, Morgan,
GitHub Actions, and standard observability tooling.

## Investment Summary

| Subdomain               | Type        | Investment | Strategy                          |
|-------------------------|-------------|------------|-----------------------------------|
| Evaluation              | Core        | Highest    | Build + verify rigorously         |
| Orchestration           | Core        | Highest    | Build (LangGraph + custom)        |
| Metrics                 | Core        | Highest    | Build (one collector per dim.)    |
| Agent Management        | Core        | High       | Build                             |
| Benchmark Catalog       | Supporting  | Medium     | Build + Conformist to upstream    |
| Reporting & Analytics   | Supporting  | Medium     | Build                             |
| Notifications           | Supporting  | Low        | Adopt `socket.io`                 |
| Identity & Access       | Generic     | Low        | Adopt JWT + bcrypt                |
| Logging / Monitoring    | Generic     | Lowest     | Adopt Winston / GH Actions        |
