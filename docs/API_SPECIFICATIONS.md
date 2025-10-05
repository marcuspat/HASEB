# HASEB API Specifications

## Overview

This document provides comprehensive API specifications for the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) platform, including REST endpoints, WebSocket events, and data models.

## Base Configuration

### Base URL
- **Development**: `http://localhost:3000/api/v1`
- **Production**: `https://api.haseb.ai/api/v1`

### Authentication
- **Method**: JWT Bearer Token
- **Header**: `Authorization: Bearer <token>`
- **Token Type**: JWT with RS256 signature
- **Expiration**: 24 hours (configurable)

### Response Format
All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid-string",
    "version": "1.0.0"
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "agent_name",
      "reason": "Required field missing"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "uuid-string",
    "version": "1.0.0"
  }
}
```

## Core Data Models

### Evaluation
```typescript
interface Evaluation {
  id: string;
  agent_name: string;
  agent_version: string;
  benchmark_type: string;
  benchmark_version: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  configuration: EvaluationConfiguration;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metadata?: Record<string, any>;
}

interface EvaluationConfiguration {
  max_concurrent_tasks?: number;
  timeout_seconds?: number;
  retry_count?: number;
  custom_parameters?: Record<string, any>;
}
```

### Task
```typescript
interface Task {
  id: string;
  evaluation_id: string;
  task_id: string;
  task_name: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  configuration: TaskConfiguration;
  result?: TaskResult;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

interface TaskConfiguration {
  input_data: any;
  expected_output?: any;
  time_limit_seconds?: number;
  environment_requirements?: EnvironmentRequirements;
}

interface TaskResult {
  success: boolean;
  output: any;
  execution_time_ms: number;
  steps_taken: number;
  tools_used: string[];
  error_details?: string;
}
```

### Metrics
```typescript
interface Metric {
  id: string;
  task_id: string;
  metric_category: MetricCategory;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

type MetricCategory = 'performance' | 'efficiency' | 'cost' | 'robustness' | 'quality';

interface PerformanceMetrics {
  task_success_rate: number;
  completion_percentage: number;
  quality_score: number;
}

interface EfficiencyMetrics {
  total_execution_time: number; // milliseconds
  latency_per_step: number; // milliseconds
  number_of_steps: number;
  resource_utilization: number; // percentage
}

interface CostMetrics {
  total_llm_tokens: number;
  input_tokens: number;
  output_tokens: number;
  estimated_api_cost: number; // USD
  compute_resource_usage: number; // CPU-hours
}

interface RobustnessMetrics {
  tool_call_error_rate: number;
  recovery_rate: number;
  error_classification: Record<string, number>;
  failure_mode_analysis: Record<string, number>;
}

interface QualityMetrics {
  tool_selection_accuracy: number;
  parameter_accuracy: number;
  reasoning_coherence: number;
  solution_elegance: number;
}
```

### Agent
```typescript
interface Agent {
  id: string;
  name: string;
  version: string;
  type: AgentType;
  capabilities: string[];
  configuration: AgentConfiguration;
  created_at: string;
  updated_at: string;
}

type AgentType = 'swe-bench' | 'gui-automation' | 'general-reasoning' | 'custom';

interface AgentConfiguration {
  model_name: string;
  model_parameters: Record<string, any>;
  tool_configurations: Record<string, any>;
  environment_requirements: EnvironmentRequirements;
}

interface EnvironmentRequirements {
  docker_image?: string;
  memory_mb?: number;
  cpu_cores?: number;
  gpu_required?: boolean;
  storage_gb?: number;
  network_access?: boolean;
}
```

### Benchmark
```typescript
interface Benchmark {
  id: string;
  name: string;
  version: string;
  type: BenchmarkType;
  description: string;
  configuration: BenchmarkConfiguration;
  task_count: number;
  created_at: string;
}

type BenchmarkType = 'swe-bench' | 'osworld' | 'webarena' | 'gaia' | 'agentbench' | 'custom';

interface BenchmarkConfiguration {
  task_definition_format: string;
  evaluation_criteria: Record<string, any>;
  success_thresholds: Record<string, number>;
  required_metrics: string[];
}
```

## REST API Endpoints

### 1. Evaluation Management

#### Create Evaluation
```http
POST /evaluations
Content-Type: application/json
Authorization: Bearer <token>

{
  "agent_name": "gpt-4-coder",
  "agent_version": "1.0.0",
  "benchmark_type": "swe-bench",
  "benchmark_version": "latest",
  "configuration": {
    "max_concurrent_tasks": 5,
    "timeout_seconds": 1800,
    "retry_count": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "eval-uuid-string",
    "agent_name": "gpt-4-coder",
    "agent_version": "1.0.0",
    "benchmark_type": "swe-bench",
    "benchmark_version": "latest",
    "status": "pending",
    "configuration": {
      "max_concurrent_tasks": 5,
      "timeout_seconds": 1800,
      "retry_count": 3
    },
    "created_at": "2024-01-01T00:00:00Z"
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

#### Get Evaluation
```http
GET /evaluations/{evaluation_id}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "eval-uuid-string",
    "agent_name": "gpt-4-coder",
    "agent_version": "1.0.0",
    "benchmark_type": "swe-bench",
    "benchmark_version": "latest",
    "status": "running",
    "created_at": "2024-01-01T00:00:00Z",
    "started_at": "2024-01-01T00:01:00Z",
    "completed_tasks": 15,
    "total_tasks": 100,
    "current_metrics": {
      "performance": {
        "task_success_rate": 0.73
      },
      "efficiency": {
        "average_execution_time": 1250
      }
    }
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

#### List Evaluations
```http
GET /evaluations?agent={agent_name}&benchmark={benchmark_type}&status={status}&limit={limit}&offset={offset}
Authorization: Bearer <token>
```

**Query Parameters:**
- `agent` (optional): Filter by agent name
- `benchmark` (optional): Filter by benchmark type
- `status` (optional): Filter by status (pending, running, completed, failed, cancelled)
- `limit` (optional): Maximum number of results (default: 20, max: 100)
- `offset` (optional): Number of results to skip (default: 0)

#### Cancel Evaluation
```http
DELETE /evaluations/{evaluation_id}
Authorization: Bearer <token>
```

#### Get Evaluation Results
```http
GET /evaluations/{evaluation_id}/results
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evaluation_id": "eval-uuid-string",
    "summary": {
      "total_tasks": 100,
      "completed_tasks": 95,
      "successful_tasks": 78,
      "failed_tasks": 17,
      "success_rate": 0.78,
      "total_execution_time": 125000,
      "average_tokens_per_task": 2500,
      "total_cost": 45.67
    },
    "metrics": {
      "performance": {
        "task_success_rate": 0.78,
        "completion_percentage": 0.95
      },
      "efficiency": {
        "total_execution_time": 125000,
        "latency_per_step": 125,
        "number_of_steps": 1000
      },
      "cost": {
        "total_llm_tokens": 237500,
        "input_tokens": 150000,
        "output_tokens": 87500,
        "estimated_api_cost": 45.67
      },
      "robustness": {
        "tool_call_error_rate": 0.05,
        "recovery_rate": 0.82
      },
      "quality": {
        "tool_selection_accuracy": 0.91,
        "parameter_accuracy": 0.88
      }
    },
    "tasks": [
      {
        "task_id": "task-001",
        "task_name": "Fix authentication bug",
        "status": "completed",
        "success": true,
        "execution_time_ms": 1200,
        "tokens_used": 2450,
        "cost_usd": 0.47
      }
    ]
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

### 2. Metrics and Analytics

#### Get Aggregated Metrics
```http
GET /metrics/aggregated?evaluation_id={id}&category={category}&metric={metric}
Authorization: Bearer <token>
```

**Query Parameters:**
- `evaluation_id` (optional): Filter by evaluation ID
- `category` (optional): Filter by metric category
- `metric` (optional): Filter by specific metric name

#### Get Time Series Metrics
```http
GET /metrics/timeseries?evaluation_id={id}&start_time={start}&end_time={end}&interval={interval}
Authorization: Bearer <token>
```

**Query Parameters:**
- `evaluation_id` (required): Evaluation ID
- `start_time` (optional): ISO 8601 start timestamp
- `end_time` (optional): ISO 8601 end timestamp
- `interval` (optional): Time interval (1m, 5m, 1h, 1d)

**Response:**
```json
{
  "success": true,
  "data": {
    "evaluation_id": "eval-uuid-string",
    "metrics": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "metric_category": "performance",
        "metric_name": "task_success_rate",
        "value": 0.75,
        "unit": "ratio"
      },
      {
        "timestamp": "2024-01-01T00:01:00Z",
        "metric_category": "efficiency",
        "metric_name": "execution_time",
        "value": 1200,
        "unit": "milliseconds"
      }
    ]
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

#### Get Performance Comparisons
```http
GET /metrics/comparison?agents={agent1,agent2}&benchmark={benchmark}&metrics={metrics}
Authorization: Bearer <token>
```

**Query Parameters:**
- `agents` (required): Comma-separated list of agent names
- `benchmark` (required): Benchmark type
- `metrics` (optional): Comma-separated list of metric names

#### Get Leaderboard Data
```http
GET /leaderboard?benchmark={benchmark}&metric={metric}&limit={limit}
Authorization: Bearer <token>
```

**Query Parameters:**
- `benchmark` (optional): Filter by benchmark type
- `metric` (optional): Sort by specific metric (default: task_success_rate)
- `limit` (optional): Maximum number of results (default: 10, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "benchmark": "swe-bench",
    "metric": "task_success_rate",
    "rankings": [
      {
        "rank": 1,
        "agent_name": "gpt-4-coder",
        "agent_version": "1.0.0",
        "value": 0.82,
        "evaluations": 5,
        "total_tasks": 500,
        "additional_metrics": {
          "average_execution_time": 1150,
          "average_cost": 0.52
        }
      },
      {
        "rank": 2,
        "agent_name": "claude-3-developer",
        "agent_version": "1.0.0",
        "value": 0.79,
        "evaluations": 3,
        "total_tasks": 300,
        "additional_metrics": {
          "average_execution_time": 1080,
          "average_cost": 0.48
        }
      }
    ]
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

### 3. Agent Management

#### List Available Agents
```http
GET /agents
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-uuid-1",
      "name": "gpt-4-coder",
      "version": "1.0.0",
      "type": "swe-bench",
      "capabilities": [
        "code_generation",
        "debugging",
        "test_writing",
        "repository_analysis"
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "agent-uuid-2",
      "name": "claude-3-gui",
      "version": "1.0.0",
      "type": "gui-automation",
      "capabilities": [
        "screen_perception",
        "mouse_control",
        "keyboard_input",
        "web_navigation"
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

#### Get Agent Details
```http
GET /agents/{agent_name}
Authorization: Bearer <token>
```

#### Register New Agent
```http
POST /agents
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "custom-agent",
  "version": "1.0.0",
  "type": "custom",
  "capabilities": ["custom_capability"],
  "configuration": {
    "model_name": "gpt-4",
    "model_parameters": {
      "temperature": 0.7,
      "max_tokens": 2048
    },
    "environment_requirements": {
      "docker_image": "python:3.9",
      "memory_mb": 2048,
      "cpu_cores": 2
    }
  }
}
```

### 4. Benchmark Management

#### List Available Benchmarks
```http
GET /benchmarks
Authorization: Bearer <token>
```

#### Get Benchmark Details
```http
GET /benchmarks/{benchmark_name}
Authorization: Bearer <token>
```

#### Get Benchmark Tasks
```http
GET /benchmarks/{benchmark_name}/tasks?limit={limit}&offset={offset}
Authorization: Bearer <token>
```

### 5. System Health and Status

#### Get System Status
```http
GET /system/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 86400,
    "components": {
      "database": {
        "status": "healthy",
        "response_time_ms": 15
      },
      "cache": {
        "status": "healthy",
        "hit_rate": 0.95
      },
      "orchestrator": {
        "status": "healthy",
        "active_evaluations": 3
      },
      "agents": {
        "status": "healthy",
        "available_agents": 12
      }
    },
    "metrics": {
      "total_evaluations": 1500,
      "active_evaluations": 3,
      "pending_evaluations": 8,
      "completed_evaluations": 1489
    }
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

#### Get Health Check
```http
GET /health
```

**Response (no auth required):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('wss://api.haseb.ai/api/v1/evaluations/{evaluation_id}/stream?token={jwt_token}');
```

### Message Format
All WebSocket messages follow this format:

```json
{
  "type": "event_type",
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z",
  "evaluation_id": "eval-uuid-string",
  "task_id": "task-uuid-string"
}
```

### Event Types

#### Evaluation Started
```json
{
  "type": "evaluation_started",
  "data": {
    "agent_name": "gpt-4-coder",
    "benchmark_type": "swe-bench",
    "total_tasks": 100
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "evaluation_id": "eval-uuid-string"
}
```

#### Task Started
```json
{
  "type": "task_started",
  "data": {
    "task_id": "task-001",
    "task_name": "Fix authentication bug",
    "task_type": "swe-bench"
  },
  "timestamp": "2024-01-01T00:01:00Z",
  "evaluation_id": "eval-uuid-string",
  "task_id": "task-001"
}
```

#### Metric Update
```json
{
  "type": "metric_update",
  "data": {
    "task_id": "task-001",
    "metric_category": "efficiency",
    "metric_name": "execution_time",
    "metric_value": 1200,
    "metric_unit": "milliseconds"
  },
  "timestamp": "2024-01-01T00:02:30Z",
  "evaluation_id": "eval-uuid-string",
  "task_id": "task-001"
}
```

#### Task Completed
```json
{
  "type": "task_completed",
  "data": {
    "task_id": "task-001",
    "task_name": "Fix authentication bug",
    "success": true,
    "execution_time_ms": 1200,
    "tokens_used": 2450,
    "cost_usd": 0.47,
    "final_metrics": {
      "performance": {
        "task_success_rate": 1.0
      },
      "efficiency": {
        "total_execution_time": 1200,
        "number_of_steps": 8
      },
      "cost": {
        "total_llm_tokens": 2450,
        "estimated_api_cost": 0.47
      }
    }
  },
  "timestamp": "2024-01-01T00:03:00Z",
  "evaluation_id": "eval-uuid-string",
  "task_id": "task-001"
}
```

#### Evaluation Completed
```json
{
  "type": "evaluation_completed",
  "data": {
    "summary": {
      "total_tasks": 100,
      "completed_tasks": 95,
      "successful_tasks": 78,
      "success_rate": 0.78,
      "total_execution_time": 125000,
      "average_tokens_per_task": 2500,
      "total_cost": 45.67
    },
    "final_metrics": {
      "performance": {
        "task_success_rate": 0.78,
        "completion_percentage": 0.95
      },
      "efficiency": {
        "total_execution_time": 125000,
        "latency_per_step": 125
      },
      "cost": {
        "total_llm_tokens": 237500,
        "estimated_api_cost": 45.67
      }
    }
  },
  "timestamp": "2024-01-01T01:30:00Z",
  "evaluation_id": "eval-uuid-string"
}
```

#### Error Event
```json
{
  "type": "error",
  "data": {
    "error_code": "AGENT_TIMEOUT",
    "error_message": "Agent execution timed out",
    "task_id": "task-005",
    "error_details": {
      "timeout_seconds": 1800,
      "actual_execution_time": 1800
    }
  },
  "timestamp": "2024-01-01T00:15:00Z",
  "evaluation_id": "eval-uuid-string",
  "task_id": "task-005"
}
```

## Error Codes

### HTTP Status Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (duplicate creation)
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service temporarily unavailable

### Application Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `AGENT_NOT_FOUND`: Specified agent does not exist
- `BENCHMARK_NOT_FOUND`: Specified benchmark does not exist
- `EVALUATION_NOT_FOUND`: Specified evaluation does not exist
- `AGENT_TIMEOUT`: Agent execution timed out
- `BENCHMARK_ERROR`: Benchmark configuration error
- `SYSTEM_ERROR`: Internal system error
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `RESOURCE_LIMIT_EXCEEDED`: Resource quota exceeded

## Rate Limiting

### Rate Limits by Endpoint
- `POST /evaluations`: 10 requests per minute
- `GET /evaluations`: 100 requests per minute
- `GET /metrics/*`: 200 requests per minute
- `GET /leaderboard`: 50 requests per minute
- WebSocket connections: 10 concurrent connections per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

### Pagination Parameters
- `limit`: Number of items per page (max: 100, default: 20)
- `offset`: Number of items to skip (default: 0)

### Pagination Response Format
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 150,
      "has_next": true,
      "has_prev": false
    }
  },
  "error": null,
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid-string",
    "version": "1.0.0"
  }
}
```

## Authentication

### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "iat": 1640995200,
  "exp": 1641081600,
  "iss": "haseb-api",
  "aud": "haseb-client",
  "permissions": [
    "evaluations:read",
    "evaluations:create",
    "metrics:read"
  ],
  "role": "user"
}
```

### Permission Scopes
- `evaluations:read`: Read evaluation data
- `evaluations:create`: Create new evaluations
- `evaluations:cancel`: Cancel running evaluations
- `metrics:read`: Read metrics and analytics
- `agents:read`: Read agent information
- `benchmarks:read`: Read benchmark information
- `system:admin`: Administrative access (admin role only)

## SDK Examples

### JavaScript/TypeScript SDK
```typescript
import { HASEBClient } from '@haseb/sdk';

const client = new HASEBClient({
  baseURL: 'https://api.haseb.ai/api/v1',
  token: 'your-jwt-token'
});

// Create evaluation
const evaluation = await client.evaluations.create({
  agent_name: 'gpt-4-coder',
  benchmark_type: 'swe-bench',
  configuration: {
    max_concurrent_tasks: 5
  }
});

// Get evaluation results
const results = await client.evaluations.getResults(evaluation.id);

// Subscribe to real-time updates
const ws = client.evaluations.subscribe(evaluation.id, {
  onTaskCompleted: (task) => {
    console.log(`Task ${task.id} completed:`, task.success);
  },
  onEvaluationCompleted: (results) => {
    console.log('Evaluation completed:', results.summary);
  }
});
```

### Python SDK
```python
from haseb_sdk import HASEBClient

client = HASEBClient(
    base_url='https://api.haseb.ai/api/v1',
    token='your-jwt-token'
)

# Create evaluation
evaluation = client.evaluations.create(
    agent_name='gpt-4-coder',
    benchmark_type='swe-bench',
    configuration={
        'max_concurrent_tasks': 5
    }
)

# Get evaluation results
results = client.evaluations.get_results(evaluation.id)

# Get leaderboard
leaderboard = client.metrics.get_leaderboard(
    benchmark='swe-bench',
    metric='task_success_rate'
)
```

This comprehensive API specification provides all the necessary information for integrating with the HASEB platform, including detailed endpoint documentation, data models, authentication requirements, and SDK examples for easy implementation.