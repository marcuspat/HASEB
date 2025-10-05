# HASEB Demo Walkthrough

This comprehensive demo script demonstrates the end-to-end functionality of the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) system. The demo covers all major features including agent management, benchmark configuration, evaluation execution, and real-time monitoring.

## 📋 Demo Overview

### What You'll See
1. **System Health Check** - Verify all components are working
2. **Agent Management** - Create and configure AI agents
3. **Benchmark Setup** - Configure evaluation benchmarks
4. **Evaluation Execution** - Run live evaluations
5. **Real-time Monitoring** - Watch progress via WebSocket
6. **Results Analysis** - Review comprehensive metrics
7. **Dashboard Features** - Explore the web interface

### Prerequisites
- HASEB installed and running (see [Installation Guide](INSTALLATION.md))
- PostgreSQL database configured
- Backend server running on port 3000
- Optional: OpenAI or Anthropic API key for agent functionality

## 🚀 Getting Started

### Step 1: Verify System Health

```bash
# Check if the server is running
curl http://localhost:3000/health

# Expected response should show:
# - status: "ok"
# - database: connected: true
# - memory: usage statistics
```

**Expected Output:**
```json
{
  "status": "ok",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 45.123,
  "version": "1.0.0",
  "environment": "development",
  "database": {
    "connected": true,
    "pool": {
      "total": 1,
      "idle": 0,
      "waiting": 0
    }
  },
  "memory": {
    "used": 85,
    "total": 512
  }
}
```

### Step 2: Check API Documentation

```bash
# Open the interactive API documentation
open http://localhost:3000/api-docs
# Or visit: http://localhost:3000/api-docs in your browser
```

You should see the Swagger UI with all available endpoints.

## 🤖 Part 1: Agent Management Demo

### Creating Your First Agent

Let's create a SWE (Software Engineering) agent for code evaluation:

```bash
# Create a SWE-Bench agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo SWE Agent",
    "type": "swe",
    "description": "Demo agent for software engineering tasks",
    "capabilities": [
      "code_generation",
      "debugging",
      "refactoring",
      "testing"
    ],
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokens": 4000,
      "timeout": 300000
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Demo SWE Agent",
    "type": "swe",
    "description": "Demo agent for software engineering tasks",
    "capabilities": ["code_generation", "debugging", "refactoring", "testing"],
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokens": 4000,
      "timeout": 300000
    },
    "status": "inactive",
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

Save the agent ID for later use.

### List All Agents

```bash
# List all available agents
curl http://localhost:3000/api/agents
```

### Create Additional Agent Types

Let's create agents for different evaluation types:

```bash
# GUI Automation Agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo GUI Agent",
    "type": "gui",
    "description": "Demo agent for GUI automation tasks",
    "capabilities": ["screen_capture", "mouse_simulation", "keyboard_input", "element_detection"],
    "configuration": {
      "screenResolution": "1920x1080",
      "actionDelay": 1000,
      "confidenceThreshold": 0.8
    }
  }'

# General Reasoning Agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo General Agent",
    "type": "general",
    "description": "Demo agent for general reasoning tasks",
    "capabilities": ["text_analysis", "logical_reasoning", "math_problem_solving", "research"],
    "configuration": {
      "model": "gpt-3.5-turbo",
      "temperature": 0.3,
      "maxTokens": 2000
    }
  }'
```

### Activate Agents

```bash
# Activate the SWE agent (replace with actual ID)
curl -X PATCH http://localhost:3000/api/agents/550e8400-e29b-41d4-a716-446655440000/status \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

## 📊 Part 2: Benchmark Setup Demo

### Create a Custom Benchmark

