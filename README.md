# HASEB: Holistic Agentic System Evaluator & Benchmarking Suite

<div align="center">

**A unified, open-source evaluation platform for holistically assessing agentic systems across diverse tasks with multi-dimensional "process viability" metrics.**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2+-blue)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)](https://www.postgresql.org/)

[Quick Start](#quick-start) • [Architecture](#architecture) • [API Reference](#api-reference) • [Testing](#testing) • [Configuration](#configuration)

</div>

## Overview

**HASEB** (Holistic Agentic System Evaluator & Benchmarking Suite) is a comprehensive evaluation platform for AI agents. It provides a REST API and React dashboard to register agents, define benchmarks, run evaluations, and compare results across five measurement dimensions: Performance, Efficiency, Cost, Robustness, and Quality.

The platform is designed for AI researchers and ML engineers who need a structured, reproducible way to measure and compare agentic system behavior — going beyond simple pass/fail rates to capture process-level metrics that reveal *how* an agent achieves its results.

### Key Features

- **Multi-Dimensional Metrics**: Performance, Efficiency, Cost, Robustness, and Quality collectors with a unified aggregation API
- **LangGraph Orchestration**: Stateful evaluation workflow management with typed state transitions
- **Real-Time Monitoring**: WebSocket-based live evaluation progress
- **React Dashboard**: Interactive visualization with real-time leaderboards and analytics
- **PostgreSQL Backend**: Scalable metrics storage with indexed JSONB queries
- **JWT Authentication**: Bearer-token auth required on all data endpoints; admin role required for destructive operations
- **Rate Limiting**: Strict per-IP limits on the login endpoint (5 requests / 15 min) to prevent brute force
- **Comprehensive Test Suite**: 36 unit suites (679 tests), 8 integration suites (138 tests), 2 security suites (44 tests), 3 performance suites (38 tests)

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 15.0
- **npm** >= 9.0.0

### Installation

```bash
# 1. Clone
git clone https://github.com/marcuspat/haseb.git
cd haseb

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set DB_PASSWORD and JWT_SECRET at minimum

# 4. Create and migrate the database
createdb haseb
npm run migrate

# 5. (Optional) seed sample data
npm run seed

# 6. Start backend
npm run dev:backend

# 7. Start frontend dev server (separate terminal)
npm run dev
```

**Verify the installation:**
```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","database":"connected"}

curl http://localhost:3000/api-docs
# Swagger UI HTML
```

### Minimum required `.env` settings

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=haseb
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-64-char-random-secret
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React 19)    │◄──►│   (Express)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • REST API      │    │ • Evaluations   │
│ • Leaderboards  │    │ • WebSocket     │    │ • Agents        │
│ • Analytics     │    │ • Auth/RBAC     │    │ • Benchmarks    │
│ • Settings      │    │ • Validation    │    │ • Metrics       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                   ┌────────────┴────────────┐
                   │      Orchestrator       │
                   │      (LangGraph)        │
                   │                         │
                   │ • Evaluation Workflows  │
                   │ • Metrics Collection    │
                   │ • Agent Coordination    │
                   └─────────────────────────┘
```

### Source Layout

```
src/
├── agents/                  # Execution agents
│   ├── BaseExecutionAgent.ts
│   ├── SWE_Bench_Agent.ts   # Code generation evaluation
│   ├── GUI_Automation_Agent.ts  # GUI / browser automation
│   └── General_Reasoning_Agent.ts
├── api/                     # Express route handlers
│   ├── agents.ts
│   ├── benchmarks.ts
│   ├── evaluations.ts
│   ├── metrics.ts
│   ├── auth.ts
│   └── orchestrator.ts
├── orchestrator/            # LangGraph workflow engine
│   ├── EvaluationOrchestrator.ts
│   ├── EnvironmentManager.ts
│   ├── MetricsCollector.ts
│   ├── WebSocketManager.ts
│   ├── ExecutionEngine.ts
│   └── EvaluationQueue.ts
├── database/                # PostgreSQL layer
│   ├── models/              # TypeScript models
│   ├── migrations.ts
│   ├── connection.ts
│   └── seed*.ts
├── middleware/              # Express middleware
│   ├── auth.ts              # JWT + RBAC
│   ├── validation.ts
│   └── errorHandler.ts
├── services/metrics/        # Five metric collectors
│   ├── PerformanceMetricsCollector.ts
│   ├── EfficiencyMetricsCollector.ts
│   ├── CostMetricsCollector.ts
│   ├── RobustnessMetricsCollector.ts
│   ├── QualityMetricsCollector.ts
│   └── MetricsOrchestrator.ts
├── domain/                  # Domain models (DDD)
├── components/              # React components
└── pages/                   # React pages
```

### Database Schema

```sql
users              -- Authentication and role management
agents             -- AI agent definitions and configurations
benchmarks         -- Benchmark definitions
evaluations        -- Evaluation runs (links agent + benchmark)
tasks              -- Individual task executions within an evaluation
evaluation_states  -- State snapshots for LangGraph workflow tracking
migrations         -- Applied migration tracking
```

### Metrics Dimensions

| Dimension | Key Metrics |
|-----------|-------------|
| **Performance** | Task success rate, completion time, first success time |
| **Efficiency** | Total steps, latency per step, token efficiency |
| **Cost** | Total tokens, estimated USD cost, cost per task |
| **Robustness** | Tool call error rate, recovery rate, error classification |
| **Quality** | Tool selection accuracy, parameter accuracy, output relevance |

---

## API Reference

All data endpoints require a `Bearer` token. Public endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /health`, `GET /`, and `GET /api-docs`.

`DELETE` endpoints for agents, benchmarks, and evaluations additionally require the `admin` role.

### Authentication

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","username":"you","password":"secret","fullName":"Your Name"}'

# Login — returns access + refresh tokens
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret"}'
# {"success":true,"data":{"user":{...},"tokens":{"accessToken":"eyJ...","refreshToken":"eyJ..."}}}

# Refresh access token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJ..."}'

# Get current user profile
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

### Agents

```bash
export TOKEN="eyJ..."

# List agents
curl http://localhost:3000/api/agents -H "Authorization: Bearer $TOKEN"

# Create an agent
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPT-4o Agent",
    "type": "language_model",
    "description": "OpenAI GPT-4o baseline",
    "version": "1.0.0",
    "configuration": {"model": "gpt-4o", "temperature": 0.0}
  }'

# Get agent by ID
curl http://localhost:3000/api/agents/<id> -H "Authorization: Bearer $TOKEN"

# Update agent
curl -X PUT http://localhost:3000/api/agents/<id> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"Updated description"}'

# Delete agent (admin role required)
curl -X DELETE http://localhost:3000/api/agents/<id> \
  -H "Authorization: Bearer $TOKEN"
```

### Benchmarks

```bash
# List benchmarks
curl http://localhost:3000/api/benchmarks -H "Authorization: Bearer $TOKEN"

# Create a benchmark
curl -X POST http://localhost:3000/api/benchmarks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SWE-bench Verified",
    "type": "code_generation",
    "description": "Real-world GitHub issue resolution",
    "version": "1.0.0",
    "configuration": {"taskCount": 500, "difficulty": "mixed"}
  }'
```

### Evaluations

```bash
# Start an evaluation
curl -X POST http://localhost:3000/api/evaluations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent-uuid>",
    "benchmarkId": "<benchmark-uuid>",
    "configuration": {"timeout": 3600}
  }'

# List evaluations
curl http://localhost:3000/api/evaluations -H "Authorization: Bearer $TOKEN"

# Get evaluation details
curl http://localhost:3000/api/evaluations/<id> -H "Authorization: Bearer $TOKEN"

# Update evaluation status
curl -X PATCH http://localhost:3000/api/evaluations/<id>/status \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"running"}'
```

### Metrics

```bash
# Dashboard summary
curl http://localhost:3000/api/metrics/dashboard -H "Authorization: Bearer $TOKEN"

# Leaderboard
curl http://localhost:3000/api/metrics/leaderboard -H "Authorization: Bearer $TOKEN"

# Metrics for a specific evaluation
curl http://localhost:3000/api/metrics/evaluation/<uuid> -H "Authorization: Bearer $TOKEN"

# Metrics for a specific agent
curl http://localhost:3000/api/metrics/agent/<uuid> -H "Authorization: Bearer $TOKEN"

# Aggregate metrics across evaluations
curl -X POST http://localhost:3000/api/metrics/aggregate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"agentIds":["<uuid>"],"benchmarkIds":["<uuid>"]}'

# Export metrics as CSV/JSON
curl -X POST http://localhost:3000/api/metrics/export \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"format":"json","evaluationIds":["<uuid>"]}'
```

### Orchestrator

```bash
# Initialize the evaluation orchestrator
curl -X POST http://localhost:3000/api/orchestrator/initialize \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"maxConcurrentEvaluations":5,"enableRealTimeUpdates":true}'

# Check orchestrator status (404 when idle)
curl http://localhost:3000/api/orchestrator/status -H "Authorization: Bearer $TOKEN"

# Trigger evaluation via orchestrator
curl -X POST http://localhost:3000/api/orchestrator/evaluate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"agentId":"<uuid>","benchmarkId":"<uuid>","configuration":{}}'
```

### WebSocket (Real-Time Updates)

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'evaluations',
    evaluationId: '<uuid>'
  }));
};

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  // type: "evaluation_progress" | "evaluation_complete" | "metrics_update"
  console.log(type, data);
};
```

---

## Testing

### Test Suites

| Suite | Command | Requires | Tests |
|-------|---------|----------|-------|
| Unit | `npm run test:unit` | Nothing | 679 |
| Integration | `npm run test:integration` | PostgreSQL | 138 |
| Security | `npm run test:security` | PostgreSQL | 44 |
| Performance | `npm run test:performance` | PostgreSQL | 38 |
| E2E | `npm run test:e2e` | Running server | Playwright |

```bash
# Fast local check — no database needed
npm run test:unit

