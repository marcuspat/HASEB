# HASEB: Claude Code Configuration - Holistic Agentic System Evaluator & Benchmarking Suite

## 🚀 Project Overview

**HASEB** (Holistic Agentic System Evaluator & Benchmarking Suite) is a unified, open-source evaluation platform designed to holistically assess agentic systems across diverse tasks with multi-dimensional "process viability" metrics.

### Technology Stack
- **Frontend**: React with TypeScript
- **Backend**: Node.js/Express with TypeScript
- **Database**: PostgreSQL with connection pooling
- **Methodology**: SPARC (Specification, Pseudocode, Architecture, Refinement, Completion)
- **Testing**: Jest + Playwright for comprehensive test coverage
- **Documentation**: Automated with API doc generation

## 🚨 CRITICAL: VERIFICATION-FIRST DEVELOPMENT

This project enforces **"truth is enforced, not assumed"** with mandatory verification for all operations.

### Truth Verification System
- **Threshold**: 0.95 (95% accuracy required for production)
- **Mode**: Strict verification with auto-rollback
- **Pair Programming**: Real-time collaborative development
- **Byzantine Fault Tolerance**: Protection against incorrect agents

```bash
# Initialize verification system
npx claude-flow@alpha verify init strict     # 95% threshold, auto-rollback
npx claude-flow@alpha pair --start           # Begin collaborative session
npx claude-flow@alpha truth                  # View current truth scores
```

## 🚨 ABSOLUTE EXECUTION RULES

**GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"**

### Mandatory Concurrent Patterns
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool (Claude Code)**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### File Organization (NEVER save to root)
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code
- `/benchmarks` - Benchmark definitions and results

## 🔴 MANDATORY: Doc-Planner & Microtask-Breakdown

**EVERY coding session, swarm, and hive-mind MUST start with:**

```bash
# ALWAYS start with mandatory agents
cat $WORKSPACE_FOLDER/agents/doc-planner.md
cat $WORKSPACE_FOLDER/agents/microtask-breakdown.md
```

1. **Doc-Planner Agent**: Creates comprehensive documentation plans following SPARC workflow, implements London School TDD methodology, ensures atomic testable tasks

2. **Microtask-Breakdown Agent**: Decomposes phases into atomic 10-minute tasks, follows strict CLAUDE.md principles, creates tasks scoring 100/100 production readiness

## 🏗️ HASEB Architecture

### Core Components

#### Evaluation Orchestration Core (LangGraph)
- **Evaluation_Orchestrator**: Master control plane for the entire suite
- Manages complex, stateful workflows using LangGraph
- Handles environment setup, task execution, metrics collection, and teardown

#### Multi-Environment Execution Agents
- **SWE_Bench_Agent**: Code generation benchmark evaluation (SWE-bench)
- **GUI_Automation_Agent**: GUI-based environments (OSWorld, WebArena)
- **General_Reasoning_Agent**: General-purpose benchmarks (GAIA, AgentBench)

#### Multi-Dimensional Metrics Collection
- **Performance Metrics**: Task Success Rate
- **Efficiency Metrics**: Execution Time, Latency per Step, Number of Steps
- **Cost Metrics**: Total LLM Tokens, Estimated API Cost in USD
- **Robustness Metrics**: Tool Call Error Rate, Recovery Rate
- **Quality Metrics**: Tool Selection Accuracy, Parameter Accuracy

### Technology Implementation
```javascript
// Core evaluation workflow
const evaluationGraph = {
  setup: async (benchmark) => await setupEnvironment(benchmark),
  execute: async (agent, task) => await executeTask(agent, task),
  collect: async (execution) => await collectMetrics(execution),
  analyze: async (metrics) => await analyzeResults(metrics),
  teardown: async (environment) => await cleanupEnvironment(environment)
};
```

## 🤖 Agent Discovery & Selection Protocol

Before starting any task:

```bash
# Count total agents
ls $WORKSPACE_FOLDER/agents/*.md 2>/dev/null | wc -l

# Search for specific functionality
find $WORKSPACE_FOLDER/agents/ -name "*test*"
find $WORKSPACE_FOLDER/agents/ -name "*github*"
find $WORKSPACE_FOLDER/agents/ -name "*benchmark*"

# Sample available agents
ls $WORKSPACE_FOLDER/agents/*.md | shuf | head -10 | sed 's|.*/||g' | sed 's|.md||g'
```

## 🎯 GitHub-First Integration