```bash
# Create a simple demo benchmark
curl -X POST http://localhost:3000/api/benchmarks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Code Benchmark",
    "type": "custom",
    "description": "Demo benchmark for code generation evaluation",
    "dataset": "demo-code-tasks-v1",
    "evaluationCriteria": [
      "functional_correctness",
      "code_quality",
      "efficiency",
      "error_handling"
    ],
    "configuration": {
      "timeout": 600,
      "maxTasks": 5,
      "difficulty": "easy"
    },
    "isActive": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Demo Code Benchmark",
    "type": "custom",
    "description": "Demo benchmark for code generation evaluation",
    "dataset": "demo-code-tasks-v1",
    "evaluationCriteria": ["functional_correctness", "code_quality", "efficiency", "error_handling"],
    "configuration": {
      "timeout": 600,
      "maxTasks": 5,
      "difficulty": "easy"
    },
    "isActive": true,
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### List Available Benchmarks

```bash
# Get all benchmarks
curl http://localhost:3000/api/benchmarks
```

## 🎯 Part 3: Evaluation Execution Demo

### Start an Evaluation

Now let's run a live evaluation using our agent and benchmark:

```bash
# Start evaluation (replace with actual agent and benchmark IDs)
curl -X POST http://localhost:3000/api/evaluations \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
    "configuration": {
      "maxSteps": 10,
      "timeout": 300,
      "enableLogging": true,
      "enableMetrics": true
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "configuration": {
      "maxSteps": 10,
      "timeout": 300,
      "enableLogging": true,
      "enableMetrics": true
    },
    "logs": [],
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

Save the evaluation ID for monitoring.

### Monitor Evaluation Status

```bash
# Check evaluation status (replace with actual evaluation ID)
curl http://localhost:3000/api/evaluations/770e8400-e29b-41d4-a716-446655440000
```

### Start Evaluation via Orchestrator

For more control, use the orchestrator endpoint:

```bash
# Start evaluation through orchestrator
curl -X POST http://localhost:3000/api/orchestrator/evaluations/start \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
    "configuration": {
      "priority": "high",
      "maxSteps": 10,
      "timeout": 300
    }
  }'
```

## 📡 Part 4: Real-time Monitoring Demo

### WebSocket Monitoring

Open a new terminal and connect to the WebSocket for real-time updates:

```bash
# Install wscat if not available
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000
```

Once connected, send subscription messages:

```json
{"type":"subscribe","channel":"evaluations"}
```

You should see real-time updates as the evaluation progresses.

### Monitor Queue Status

```bash
# Check evaluation queue
curl http://localhost:3000/api/orchestrator/queue/status
```

### System Status Monitoring

```bash
# Check orchestrator status
curl http://localhost:3000/api/orchestrator/status
```

## 📈 Part 5: Results Analysis Demo

### Get Final Results

After the evaluation completes, get the detailed results:

```bash
# Get evaluation results with metrics
curl http://localhost:3000/api/evaluations/770e8400-e29b-41d4-a716-446655440000
```

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "startTime": "2023-12-01T10:00:00.000Z",
    "endTime": "2023-12-01T10:05:00.000Z",
    "metrics": {
      "performance": {
        "taskSuccessRate": 0.8,
        "executionTime": 300,
        "firstSuccessTime": 120
      },
      "efficiency": {
        "totalSteps": 8,
        "latencyPerStep": 37.5,
        "totalTokens": 2500
      },
      "cost": {
        "estimatedCost": 0.15,
        "costPerTask": 0.03
      },
      "robustness": {
        "toolCallErrorRate": 0.1,
        "recoveryRate": 0.9
      },
      "quality": {
        "toolSelectionAccuracy": 0.85,
        "parameterAccuracy": 0.9
      }
    },
    "logs": [
      {
        "id": "log-uuid-1",
        "timestamp": "2023-12-01T10:00:00.000Z",
        "level": "info",
        "message": "Evaluation started",
        "source": "orchestrator"
      },
      {
        "id": "log-uuid-2",
        "timestamp": "2023-12-01T10:01:00.000Z",
        "level": "info",
        "message": "Task 1/10 started",
        "source": "agent"
      }
    ]
  }
}
```

### Get Dashboard Metrics

```bash
# Get overall dashboard metrics
curl http://localhost:3000/api/metrics/dashboard
```

### Get Leaderboard Data

```bash
# Get performance leaderboard
curl http://localhost:3000/api/metrics/leaderboard
```

## 🖥️ Part 6: Web Interface Demo

### Access the Dashboard

1. **Open your web browser** and navigate to: `http://localhost:3000`

