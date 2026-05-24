# HASEB Use Case Guide

## What Is HASEB?

HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) is a platform for systematically evaluating AI agents. You point it at an agent you've built, tell it which benchmark to run, and it records not just whether the agent succeeded — but *how* it got there: how many steps, how much it cost, how often it recovered from errors, how accurately it chose tools.

The result is a persistent, queryable record of your agent's behavior that you can compare across models, prompts, and benchmarks over time.

---

## Who Is This For?

| Role | HASEB helps you… |
|------|-----------------|
| **AI researcher** | Compare frontier models on standardized tasks with consistent measurement methodology |
| **ML engineer** | Benchmark prompt-engineered agents before and after changes to confirm improvements |
| **Team / lab** | Maintain a leaderboard of all agents under evaluation; track regression over time |
| **Product team evaluating vendors** | Run identical tasks across vendors and compare on cost efficiency and robustness, not just accuracy |

---

## Core Concepts

**Agent** — A record representing an AI system under evaluation. An agent has a type (`general`, `swe`, `gui`, `orchestrator`), a version, and arbitrary configuration (model name, temperature, tool list, etc.). HASEB does not call the AI model itself — it records the results that your evaluation harness reports back.

**Benchmark** — A task set definition. Supported types: `swe-bench`, `gaia`, `osworld`, `webarena`, `agentbench`, `custom`. A benchmark record links to a dataset and defines evaluation criteria.

**Evaluation** — A run record linking one agent to one benchmark. An evaluation starts in `pending` status and transitions through `running` → `completed` or `failed`. Metrics are attached as the evaluation progresses.

**Metrics** — Captured across five dimensions every evaluation:
- **Performance**: task success rate, completion time
- **Efficiency**: steps taken, latency per step, tokens used
- **Cost**: USD equivalent of API calls, cost per task
- **Robustness**: tool call error rate, recovery rate
- **Quality**: tool selection accuracy, parameter accuracy, output relevance

---

## Use Case 1: Benchmark a New Model Release

**Goal**: You've built a general-purpose agent on GPT-4o and want to know how it compares to your Claude 3.5 Sonnet agent on GAIA.

### Step 1 — Register and log in

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@lab.ai","username":"you","password":"Secr3t!","fullName":"Your Name"}'

TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@lab.ai","password":"Secr3t!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
```

### Step 2 — Register your agents

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPT-4o v1",
    "type": "general",
    "version": "1.0.0",
    "configuration": {"model": "gpt-4o", "temperature": 0.0, "tools": ["web_search", "code_exec"]}
  }'

curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Claude 3.5 Sonnet v1",
    "type": "general",
    "version": "1.0.0",
    "configuration": {"model": "claude-3-5-sonnet", "temperature": 0.0, "tools": ["web_search", "code_exec"]}
  }'
```

### Step 3 — Register the benchmark

```bash
curl -X POST http://localhost:3000/api/benchmarks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GAIA Level-1 2024",
    "type": "gaia",
    "dataset": "gaia-2024-level1",
    "version": "2024.1",
    "configuration": {"taskCount": 165}
  }'
```

### Step 4 — Create evaluations

Create one evaluation per (agent, benchmark) pair. Your external harness runs the tasks and reports results back via PATCH.

```bash
# Create evaluation for GPT-4o
EVAL_A=$(curl -s -X POST http://localhost:3000/api/evaluations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "<gpt4o-id>", "benchmarkId": "<gaia-id>", "configuration": {}}')

# Create evaluation for Claude
EVAL_B=$(curl -s -X POST http://localhost:3000/api/evaluations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "<claude-id>", "benchmarkId": "<gaia-id>", "configuration": {}}')
```

### Step 5 — Report results

After your evaluation harness finishes, write the metrics back:

```bash
curl -X PUT http://localhost:3000/api/evaluations/<eval-id>/metrics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "performance": {"taskSuccessRate": 0.78, "completionTime": 14400},
      "efficiency": {"totalSteps": 830, "latencyPerStep": 17.3, "totalTokens": 2100000},
      "cost": {"estimatedCost": 4.20, "costPerTask": 0.026},
      "robustness": {"toolCallErrorRate": 0.09, "recoveryRate": 0.82},
      "quality": {"toolSelectionAccuracy": 0.88, "parameterAccuracy": 0.91}
    }
  }'
```

### Step 6 — Compare on the leaderboard

```bash
curl http://localhost:3000/api/metrics/leaderboard -H "Authorization: Bearer $TOKEN"
```

The leaderboard ranks agents by overall score, with per-agent breakdown of success rate, average cost, and trend over time.

---

## Use Case 2: Track Agent Quality Over Multiple Prompt Iterations

**Goal**: You're iterating on system prompt for your SWE-bench agent and want to confirm each change improves resolution rate without blowing up cost.

### Workflow

1. Register the benchmark once (`type: "swe-bench"`, `dataset: "swe-bench-verified"`).
2. For each prompt version, register a new agent with a version increment:
   ```bash
   {"name": "SWE Agent", "type": "swe", "version": "0.3.0", "configuration": {"promptVersion": "v3", ...}}
   ```
3. Run evaluations and report results.
4. Query per-agent metrics:
   ```bash
   curl http://localhost:3000/api/metrics/agent/<agent-id> -H "Authorization: Bearer $TOKEN"
   ```