# Full check — requires PostgreSQL running locally
npm run test:integration
npm run test:security
npm run test:performance

# Coverage report
npm run test:coverage
```

### Test Database Setup

Tests load configuration from `.env.test` (committed, no secrets). The `TestDatabase` helper applies migrations programmatically. Ensure the `haseb_test` database exists before running DB-backed tests:

```bash
createdb haseb_test
# Then run:
npm run test:integration
```

### Test Structure

```
tests/
├── unit/                  # Isolated unit tests — no I/O
│   ├── api/               # Route handler tests (mocked DB)
│   ├── domain/            # Domain model and state machine tests
│   ├── services/metrics/  # Individual metrics collector tests
│   ├── orchestrator/      # Orchestrator component tests
│   ├── database/          # Model unit tests
│   ├── middleware/        # Validation and logging tests
│   ├── hooks/             # React hook tests
│   └── utils/             # Utility function tests
├── integration/           # Real database + HTTP tests
├── performance/           # Load, benchmark, and stress tests
├── security/              # Auth, RBAC, and injection tests
├── agents/                # Agent execution tests
└── e2e/                   # Playwright browser tests (spec files present)
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in values.

### Required

```env
NODE_ENV=development          # development | production | test
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=haseb
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=change-this        # min 32 chars; fails to start if missing
```