### GitHub-Enhanced Project Initialization
```bash
# Initialize with GitHub integration, verification, and pair programming
npx claude-flow@alpha github init --verify --pair --training-pipeline

# Alternative: Full-featured initialization
npx claude-flow@alpha init --github-enhanced --verify --pair --project-name "HASEB"
```

### GitHub Specialized Agents (13 Available)
- `github-pr-manager` - AI-powered PR reviews and management
- `github-release-manager` - Automated releases with changelogs
- `github-issue-tracker` - Intelligent issue management
- `github-code-reviewer` - Multi-reviewer code analysis
- `github-workflow-manager` - CI/CD optimization
- `github-security-manager` - Security scanning and fixes
- Plus 7 additional GitHub-specific agents

### GitHub Workflow Automation
```bash
# Complete GitHub repository setup
npx claude-flow@alpha github repo-architect optimize \
  --structure-analysis \
  --workflow-optimization \
  --13-github-agents \
  --enterprise-security

# PR management with verification
npx claude-flow@alpha github pr-manager setup \
  --multi-reviewer \
  --ai-powered-reviews \
  --verification-gates
```

## 🎯 Agent Execution with Claude Code Task Tool

### Correct Pattern: Mandatory Agents + Specialized Execution

```javascript
// ALWAYS start with mandatory agents
[Single Message - Mandatory Planning]:
  Read("agents/doc-planner.md")
  Read("agents/microtask-breakdown.md")

  // Use Task tool with loaded agent instructions
  Task("Doc Planning", "Follow doc-planner methodology to create comprehensive plan", "planner")
  Task("Microtask Breakdown", "Follow microtask-breakdown methodology for atomic tasks", "planner")

  // Specialized agents for HASEB implementation
  Task("Evaluation Orchestrator", "Build LangGraph-based orchestration core with state management", "system-architect")
  Task("Backend Development", "Create Express API with PostgreSQL for metrics storage", "backend-dev")
  Task("Frontend Development", "Build React dashboard with interactive visualizations", "coder")
  Task("Benchmark Integration", "Implement SWE-bench, GAIA, and OSWorld integrations", "ml-developer")
  Task("Testing", "Write comprehensive test suite with 90% coverage", "tester")
  Task("GitHub Integration", "Setup CI/CD workflows with automated releases", "github-workflow-manager")
  Task("Security Audit", "Review authentication and data handling", "security-manager")

  // Batch ALL todos together
  TodoWrite { todos: [
    {id: "1", content: "Execute doc-planner for HASEB architecture", status: "in_progress", priority: "high"},
    {id: "2", content: "Use microtask-breakdown for implementation phases", status: "pending", priority: "high"},
    {id: "3", content: "Design LangGraph orchestration workflow", status: "pending", priority: "high"},
    {id: "4", content: "Implement PostgreSQL schema for metrics", status: "pending", priority: "high"},
    {id: "5", content: "Create Express API endpoints", status: "pending", priority: "high"},
    {id: "6", content: "Build React dashboard with Streamlit/Gradio alternative", status: "pending", priority: "medium"},
    {id: "7", content: "Integrate SWE-bench evaluation pipeline", status: "pending", priority: "medium"},
    {id: "8", content: "Implement GUI automation evaluation", status: "pending", priority: "medium"},
    {id: "9", content: "Write comprehensive tests", status: "pending", priority: "medium"},
    {id: "10", content: "Setup GitHub workflows", status: "pending", priority: "low"},
    {id: "11", content: "Security audit with verification", status: "pending", priority: "low"},
    {id: "12", content: "Create interactive leaderboard dashboard", status: "pending", priority: "low"}
  ]}

  // Parallel file operations
  Write "src/orchestrator/evaluation-graph.js"
  Write "src/api/server.js"
  Write "src/components/Dashboard.jsx"
  Write "tests/evaluation.test.js"
  Write "config/database.js"
  Write "benchmarks/swe-bench/config.json"
```

## 📊 SPARC Development Workflow

### Core SPARC Commands
- `npx claude-flow@alpha sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow@alpha sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow@alpha sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow@alpha sparc pipeline "<task>"` - Full pipeline processing

### SPARC Workflow Phases for HASEB
1. **Specification** - Requirements analysis for benchmark evaluation system
2. **Pseudocode** - Algorithm design for orchestration workflows
3. **Architecture** - System design with multi-environment support
4. **Refinement** - TDD implementation with truth verification
5. **Completion** - Integration with automated deployment