5. Aggregate across versions to spot regression:
   ```bash
   curl -X POST http://localhost:3000/api/metrics/aggregate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"agentIds": ["<v1-id>", "<v2-id>", "<v3-id>"], "benchmarkIds": ["<swe-id>"]}'
   ```

The aggregate endpoint returns a merged view of metrics across all specified agents and benchmarks, making it straightforward to see trends across versions.

---

## Use Case 3: Real-Time Monitoring During a Long Evaluation

**Goal**: Your GUI automation evaluation runs for several hours. You want live progress updates.

### WebSocket Subscription

Connect before starting the evaluation:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'evaluations',
    evaluationId: '<eval-uuid>'
  }));
};

ws.onmessage = ({ data }) => {
  const { type, payload } = JSON.parse(data);
  switch (type) {
    case 'evaluation_progress':
      console.log(`Progress: ${payload.completedTasks}/${payload.totalTasks}`);
      break;
    case 'metrics_update':
      console.log('Running metrics:', payload);
      break;
    case 'evaluation_complete':
      console.log('Done. Final metrics:', payload.metrics);
      ws.close();
      break;
  }
};
```

Your evaluation harness sends PATCH requests to update status and metrics as it goes; HASEB fans those updates out over WebSocket to all subscribers.

---

## Use Case 4: Cost vs. Accuracy Analysis Across Benchmarks

**Goal**: Leadership wants to know which model gives the best accuracy per dollar across three benchmark types.

### Approach

1. Register three benchmark types: GAIA, SWE-bench, WebArena.
2. Run your top 3–5 candidate models against each.
3. Export raw data for analysis:
   ```bash
   curl -X POST http://localhost:3000/api/metrics/export \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"format": "json", "agentIds": ["<id1>","<id2>","<id3>"], "benchmarkIds": ["<gaia>","<swe>","<webarena>"]}'
   ```
4. The export payload contains per-evaluation metrics rows with all five dimensions, suitable for direct analysis in pandas or a BI tool.

The `cost.estimatedCost` and `performance.taskSuccessRate` fields let you compute accuracy-per-dollar in one step.

---

## Use Case 5: Team Leaderboard with Admin Governance

**Goal**: A team of researchers all submit evaluations; only project leads can delete bad runs.

### Setup

1. Leads register with an admin-role user (set via DB or seed script).
2. Researchers register as standard users.
3. All users can create agents, benchmarks, and evaluations.
4. Only admin tokens can `DELETE /api/agents/:id`, `DELETE /api/benchmarks/:id`, or `DELETE /api/evaluations/:id`. Non-admin attempts return HTTP 403.

This prevents researchers from accidentally removing shared benchmark definitions or completed evaluation records.

---

## Reference: Valid Field Values

### Agent types
`general` | `swe` | `gui` | `orchestrator`

### Benchmark types
`swe-bench` | `gaia` | `osworld` | `webarena` | `agentbench` | `custom`

### Evaluation statuses
`pending` → `running` → `completed` | `failed`

### Metrics dimensions (all fields optional, store what you have)

```json
{
  "performance": {
    "taskSuccessRate": 0.0,
    "completionTime": 0,
    "firstSuccessTime": 0
  },
  "efficiency": {
    "totalSteps": 0,
    "latencyPerStep": 0.0,
    "totalTokens": 0,
    "tokenEfficiency": 0.0
  },
  "cost": {
    "estimatedCost": 0.0,
    "costPerTask": 0.0,
    "resourceUtilization": 0.0
  },
  "robustness": {
    "toolCallErrorRate": 0.0,
    "recoveryRate": 0.0,
    "errorTypes": []
  },
  "quality": {
    "toolSelectionAccuracy": 0.0,
    "parameterAccuracy": 0.0,
    "outputRelevance": 0.0,
    "outputCompleteness": 0.0
  }
}
```

---

## What HASEB Does Not Do

Understanding the scope avoids surprises:

- **It does not run your agent.** HASEB is a record-keeping and metrics platform. Your evaluation harness (the code that actually calls GPT-4o, applies patches, runs GUI automation, etc.) runs separately and reports results to HASEB via API.
- **It does not ship benchmark datasets.** You supply dataset identifiers and configuration. The actual task data (SWE-bench instances, GAIA questions, OSWorld environments) is managed by your harness.
- **It does not provide Docker images.** No Dockerfile is included. Deploy it on any machine with Node.js 18+ and PostgreSQL 15+.

---

## Quick Reference

```bash
# All API calls need this header (except register, login, health):
-H "Authorization: Bearer $TOKEN"

# Public endpoints
GET  /health
GET  /api-docs          # Swagger UI
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh

# Auth-protected
GET  /api/auth/profile
POST /api/agents
GET  /api/agents
GET  /api/agents/:id
PUT  /api/agents/:id
POST /api/benchmarks
GET  /api/benchmarks
GET  /api/benchmarks/:id
POST /api/evaluations
GET  /api/evaluations
GET  /api/evaluations/:id
PATCH /api/evaluations/:id/status
PUT   /api/evaluations/:id/metrics
GET  /api/metrics/dashboard
GET  /api/metrics/leaderboard
GET  /api/metrics/evaluation/:id
GET  /api/metrics/agent/:id
GET  /api/metrics/benchmark/:id
POST /api/metrics/aggregate
POST /api/metrics/export

# Admin only
DELETE /api/agents/:id
DELETE /api/benchmarks/:id
DELETE /api/evaluations/:id
```