2. **Explore the main dashboard** - you should see:
   - Overview cards showing total evaluations, agents, benchmarks
   - Recent activity feed
   - Performance charts
   - Active evaluations

3. **Navigate to different sections**:
   - **Agents Page** (`/agents`) - View and manage all agents
   - **Benchmarks Page** (`/benchmarks`) - View available benchmarks
   - **Leaderboard Page** (`/leaderboard`) - View performance rankings
   - **Analytics Page** (`/analytics`) - Detailed analytics and charts
   - **Settings Page** (`/settings`) - Configuration options

### Real-time Features in the Browser

1. **Open Developer Tools** (F12) and go to the Console tab
2. **Watch for WebSocket connections** - you should see connection logs
3. **Monitor real-time updates** - evaluation progress should update automatically
4. **Check Network tab** - see API calls and WebSocket messages

## 🎯 Part 7: Advanced Demo Features

### Run Multiple Evaluations

```bash
# Start multiple evaluations with different configurations
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/evaluations \
    -H "Content-Type: application/json" \
    -d "{
      \"agentId\": \"550e8400-e29b-41d4-a716-446655440000\",
      \"benchmarkId\": \"660e8400-e29b-41d4-a716-446655440000\",
      \"configuration\": {
        \"maxSteps\": $((5 + i * 2)),
        \"timeout\": $((200 + i * 100))
      }
    }"
  echo "Started evaluation $i"
  sleep 2
done
```

### Performance Analysis

```bash
# Get performance analytics
curl "http://localhost:3000/api/metrics/performance?timeRange=1h&agentId=550e8400-e29b-41d4-a716-446655440000"
```

### Export Evaluation Data

```bash
# Get all evaluations with filtering
curl "http://localhost:3000/api/evaluations?status=completed&limit=10" | jq '.data.evaluations' > evaluation_results.json
```

## 🛠️ Demo Cleanup

After completing the demo, you can clean up the test data:

```bash
# Stop running evaluations
curl -X POST http://localhost:3000/api/orchestrator/evaluations/770e8400-e29b-41d4-a716-446655440000/stop

# Delete demo agents (replace with actual IDs)
curl -X DELETE http://localhost:3000/api/agents/550e8400-e29b-41d4-a716-446655440000

# Delete demo benchmarks (replace with actual IDs)
curl -X DELETE http://localhost:3000/api/benchmarks/660e8400-e29b-41d4-a716-446655440000

# Reset database (optional - removes all data)
npm run migrate:reset
```

## 📊 What to Look For

### Successful Demo Indicators

✅ **Health Check**: Server responds with `status: "ok"`
✅ **Agent Creation**: Agents are created successfully and appear in listings
✅ **Benchmark Setup**: Benchmarks are created and active
✅ **Evaluation Execution**: Evaluations move from `pending` → `running` → `completed`
✅ **Real-time Updates**: WebSocket shows live progress updates
✅ **Metrics Collection**: Comprehensive metrics are collected and stored
✅ **Dashboard Functionality**: Web interface displays data correctly
✅ **API Performance**: All API endpoints respond quickly and correctly

### Common Demo Issues and Solutions

#### Evaluations Stay in "pending" Status
```bash
# Check orchestrator status
curl http://localhost:3000/api/orchestrator/status

# Ensure agent is active
curl -X PATCH http://localhost:3000/api/agents/{agentId}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

#### WebSocket Updates Not Working
```bash
# Test WebSocket connection
wscat -c ws://localhost:3000

