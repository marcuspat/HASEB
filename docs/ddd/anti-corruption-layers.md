# Anti-Corruption Layers

An **Anti-Corruption Layer (ACL)** is a translation barrier between HASEB's
domain model and an external system whose model we cannot change. The ACL
makes sure foreign vocabulary, error shapes, and lifecycle assumptions
never leak into the core.

This document catalogues HASEB's ACLs. Adding a new external dependency
**MUST** add an ACL in the same PR.

## Catalogue

### 1. SWE-bench harness ACL

**Location:** `src/agents/SWE_Bench_Agent.ts`.

**Foreign model:** SWE-bench task instances, repo states, patch diffs,
test invocation transcripts.

**Translation responsibilities:**
- SWE-bench task → HASEB `BenchmarkTask`.
- Patch diff transcript → ordered `EvaluationStep[]` with `kind='tool_call'`
  and `kind='llm_call'`.
- Test invocation result → `RunOutcome`.
- Tokens consumed by the upstream test harness → `TokenCount`.

**What does NOT cross the boundary:**
- SWE-bench Python types, file paths, or local-cache details.
- Upstream JSON exit shapes — converted to typed `RunOutcome` and typed
  errors.

### 2. OSWorld / WebArena ACL

**Location:** `src/agents/GUI_Automation_Agent.ts`.

**Foreign model:** Browser/desktop automation transcripts, screenshots,
DOM snapshots, click streams.

**Translation responsibilities:**
- Each click / type / wait → `EvaluationStep` with `kind='screen_action'`.
- Screenshot artefacts are stored separately and referenced by ID; the
  domain step carries only `screenshotRef: string`, not raw bytes.
- Browser failure modes (timeout, navigation error) → typed
  `RunOutcome.failure` reasons.

**What does NOT cross:**
- Selenium/Playwright driver types.
- Raw screenshot bytes (kept out of the domain to keep aggregates small).

### 3. GAIA / AgentBench ACL

**Location:** `src/agents/General_Reasoning_Agent.ts`.

**Foreign model:** Question-answering tasks, reasoning traces, structured
final answers.

**Translation responsibilities:**
- Tool-call traces → `EvaluationStep` with `kind='tool_call'`.
- LLM completion logs → `EvaluationStep` with `kind='llm_call'`.
- Final answer comparison against the upstream oracle → `RunOutcome` and a
  `QualityMetric` contribution.

### 4. LLM provider ACL (Cost)

**Location:** `src/services/metrics/CostMetricsCollector.ts` (planned
extraction into a dedicated price-list adapter).

**Foreign model:** Provider price lists (Anthropic, OpenAI, etc.) with
their own per-model SKUs and tier rules.

**Translation responsibilities:**
- Provider model name → HASEB internal model identifier.
- Per-tier price → `Money` per `TokenCount` unit.
- Currency conversion (if needed) is handled before entering the domain.

**What does NOT cross:**
- Provider SDK types or HTTP clients.
- Promotional/discount rules — the ACL flattens them into a single
  effective price for the run.

### 5. Upstream Benchmark Specs ACL (Conformist)

**Location:** `src/database/seed-data.ts` and importer scripts.

**Foreign model:** Benchmark specifications maintained upstream (e.g.
SWE-bench's task manifest).

**Translation responsibilities:**
- Upstream task manifest → `Benchmark` aggregate + `BenchmarkTask[]`.
- Upstream version string → HASEB `Benchmark.version`.

**Note:** This is a Conformist relationship (see the Context Map). HASEB
adapts to the upstream shape. The ACL is one-way (read-only).

### 6. WebSocket transport ACL (outbound)

**Location:** `src/orchestrator/WebSocketManager.ts`.

**Foreign model:** `socket.io` `Socket`, `Namespace`, packet objects.

**Translation responsibilities:**
- Domain events → wire envelope (see [domain-events.md](./domain-events.md)).
- Subscription requests from clients → typed topic specifications.

**What does NOT cross:**
- `Socket` instances do not enter the domain layer; the orchestrator emits
  events to a publisher port and the WebSocket adapter implements that port.

### 7. HTTP framework ACL

**Location:** `src/api/*.ts`.

**Foreign model:** Express `Request`, `Response`, `NextFunction`.

**Translation responsibilities:**
- Translate `req.body`, `req.params`, `req.query` into typed DTOs.
- Translate domain errors to HTTP status codes and JSON bodies.
- The application service signatures contain **no** Express types.

### 8. Persistence ACL

**Location:** repositories under `src/database/models/`.

**Foreign model:** `pg.Client`, `sqlite3.Database`, SQL strings.

**Translation responsibilities:**
- Map snake_case columns to camelCase domain fields.
- Map JSONB `metrics` column to typed `MetricDimension[]`.
- Wrap driver errors as `RepositoryError`.

## Rules

1. **No PR adds a new external dependency without an ACL** in the same
   change.
2. **No domain code imports from the foreign system.** A static check
   enforces this for the orchestrator and metrics packages.
3. **The ACL surface is documented in this file** when added.
4. **Tests at the ACL boundary** use the real foreign system on
   integration runs and mocks on unit runs.