### HASEB-Specific SPARC Implementation
```bash
# Specification phase - Define evaluation requirements
npx claude-flow@alpha sparc run specification "Define HASEB evaluation framework requirements"

# Architecture phase - Design modular evaluation system
npx claude-flow@alpha sparc run architect "Design LangGraph orchestration with modular agents"

# Refinement phase - TDD implementation
npx claude-flow@alpha sparc tdd "Implement evaluation pipeline with comprehensive testing"
```

## 🔄 Verification & Background Management

### Background Task Management
```bash
# Start pair programming with background monitoring
npx claude-flow@alpha pair --start --monitor &

# View background tasks
/bashes

# Check verification output
"Check status of bash_1"
"Show output from bash_1"
```

### Verification Requirements by Agent Type
- **Coder Agents**: Code compilation (35%), tests pass (25%), linting (20%), type safety (20%)
- **Reviewer Agents**: Code analysis, security scan, performance check
- **Tester Agents**: Unit tests, integration tests, coverage check (90% minimum)
- **ML Developer Agents**: Model validation, benchmark accuracy, metrics analysis
- **GitHub Agents**: PR validation, workflow success, security compliance

## 🔄 MCP Tools vs Claude Code Division

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently for actual work
- File operations (Read, Write, Edit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- TodoWrite and task management
- Git operations and testing
- Database schema creation and migration

### MCP Tools ONLY COORDINATE:
- Swarm initialization (topology setup)
- Agent type definitions (coordination patterns)
- Task orchestration (high-level planning)
- Memory management and neural features
- Performance tracking and GitHub integration

**KEY**: MCP coordinates the strategy, Claude Code's Task tool executes with real agents.

## 🚀 Agent Coordination Protocol

Every agent spawned via Task tool MUST:

**BEFORE Work:**
```bash
# Initialize with mandatory agents loaded
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "haseb-[id]"
```

**DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "haseb/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Work Chunking Protocol (WCP)

Feature-based agile with CI integration for HASEB:

### Phase 1: Planning (MANDATORY)
1. **Load Agents**: doc-planner + microtask-breakdown
2. **EPIC Issue**: HASEB evaluation framework implementation
3. **Feature Breakdown**: Core orchestrator, benchmark integrations, metrics dashboard (3-5 days each)
4. **Microtask Decomposition**: 10-minute atomic tasks

### Phase 2: GitHub Structure
5. **Create Sub-Issues** with GitHub CLI for each component
6. **EPIC Template** with verification requirements
7. **Link Dependencies** and success criteria

### Phase 3: Execution with Verification
8. **One Feature at a Time**: Complete with 100% CI before next
9. **Swarm Deployment**: For complex features (orchestrator, multi-benchmark support)
10. **Truth Verification**: All changes must pass 0.95 threshold

### Phase 4: CI Integration
11. **Mandatory CI**: 100% success required before progression
12. **Playwright Integration**: Visual verification for dashboard components
13. **Monitor with ML**: Predictive monitoring and auto-rollback

## 🛡️ Continuous Integration Protocol

Fix→Test→Commit→Push→Monitor→Repeat until 100%:

### Research Phase
1. **Deep Research Sources**: Evaluation benchmark papers, LangGraph documentation, React dashboard best practices
2. **Analysis**: Root causes vs symptoms, severity categorization
3. **Targeted Fixes**: Focus on specific CI failures

### Implementation Phase
4. **Implementation-First**: Fix logic not test expectations
5. **Iterate Until Success**: Keep trying different approaches, never give up
6. **Swarm Execution**: Systematic TDD with coordination

### Monitoring Phase
7. **Active Monitoring**: Always check after pushing
8. **Intelligent Monitoring**: Smart backoff, auto-merge, swarm coordination
9. **Integration**: Regular commits, PR on milestones

## 🎯 HASEB-Specific Implementation Patterns

### Evaluation Orchestration Pattern
```javascript
// LangGraph-based evaluation workflow
class EvaluationOrchestrator {
  async runEvaluation(agent, benchmark) {
    const graph = new StateGraph(EvaluationState)
      .addNode("setup", setupEnvironment)
      .addNode("execute", executeTask)
      .addNode("collect", collectMetrics)
      .addNode("analyze", analyzeResults)
      .addNode("teardown", cleanupEnvironment)
      .addEdge("setup", "execute")
      .addEdge("execute", "collect")
      .addEdge("collect", "analyze")
      .addEdge("analyze", "teardown");

    return await graph.compile().invoke({ agent, benchmark });
  }
}
```

### Metrics Collection Pattern
```javascript
// Multi-dimensional metrics collection
const metricsCollector = {
  performance: { taskSuccessRate: 0.0 },
  efficiency: { executionTime: 0, latencyPerStep: 0, totalSteps: 0 },
  cost: { totalTokens: 0, estimatedCost: 0.0 },
  robustness: { toolCallErrorRate: 0.0, recoveryRate: 0.0 },
  quality: { toolSelectionAccuracy: 0.0, parameterAccuracy: 0.0 }
};
```

### Database Schema Pattern
```sql
-- PostgreSQL schema for HASEB
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name VARCHAR(255) NOT NULL,
  benchmark_type VARCHAR(100) NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evaluations_agent_benchmark ON evaluations(agent_name, benchmark_type);
CREATE INDEX idx_evaluations_metrics ON evaluations USING GIN(metrics);
```

## 🎯 Ultimate HASEB Hive Project Launch Command

```bash
# Complete HASEB deployment with full evaluation capabilities
npx claude-flow@alpha hive-mind spawn \
  "Deploy complete HASEB evaluation suite with LangGraph orchestration, multi-benchmark support,
   React dashboard, PostgreSQL metrics storage, comprehensive testing, GitHub integration,
   automated evaluation pipelines, and interactive leaderboards for agentic system assessment" \
  --agents 30 \
  --github-agents all-13 \
  --categories "evaluation,benchmark,analytics,development,security,performance" \
  --topology adaptive \
  --verify \
  --pair \
  --training-pipeline \
  --github-enhanced \
  --stream-chain \
  --mle-star-workflow \
  --truth-threshold 0.95 \
  --auto-benchmark \
  --github-checkpoints \
  --automated-releases \
  --pr-automation \
  --security-scanning \
  --performance-monitoring \
  --claude
```

## 📊 HASEB Performance Metrics

### Target Metrics
- **Evaluation Accuracy**: >95% benchmark result validation
- **System Performance**: <2s average evaluation setup time
- **Dashboard Responsiveness**: <100ms interaction latency
- **Data Integrity**: 99.9% metrics storage accuracy
- **Test Coverage**: >90% across all components

### Success Indicators
- **Truth accuracy rate**: >95%
- **Integration success rate**: >90%
- **Benchmark completion rate**: >98%
- **User satisfaction score**: >4.5/5

## ⚡ Essential Aliases for HASEB

```bash
# Add to .bashrc/.zshrc
alias haseb-init="npx claude-flow@alpha init --verify --pair --github-enhanced --project-name HASEB"
alias haseb-eval="npx claude-flow@alpha sparc run evaluation 'Run benchmark evaluation'"
alias haseb-verify="npx claude-flow@alpha verify --threshold 0.95"
alias haseb-truth="npx claude-flow@alpha truth"
alias haseb-pair="npx claude-flow@alpha pair --start"
alias haseb-dashboard="npm run dev:dashboard"
alias haseb-test="npm run test:coverage"
```

## 🎯 Master Prompting Pattern for HASEB

**ALWAYS include in prompts:**
"Identify all subagents useful for HASEB evaluation task, utilize claude-flow hivemind to maximize ability to accomplish the evaluation system development, start with doc-planner and microtask-breakdown, ensure truth verification above 0.95 threshold, implement comprehensive testing for benchmark accuracy."

## 🔧 HASEB Development Principles

1. **Verification-First**: Truth is enforced, not assumed
2. **Doc-First**: ALWAYS start with doc-planner and microtask-breakdown
3. **GitHub-Centric**: All operations integrate with GitHub workflows
4. **Benchmark-Accuracy**: All evaluations must be validated against ground truth
5. **Batch Everything**: Multiple operations in single messages
6. **Iterate Until Success**: Never give up, deep research when stuck
7. **Metrics-Driven**: All decisions based on comprehensive data analysis
8. **Concurrent Execution**: Parallel operations for maximum efficiency

## 📊 Progress Format

```
📊 HASEB Progress Overview
├── Verification: ✅ Truth: 0.97 | ✅ Pair: Active
├── Planning: ✅ doc-planner | ✅ microtask-breakdown
├── Total: X | ✅ Complete: X | 🔄 Active: X | ⭕ Todo: X
├── GitHub: ✅ PR: X | ✅ Issues: X | ✅ CI: PASS
├── Benchmarks: ✅ SWE-bench: X | ✅ GAIA: X | ✅ OSWorld: X
├── Metrics: ✅ Performance: X | ✅ Efficiency: X | ✅ Cost: X
└── Priority: 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW
```

---

**HASEB Success = Verification-First + Doc-First + GitHub-Centric + Benchmark-Accuracy + Concurrent Execution + Persistent Iteration**