# Check server logs
tail -f logs/haseb.log | grep websocket
```

#### Dashboard Not Updating
```bash
# Refresh browser cache
# Press Ctrl+F5 or Cmd+Shift+R

# Check browser console for JavaScript errors
# Open Developer Tools → Console
```

#### Metrics Not Appearing
```bash
# Wait for evaluation to complete
curl http://localhost:3000/api/evaluations/{evaluationId}

# Check if metrics collection is enabled
curl http://localhost:3000/api/evaluations/{evaluationId} | jq '.data.configuration.enableMetrics'
```

## 🎉 Demo Completion Checklist

At the end of your demo, you should have successfully demonstrated:

- [ ] System health monitoring
- [ ] Agent creation and management
- [ ] Benchmark configuration
- [ ] Evaluation execution
- [ ] Real-time progress monitoring
- [ ] Comprehensive metrics collection
- [ ] Interactive dashboard features
- [ ] API functionality
- [ ] WebSocket real-time updates
- [ ] Performance analytics

## 🚀 Next Steps

After completing the demo:

1. **Explore Advanced Features**:
   - Custom metrics definition
   - Advanced filtering and sorting
   - Export and reporting features
   - Integration with external tools

2. **Scale Up**:
   - Configure multiple agent types
   - Set up complex benchmarks
   - Run large-scale evaluations
   - Monitor system performance

3. **Customize for Your Use Case**:
   - Create domain-specific agents
   - Develop custom benchmarks
   - Integrate with your existing tools
   - Deploy to production environment

## 📞 Support During Demo

If you encounter issues during the demo:

1. **Check the logs**: `tail -f logs/haseb.log`
2. **Enable debug mode**: `DEBUG=haseb:* npm run dev:backend`
3. **Verify prerequisites**: Check all services are running
4. **Consult the troubleshooting guide**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
5. **Check API documentation**: http://localhost:3000/api-docs

## 📚 Additional Demo Scripts

### Automated Demo Script

For a fully automated demo, create a script file:

```bash
#!/bin/bash
# demo.sh - Automated HASEB Demo

echo "🚀 Starting HASEB Demo..."

# Health check
echo "📊 Checking system health..."
curl -s http://localhost:3000/health | jq '.status'

# Create agent
echo "🤖 Creating demo agent..."
AGENT_ID=$(curl -s -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Agent","type":"swe","description":"Demo agent"}' | \
  jq -r '.data.id')

echo "Created agent: $AGENT_ID"

# Create benchmark
echo "📊 Creating demo benchmark..."
BENCHMARK_ID=$(curl -s -X POST http://localhost:3000/api/benchmarks \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Benchmark","type":"custom","description":"Demo benchmark"}' | \
  jq -r '.data.id')

echo "Created benchmark: $BENCHMARK_ID"

# Start evaluation
echo "🎯 Starting evaluation..."
EVAL_ID=$(curl -s -X POST http://localhost:3000/api/evaluations \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"$AGENT_ID\",\"benchmarkId\":\"$BENCHMARK_ID\"}" | \
  jq -r '.data.id')

echo "Started evaluation: $EVAL_ID"

# Monitor progress
echo "📡 Monitoring progress..."
while true; do
  STATUS=$(curl -s http://localhost:3000/api/evaluations/$EVAL_ID | jq -r '.data.status')
  echo "Evaluation status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 5
done

# Show results
echo "📈 Showing final results..."
curl -s http://localhost:3000/api/evaluations/$EVAL_ID | jq '.data.metrics'

echo "✅ Demo completed!"
```

Make the script executable and run it:
```bash
chmod +x demo.sh
./demo.sh
```

This automated script demonstrates the complete HASEB workflow without manual intervention.

---

Congratulations! You've completed a comprehensive demonstration of the HASEB system. This demo showcases all major features and provides a solid foundation for exploring more advanced use cases and customizations.