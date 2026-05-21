# HASEB: Holistic Agentic System Evaluator & Benchmarking Suite

<div align="center">

![HASEB Logo](https://via.placeholder.com/200x80/000000/FFFFFF?text=HASEB)

**A unified, open-source evaluation platform for holistically assessing agentic systems across diverse tasks with multi-dimensional "process viability" metrics.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2+-blue)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)](https://www.postgresql.org/)

[📖 Documentation](#documentation) • [🚀 Quick Start](#quick-start) • [🏗️ Architecture](#architecture) • [📊 Benchmarks](#benchmarks) • [🔧 Configuration](#configuration)

</div>

## 🎯 Overview

**HASEB** (Holistic Agentic System Evaluator & Benchmarking Suite) is a comprehensive evaluation platform designed to assess AI agents across multiple dimensions including performance, efficiency, cost, robustness, and quality. Built with modern web technologies and following SPARC methodology, HASEB provides researchers and developers with the tools needed to systematically evaluate and compare agentic systems.

### Key Features

- **🔄 Multi-Environment Support**: SWE-bench, GAIA, OSWorld, WebArena, AgentBench
- **📊 Multi-Dimensional Metrics**: Performance, Efficiency, Cost, Robustness, Quality
- **⚡ Real-Time Monitoring**: WebSocket-based live evaluation tracking
- **🎯 LangGraph Orchestration**: Stateful workflow management
- **📱 Interactive Dashboard**: React-based visualization interface
- **🗄️ PostgreSQL Backend**: Scalable metrics storage and analysis
- **🔒 Enterprise Security**: JWT authentication, rate limiting, CORS protection
- **📈 Comprehensive Analytics**: Real-time leaderboards and trend analysis

## 🚀 Quick Start

### Prerequisites

**Exact versions required:**
- **Node.js** >= 18.0.0 (tested with 18.19.0+)
- **PostgreSQL** >= 15.0 (tested with 15.4+)
- **npm** >= 9.0.0 (tested with 10.2.4+)
- **Git** >= 2.30.0

### System Requirements

- **Memory**: Minimum 4GB RAM (8GB+ recommended)
- **Storage**: Minimum 10GB free space
- **OS**: Linux (Ubuntu 20.04+), macOS (12+), or Windows 10+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/haseb.git
   cd haseb
   ```

2. **Verify Node.js version**
   ```bash
   node --version  # Should be >= 18.0.0
   npm --version   # Should be >= 9.0.0
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration - see Configuration section below
   ```

5. **Set up PostgreSQL database**
   ```bash
   # Verify PostgreSQL is running
   pg_isready

   # Create database
   createdb haseb

   # Run migrations
   npm run migrate

   # Seed test data (optional)
   npm run seed:test
   ```

6. **Start the development servers**
   ```bash
   # Terminal 1: Start backend server
   npm run dev:backend

   # Terminal 2: Start frontend development server
   npm run dev
   ```

7. **Verify the installation**
   ```bash
   # Check health endpoint
   curl http://localhost:3000/health

   # Check API documentation
   curl http://localhost:3000/api-docs
   ```

8. **Access the application**
   - **Frontend**: http://localhost:3000
   - **API Documentation**: http://localhost:3000/api-docs
   - **Health Check**: http://localhost:3000/health
   - **API Root**: http://localhost:3000/

### Docker Quick Start

```bash
# Start PostgreSQL for testing
docker-compose -f docker-compose.test.yml up -d

# Run the application
npm run dev:backend
```

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React 19)    │◄──►│   (Express)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • REST API      │    │ • Evaluations   │
│ • Leaderboards  │    │ • WebSocket     │    │ • Agents        │
│ • Analytics     │    │ • Auth          │    │ • Benchmarks    │
│ • Settings      │    │ • Validation    │    │ • Metrics       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Orchestrator  │
                    │   (LangGraph)   │
                    │                 │
                    │ • Evaluation    │
                    │   Workflows     │
                    │ • Metrics       │
                    │   Collection    │
                    │ • Agent         │
                    │   Coordination  │
                    └─────────────────┘
```

### Core Modules

#### Evaluation Orchestrator (`/src/orchestrator/`)
- **EvaluationOrchestrator.ts**: LangGraph-based workflow management
- **EnvironmentManager.ts**: Environment setup and teardown
- **MetricsCollector.ts**: Multi-dimensional metrics collection
- **WebSocketManager.ts**: Real-time progress updates
- **ExecutionEngine.ts**: Task execution coordination
- **EvaluationQueue.ts**: Task queue management

#### Multi-Environment Agents (`/src/agents/`)
- **SWE_Bench_Agent.ts**: Code generation evaluation
- **GUI_Automation_Agent.ts**: GUI-based environments
- **General_Reasoning_Agent.ts**: General-purpose benchmarks
- **BaseExecutionAgent.ts**: Common agent functionality

#### API Layer (`/src/api/`)
- **agents.ts**: Agent management endpoints
- **evaluations.ts**: Evaluation orchestration
- **benchmarks.ts**: Benchmark configuration
- **metrics.ts**: Metrics collection and analysis
- **auth.ts**: Authentication and authorization
- **orchestrator.ts**: Workflow orchestration

#### Database Layer (`/src/database/`)
- **models/**: TypeScript models for all entities
- **migrations.ts**: Database schema migrations
- **connection.ts**: PostgreSQL connection pooling
- **seed-*.ts**: Database seeding scripts

#### Frontend Components (`/src/components/`, `/src/pages/`)
- **DashboardLayout.tsx**: Main application layout
- **RealTimeEvaluations.tsx**: Live evaluation monitoring
- **MetricCard.tsx**: Metrics visualization
- **TopAgentsChart.tsx**: Performance leaderboards

### Database Schema

```sql
-- Core Tables
users              -- User management and authentication
agents             -- AI agent definitions and configurations
benchmarks         -- Benchmark definitions and datasets
evaluations        -- Evaluation execution records
tasks              -- Individual task execution within evaluations
evaluation_states  -- State tracking for complex workflows
migrations         -- Database migration tracking
```

### Metrics Collection System

HASEB collects comprehensive metrics across five dimensions:

#### Performance Metrics
- **Task Success Rate**: Percentage of successfully completed tasks
- **Completion Time**: Total time taken for evaluation
- **First Success Time**: Time to first successful completion

#### Efficiency Metrics
- **Execution Time**: Total CPU time used
- **Latency per Step**: Average time per evaluation step
- **Total Steps**: Number of steps taken
- **Token Efficiency**: Tasks completed per token

#### Cost Metrics
- **Total Tokens**: Input + output tokens used
- **Estimated Cost**: USD equivalent of API calls
- **Cost per Task**: Average cost per completed task
- **Resource Utilization**: CPU, memory, storage usage

#### Robustness Metrics
- **Tool Call Error Rate**: Percentage of failed tool calls
- **Recovery Rate**: Success rate after errors
- **Error Types**: Classification of errors encountered
- **Fallback Usage**: How often fallback mechanisms were used

#### Quality Metrics
- **Tool Selection Accuracy**: Correct tool selection rate
- **Parameter Accuracy**: Correct parameter usage rate
- **Output Relevance**: Relevance score of outputs
- **Output Completeness**: Completeness score of outputs

## 📊 Supported Benchmarks

| Benchmark | Type | Description | Tasks | Data Path |
|-----------|------|-------------|--------|-----------|
| **SWE-bench** | Code Generation | Real-world software engineering tasks from GitHub | 2,294 | `./data/swe-bench` |
| **GAIA** | General Reasoning | General AI Assistant tasks across domains | 1,000+ | `./data/gaia` |
| **OSWorld** | GUI Automation | Operating system interaction and desktop automation | 300+ | `./data/osworld` |
| **WebArena** | Web Automation | Web-based task completion and browser automation | 800+ | `./data/webarena` |
| **AgentBench** | General Purpose | Multi-domain agent evaluation suite | 500+ | Custom |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

#### Required Configuration

```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database Configuration (Required)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=haseb
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000

# JWT Configuration (Required for production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

#### Optional Configuration

```env
# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs

# External API Keys (if needed for integrations)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Benchmark Data Paths
SWE_BENCH_DATA_PATH=./data/swe-bench
GAIA_DATA_PATH=./data/gaia
OSWORLD_DATA_PATH=./data/osworld
WEBARENA_DATA_PATH=./data/webarena

# File Upload Configuration
MAX_FILE_SIZE=10MB
UPLOAD_PATH=./uploads

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-change-this

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_PORT=9090

# Cache Configuration (optional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600
```

### Database Setup

1. **Install PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install postgresql postgresql-contrib

   # macOS
   brew install postgresql
   brew services start postgresql

   # Windows
   # Download from postgresql.org and follow installation guide
   ```

2. **Create Database and User**
   ```bash
   # Connect to PostgreSQL
   sudo -u postgres psql

   # In PostgreSQL shell:
   CREATE DATABASE haseb;
   CREATE USER haseb_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE haseb TO haseb_user;
   \q
   ```

3. **Run Database Migrations**
   ```bash
   npm run migrate
   ```

4. **Verify Database Connection**
   ```bash
   npm run dev:backend
   # Check logs for "Database connected successfully"
   curl http://localhost:3000/health
   ```

### Authentication Setup

For production deployment, configure JWT authentication:

```env
JWT_SECRET=generate-secure-random-string-here
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📖 Documentation

### API Documentation
- **Interactive API Docs**: http://localhost:3000/api-docs (Swagger UI)
- **OpenAPI Specification**: Available at `/api-docs/json`
- **REST API Reference**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### User Guides
- **Installation Guide**: [INSTALLATION.md](./INSTALLATION.md)
- **Demo Walkthrough**: [DEMO.md](./DEMO.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Developer Documentation
- **Architecture Overview**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Database Schema**: See src/database/migrations.ts
- **Testing Guide**: See Testing section below

## 🧪 Testing

### Running Tests

```bash
# Run unit tests (no database required — use this for CI and local dev)
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit          # Unit tests only (same as npm test)
npm run test:integration   # Integration tests (requires PostgreSQL — see .env.example)
npm run test:e2e          # End-to-end tests (Playwright)
npm run test:performance  # Performance benchmarks (requires PostgreSQL)
npm run test:security     # Security tests (requires PostgreSQL)

# Watch mode for development
npm run test:watch

# Backend-specific tests
npm run test:backend
```

### Test Structure

```
tests/
├── unit/                  # Unit tests
│   ├── agents/           # Agent logic tests
│   ├── api/              # API endpoint tests
│   ├── services/         # Service layer tests
│   ├── utils/            # Utility function tests
│   ├── hooks/            # React hook tests
│   ├── store/            # State management tests
│   └── database/         # Database model tests
├── integration/          # Integration tests
│   ├── database/         # Database integration
│   ├── metrics-system/   # Metrics collection
│   └── multi-agent/      # Multi-agent workflows
├── e2e/                  # End-to-end tests
│   ├── dashboard/        # Dashboard UI tests
│   ├── evaluations/      # Evaluation workflow
│   └── agents-workflow/  # Agent workflow tests
├── performance/          # Performance tests
└── security/             # Security tests
```

### Coverage Requirements

- **Minimum Coverage**: 90%
- **Critical Path Coverage**: 95%
- **API Endpoint Coverage**: 100%
- **Database Model Coverage**: 95%

### Test Database Setup

Tests use a separate database configuration:

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run tests with test database
NODE_ENV=test npm test
```

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   export NODE_ENV=production

   # Build the application
   npm run build
   ```

2. **Database Setup**
   ```bash
   # Run production migrations
   npm run migrate

   # Seed production data (optional)
   npm run seed
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

### Docker Deployment

```bash
# Build production image
docker build -t haseb:latest .

# Run with environment variables
docker run -d \
  --name haseb \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  haseb:latest
```

### Cloud Deployment Guides

- **AWS ECS**: See [docs/deployment/aws.md](./docs/deployment/aws.md)
- **Google Cloud**: See [docs/deployment/gcp.md](./docs/deployment/gcp.md)
- **Azure**: See [docs/deployment/azure.md](./docs/deployment/azure.md)
- **Heroku**: See [docs/deployment/heroku.md](./docs/deployment/heroku.md)

## 📊 Metrics & Analytics

### Real-Time Monitoring

- **WebSocket Updates**: Live evaluation progress at `ws://localhost:3000`
- **Dashboard Metrics**: Real-time performance charts
- **Health Monitoring**: System health at `/health`
- **API Metrics**: Request/response tracking

### Performance Analytics

The system tracks comprehensive metrics across all evaluations:

```javascript
// Example metrics structure
{
  performance: {
    taskSuccessRate: 0.85,
    executionTime: 1200,
    firstSuccessTime: 800
  },
  efficiency: {
    totalSteps: 45,
    latencyPerStep: 26.7,
    totalTokens: 15000
  },
  cost: {
    estimatedCost: 0.25,
    costPerTask: 0.05,
    resourceUtilization: 0.67
  },
  robustness: {
    toolCallErrorRate: 0.12,
    recoveryRate: 0.89,
    errorTypes: ['timeout', 'api_limit']
  },
  quality: {
    toolSelectionAccuracy: 0.92,
    parameterAccuracy: 0.88,
    outputRelevance: 0.91
  }
}
```

## 🔌 API Reference

### Base URL
```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

### Authentication

```bash
# Login (if auth is enabled)
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Get current user
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

### Core Endpoints

```bash
# Agents
GET    /api/agents              # List agents
POST   /api/agents              # Create agent
GET    /api/agents/:id          # Get agent details
PUT    /api/agents/:id          # Update agent
DELETE /api/agents/:id          # Delete agent

# Evaluations
GET    /api/evaluations         # List evaluations
POST   /api/evaluations         # Start evaluation
GET    /api/evaluations/:id     # Get evaluation details
PATCH  /api/evaluations/:id/status  # Update status
PUT    /api/evaluations/:id/metrics  # Update metrics

# Benchmarks
GET    /api/benchmarks          # List benchmarks
POST   /api/benchmarks          # Create benchmark
GET    /api/benchmarks/:id      # Get benchmark details

# Metrics
GET    /api/metrics/dashboard   # Dashboard metrics
GET    /api/metrics/performance # Performance analytics
GET    /api/metrics/leaderboard # Leaderboard data
```

### WebSocket API

```javascript
// Connect to real-time updates
const ws = new WebSocket('ws://localhost:3000');

// Subscribe to evaluation updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'evaluations',
  evaluationId: 'uuid-here'
}));

// Receive real-time updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

## 🛠️ Development

### Development Workflow

1. **Setup Development Environment**
   ```bash
   git clone <repository>
   cd haseb
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   npm run dev:backend

   # Terminal 2: Frontend
   npm run dev
   ```

3. **Run Tests in Watch Mode**
   ```bash
   npm run test:watch
   ```

4. **Lint and Format Code**
   ```bash
   npm run lint:fix
   npm run format
   ```

### Code Style and Standards

- **TypeScript**: Strict mode enabled, 100% type coverage required
- **ESLint**: Recommended rules with React and TypeScript plugins
- **Prettier**: Standard formatting with 2-space indentation
- **Husky**: Pre-commit hooks for quality enforcement
- **Conventional Commits**: Standardized commit message format

### Adding New Features

1. **Create feature branch**: `git checkout -b feature/new-feature`
2. **Write tests first**: Follow TDD methodology
3. **Implement functionality**: Write production code
4. **Update documentation**: Include API docs and README updates
5. **Run full test suite**: Ensure 100% pass rate
6. **Submit pull request**: With comprehensive description

### Database Changes

1. **Create migration**: Add to `src/database/migrations.ts`
2. **Update models**: Modify TypeScript models in `src/database/models/`
3. **Test migration**: Run `npm run migrate:test`
4. **Update seeds**: Modify seed files if needed

## 🐛 Troubleshooting

### Common Issues and Solutions

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U username -d haseb

# Reset database
npm run migrate:reset
```

#### Port Conflicts
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Use different port
PORT=3001 npm run dev
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

#### Frontend Build Issues
```bash
# Clear build cache
rm -rf dist node_modules/.vite
npm install
npm run build
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=haseb:* npm run dev

# Database query logging
LOG_LEVEL=debug npm run dev

# Verbose test output
DEBUG=haseb:* npm test
```

### Getting Help

- **Documentation**: [./docs/](./docs/)
- **API Reference**: http://localhost:3000/api-docs
- **Issues**: [GitHub Issues](https://github.com/your-org/haseb/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/haseb/discussions)
- **Email**: support@haseb.org

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **LangChain Team** for the excellent LangGraph framework
- **SWE-bench Team** for the benchmark dataset
- **GAIA Team** for general reasoning tasks
- **React Community** for the amazing frontend framework
- **PostgreSQL Team** for the reliable database system
- **OpenAI Community** for API integration patterns

## 🗺️ Roadmap

### Version 1.1 (Q1 2024)
- [ ] Additional benchmark integrations (HumanEval, MBPP)
- [ ] Advanced analytics dashboard with custom metrics
- [ ] Custom metrics framework for domain-specific evaluation
- [ ] Agent marketplace and sharing platform

### Version 1.2 (Q2 2024)
- [ ] Distributed evaluation support across multiple nodes
- [ ] Advanced visualizations with D3.js integration
- [ ] Performance optimization for large-scale evaluations
- [ ] Mobile responsive design improvements

### Version 2.0 (Q3 2024)
- [ ] Multi-cloud deployment support (AWS, GCP, Azure)
- [ ] Advanced agent orchestration with hierarchical workflows
- [ ] Real-time collaboration features for teams
- [ ] Enterprise features with SSO and advanced security

---

<div align="center">

**Built with ❤️ by the HASEB Team**

[Website](https://haseb.org) • [Documentation](https://docs.haseb.org) • [GitHub](https://github.com/your-org/haseb)

</div>