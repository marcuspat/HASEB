# Context Map

The context map describes how HASEB's bounded contexts relate. Each
relationship has a **direction**, a **pattern**, and an explicit translation
mechanism.

## Patterns Used

| Pattern                           | Meaning                                                                       |
|-----------------------------------|-------------------------------------------------------------------------------|
| **Customer / Supplier (C/S)**     | Downstream context (customer) influences the upstream's roadmap.              |
| **Conformist**                    | Downstream conforms to an upstream model it cannot influence.                 |
| **Anti-Corruption Layer (ACL)**   | Downstream wraps the upstream so its model cannot leak in.                    |
| **Open Host Service (OHS)**       | Upstream publishes a stable, public protocol for many consumers.              |
| **Published Language (PL)**       | A shared, agreed-upon schema (e.g. domain-event payloads).                    |
| **Shared Kernel (SK)**            | Two contexts share a small, jointly-governed model.                           |
| **Partnership**                   | Two contexts evolve together, coordinating releases.                          |

## High-Level Map

```
                +-------------------+
                |  Identity &       |
                |  Access (Generic) |
                +-------------------+
                          |
                          | (auth required by all contexts)
                          v
+---------------+    +-------------------+    +--------------------+
|  Benchmark    |--->|   Orchestration   |--->|     Evaluation     |
|  Catalog      | C  |      (Core)       |  P |       (Core)       |
| (Supporting)  | F  |                   |    |                    |
+-------+-------+    +---------+---------+    +---------+----------+
        ^                      |                        |
        |                      | events (PL)            | events (PL)
        |                      v                        v
+-------+-------+    +-------------------+    +--------------------+
|  External     |    |   Notifications   |    |     Metrics        |
|  Benchmarks   |    |    & Real-time    |    |      (Core)        |
|  (SWE-bench,  |    |    (Supporting)   |    |                    |
|   GAIA, etc.) |    +---------+---------+    +---------+----------+
+---------------+              |                        |
        ^                      | WebSocket (OHS)        | events (PL)
        | ACL                  v                        v
+-------+--------+    +-------------------+    +--------------------+
|  Agent         |    |     Dashboard     |<---|  Reporting &       |
|  Management    |    |   (UI consumer)   |    |  Analytics        |
|    (Core)      |    +-------------------+    |   (Supporting)     |
+----------------+                             +--------------------+

Legend:  C/S = Customer/Supplier   CF = Conformist
         P  = Partnership          PL = Published Language
         OHS = Open Host Service   ACL = Anti-Corruption Layer
```

## Relationships in Detail

### Orchestration ↔ Evaluation
- **Pattern:** Partnership. They evolve together; the lifecycle owned by
  Evaluation is driven by Orchestration nodes.
- **Mechanism:** Application service `EvaluationOrchestrator.run(...)` and
  domain events (`evaluation.*`).

### Orchestration → Benchmark Catalog
- **Pattern:** Customer/Supplier. Orchestration is the customer; it asks
  the catalog for benchmark definitions and tasks.
- **Mechanism:** `BenchmarkRepository.findById(...)`, no cross-context
  aggregate references.

### Orchestration → Agent Management
- **Pattern:** Customer/Supplier.
- **Mechanism:** Orchestration resolves an `Agent` by ID and delegates
  execution to an Execution Agent. Execution Agents are part of Agent
  Management and hide the external harness behind an ACL.

### Agent Management → External Benchmark Harnesses
- **Pattern:** Anti-Corruption Layer.
- **Mechanism:** `SWE_Bench_Agent`, `GUI_Automation_Agent`,
  `General_Reasoning_Agent` translate between HASEB's domain and the
  external harness vocabulary. The Orchestration core never imports types
  from external harnesses.

### Benchmark Catalog → Upstream Benchmark Projects
- **Pattern:** Conformist (we accept the upstream task definitions).
- **Mechanism:** Importer scripts that ingest upstream specs into our
  catalog. We do not change upstream; we conform our catalog to it and
  version it.

### Evaluation → Metrics
- **Pattern:** Customer/Supplier with a Published Language.
- **Mechanism:** Evaluation publishes `evaluation.run.completed`; Metrics
  subscribes, runs its collectors, and persists Metric records linked to
  the Evaluation by ID.

### Metrics → Reporting & Analytics
- **Pattern:** Customer/Supplier (Reporting consumes).
- **Mechanism:** Reporting reads from materialised views / query services
  over the Metrics tables. No write-side coupling.

### Orchestration → Notifications & Real-time
- **Pattern:** Open Host Service via Published Language (event schemas).
- **Mechanism:** Orchestrator emits domain events; Notifications publishes
  them on `socket.io` channels. The protocol is stable and documented in
  [domain-events.md](./domain-events.md).

### All contexts → Identity & Access
- **Pattern:** Generic. Every context that exposes an HTTP route uses the
  shared JWT validation middleware. Authorization decisions happen in the
  application service of each context.

## Translation Boundaries

| Boundary                                    | Mechanism                              | Source                                   |
|---------------------------------------------|----------------------------------------|------------------------------------------|
| Domain → HTTP                               | Application services + DTOs            | `src/api/*.ts`                           |
| Domain → WebSocket                          | Domain events + envelope schema        | `src/orchestrator/WebSocketManager.ts`   |
| Domain → Persistence                        | Repository data mappers                | `src/database/models/*`                  |
| Agent Mgmt → External Harness               | Execution Agent ACL                    | `src/agents/*`                           |
| Catalog → Upstream Benchmark Spec           | Importer scripts (conformist)          | `src/database/seed-data.ts`              |
| Metrics ← Run                               | Per-dimension collectors               | `src/services/metrics/*`                 |