### Optional

```env
# CORS — defaults to PORT origin
CORS_ORIGIN=http://localhost:3000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info                # error | warn | info | debug
LOG_FILE_PATH=logs

# External AI providers (for agent integrations)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Benchmark dataset paths (configure when datasets are present)
SWE_BENCH_DATA_PATH=./data/swe-bench
GAIA_DATA_PATH=./data/gaia
OSWORLD_DATA_PATH=./data/osworld
WEBARENA_DATA_PATH=./data/webarena

# Security
BCRYPT_ROUNDS=12

# Redis cache (optional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

### Database Setup

```bash
# Ubuntu/Debian
sudo apt install postgresql

# macOS
brew install postgresql && brew services start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE haseb;"
sudo -u postgres psql -c "CREATE USER haseb_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE haseb TO haseb_user;"

# Run migrations
npm run migrate
```

---

## Development

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev:backend` | Start backend with hot reload (tsx watch) |
| `npm run dev` | Start Vite frontend dev server |
| `npm run build:frontend` | Build React app to `dist/` |
| `npm run build` | Typecheck + build frontend |
| `npm run start` | Start production backend |
| `npm run migrate` | Apply database migrations |
| `npm run seed` | Seed sample data |
| `npm run seed:test` | Seed test data |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run test:unit` | Unit tests (alias: `npm test`) |
| `npm run test:integration` | Integration tests |
| `npm run test:security` | Security tests |
| `npm run test:performance` | Performance/load tests |
| `npm run test:coverage` | Full suite with coverage report |
| `npm run test:watch` | Unit tests in watch mode |

### Development Workflow

```bash
# 1. Start servers
npm run dev:backend   # Terminal 1
npm run dev           # Terminal 2

# 2. Make changes; run type checks and tests
npm run typecheck
npm run test:unit

# 3. Before committing
npm run lint
npm run test:integration   # requires Postgres
```

### Database Changes

1. Add migration to `src/database/migrations.ts`
2. Update TypeScript models in `src/database/models/`
3. Re-run `npm run migrate`
4. Update seed files if needed

---

## Deployment

### Production

```bash
export NODE_ENV=production

# Build
npm run build

# Apply migrations
npm run migrate

# Start server
npm start
```

Production checklist:
- Set a strong, unique `JWT_SECRET` (64+ random bytes)
- Set `CORS_ORIGIN` to your actual frontend domain
- Set `DB_SSL=true` for managed PostgreSQL
- Ensure `BCRYPT_ROUNDS=12` (default)

### Process Manager (PM2)

```bash
npm install -g pm2
pm2 start "npm start" --name haseb
pm2 save && pm2 startup
```

---

## Troubleshooting

### Database connection fails

```bash
sudo systemctl status postgresql   # Linux
brew services info postgresql      # macOS

# Test connection
psql -h localhost -U postgres -d haseb -c "SELECT 1;"
```

### Port already in use

```bash
lsof -i :3000
kill -9 <PID>
# or use a different port:
PORT=3001 npm run dev:backend
```

### Node.js memory limit

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev:backend
```

### Frontend build cache issues

```bash
rm -rf dist node_modules/.vite
npm run build:frontend
```

### Integration tests fail: "connection refused"

PostgreSQL must be running and `haseb_test` database must exist:
```bash
sudo pg_ctlcluster 16 main start   # or systemctl start postgresql
createdb haseb_test
```

---

## Roadmap

### Version 1.1
- [ ] Additional benchmark integrations (HumanEval, MBPP)
- [ ] Custom metrics framework for domain-specific evaluation
- [ ] Agent marketplace and sharing platform
- [ ] Advanced analytics dashboard with custom metric builder

### Version 1.2
- [ ] Distributed evaluation across multiple nodes
- [ ] D3.js advanced visualizations
- [ ] Mobile responsive design

### Version 2.0
- [ ] Multi-cloud deployment support
- [ ] Hierarchical agent orchestration workflows
- [ ] Enterprise SSO and team collaboration features

---

<div align="center">

**HASEB — Holistic Agentic System Evaluator & Benchmarking Suite**

[GitHub](https://github.com/marcuspat/haseb) • [Issues](https://github.com/marcuspat/haseb/issues)

</div>
