# HASEB API Documentation

## Overview

The HASEB API provides a comprehensive REST interface for managing evaluations, agents, benchmarks, and metrics. Built with Express.js and following OpenAPI 3.0 standards, the API supports JSON Web Token (JWT) authentication, real-time WebSocket communication, and comprehensive error handling.

**Base URL**: `http://localhost:3000/api`
**API Version**: `1.0.0`
**Content-Type**: `application/json`

## Authentication

### JWT Authentication

All protected endpoints require a valid JWT token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

### Login Endpoint

```http
POST /api/auth/login
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "expiresIn": "24h"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_456"
  }
}
```

### Current User Endpoint

```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActive": "2024-01-15T10:30:00.000Z"
  }
}
```

## Agents

### List All Agents

```http
GET /api/agents
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `status` (optional): Filter by status (`active`, `idle`, `busy`, `error`)
- `type` (optional): Filter by agent type
- `limit` (optional): Maximum number of results (default: 50)
- `offset` (optional): Number of results to skip (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agent_123",
        "name": "Code Generation Agent",
        "type": "swe-bench",
        "status": "active",
        "capabilities": ["code-generation", "debugging", "refactoring"],
        "performance": {
          "taskSuccessRate": 0.85,
          "executionTime": 1200,
          "totalTokens": 5000,
          "estimatedCost": 0.15
        },
        "lastActive": "2024-01-15T10:30:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Get Agent Details

```http
GET /api/agents/{id}
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "agent_123",
    "name": "Code Generation Agent",
    "type": "swe-bench",
    "status": "active",
    "capabilities": ["code-generation", "debugging", "refactoring"],
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokens": 2000
    },
    "performance": {
      "taskSuccessRate": 0.85,
      "executionTime": 1200,
      "latencyPerStep": 50,
      "totalSteps": 24,
      "totalTokens": 5000,
      "estimatedCost": 0.15,
      "toolCallErrorRate": 0.05,
      "recoveryRate": 0.9,
      "toolSelectionAccuracy": 0.92,
      "parameterAccuracy": 0.88
    },
    "statistics": {
      "totalEvaluations": 150,
      "successfulEvaluations": 128,
      "averageScore": 85.2,
      "lastEvaluation": "2024-01-15T10:30:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Create Agent

```http
POST /api/agents
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "name": "New Agent",
  "type": "general-reasoning",
  "capabilities": ["reasoning", "analysis", "problem-solving"],
  "configuration": {
    "model": "gpt-4",
    "temperature": 0.2,
    "maxTokens": 3000
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "agent_456",
    "name": "New Agent",
    "type": "general-reasoning",
    "status": "idle",
    "capabilities": ["reasoning", "analysis", "problem-solving"],
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.2,
      "maxTokens": 3000
    },
    "createdAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### Update Agent

```http
PUT /api/agents/{id}
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "name": "Updated Agent Name",
  "configuration": {
    "temperature": 0.3,
    "maxTokens": 4000
  }
}
```

### Delete Agent

```http
DELETE /api/agents/{id}
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Agent deleted successfully"
  }
}
```

## Benchmarks

### List All Benchmarks

```http
GET /api/benchmarks
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `type` (optional): Filter by benchmark type (`swe-bench`, `gaia`, `osworld`, `webarena`, `agentbench`)
- `difficulty` (optional): Filter by difficulty (`easy`, `medium`, `hard`, `expert`)
- `isActive` (optional): Filter by active status
- `limit` (optional): Maximum number of results (default: 50)

**Response**:
```json
{
  "success": true,
  "data": {
    "benchmarks": [
      {
        "id": "benchmark_123",
        "name": "SWE-bench Verified",
        "type": "swe-bench",
        "description": "Real-world software engineering tasks from GitHub",
        "totalTasks": 2294,
        "completedTasks": 1850,
        "difficulty": "hard",
        "isActive": true,
        "lastRun": "2024-01-15T09:00:00.000Z",
        "averageSuccessRate": 0.72,
        "estimatedDuration": 1800
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

### Get Benchmark Details

```http
GET /api/benchmarks/{id}
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "benchmark_123",
    "name": "SWE-bench Verified",
    "type": "swe-bench",
    "description": "Real-world software engineering tasks from GitHub repositories",
    "totalTasks": 2294,
    "completedTasks": 1850,
    "difficulty": "hard",
    "isActive": true,
    "configuration": {
      "maxSteps": 100,
      "timeout": 3600,
      "allowedTools": ["bash", "editor", "git"],
      "evaluationMetrics": ["task_success_rate", "code_quality", "efficiency"]
    },
    "statistics": {
      "totalRuns": 500,
      "averageSuccessRate": 0.72,
      "averageCompletionTime": 2400,
      "averageCost": 2.50,
      "lastRun": "2024-01-15T09:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T09:00:00.000Z"
  }
}
```

### Run Benchmark

```http
POST /api/benchmarks/{id}/run
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "agentId": "agent_123",
  "configuration": {
    "maxSteps": 150,
    "timeout": 7200,
    "specificTasks": ["task_001", "task_002", "task_003"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "evaluationId": "eval_789",
    "agentId": "agent_123",
    "benchmarkId": "benchmark_123",
    "status": "pending",
    "estimatedDuration": 3600,
    "createdAt": "2024-01-15T11:00:00.000Z"
  }
}
```

## Evaluations

### Start New Evaluation

```http
POST /api/evaluations
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "agentId": "agent_123",
  "benchmarkId": "benchmark_456",
  "configuration": {
    "maxSteps": 100,
    "timeout": 3600,
    "enableMetrics": true,
    "customParameters": {
      "temperature": 0.1,
      "specificTasks": ["task_001", "task_002"]
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "eval_789",
    "agentId": "agent_123",
    "benchmarkId": "benchmark_456",
    "status": "pending",
    "configuration": {
      "maxSteps": 100,
      "timeout": 3600,
      "enableMetrics": true
    },
    "estimatedDuration": 2400,
    "createdAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### Get Evaluation Status

```http
GET /api/evaluations/{id}
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "eval_789",
    "agentId": "agent_123",
    "benchmarkId": "benchmark_456",
    "status": "running",
    "startTime": "2024-01-15T11:00:00.000Z",
    "configuration": {
      "maxSteps": 100,
      "timeout": 3600
    },
    "progress": {
      "currentStep": 25,
      "totalSteps": 100,
      "percentageComplete": 25,
      "estimatedTimeRemaining": 1800
    },
    "logs": [
      {
        "id": "log_001",
        "timestamp": "2024-01-15T11:00:30.000Z",
        "level": "info",
        "message": "Evaluation started",
        "source": "orchestrator"
      },
      {
        "id": "log_002",
        "timestamp": "2024-01-15T11:01:00.000Z",
        "level": "info",
        "message": "Step 1/100: Loading benchmark data",
        "source": "environment"
      }
    ],
    "currentMetrics": {
      "executionTime": 60,
      "tokensUsed": 1500,
      "estimatedCost": 0.05
    }
  }
}
```

### List Evaluations

```http
GET /api/evaluations
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `status` (optional): Filter by status (`pending`, `running`, `completed`, `failed`, `cancelled`)
- `agentId` (optional): Filter by agent ID
- `benchmarkId` (optional): Filter by benchmark ID
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)
- `limit` (optional): Maximum number of results (default: 50)
- `offset` (optional): Number of results to skip (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "evaluations": [
      {
        "id": "eval_789",
        "agentId": "agent_123",
        "agentName": "Code Generation Agent",
        "benchmarkId": "benchmark_456",
        "benchmarkName": "SWE-bench Verified",
        "status": "completed",
        "startTime": "2024-01-15T10:00:00.000Z",
        "endTime": "2024-01-15T10:45:00.000Z",
        "duration": 2700,
        "finalMetrics": {
          "taskSuccessRate": 0.85,
          "executionTime": 2400,
          "totalTokens": 8000,
          "estimatedCost": 0.25
        },
        "overallScore": 85.2
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    },
    "statistics": {
      "totalEvaluations": 150,
      "completedEvaluations": 120,
      "failedEvaluations": 10,
      "runningEvaluations": 5,
      "pendingEvaluations": 15,
      "averageSuccessRate": 0.78,
      "averageCompletionTime": 2100
    }
  }
}
```

### Cancel Evaluation

```http
POST /api/evaluations/{id}/cancel
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "eval_789",
    "status": "cancelled",
    "cancelledAt": "2024-01-15T11:30:00.000Z",
    "reason": "User requested cancellation"
  }
}
```

### Get Evaluation Results

```http
GET /api/evaluations/{id}/results
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "evaluationId": "eval_789",
    "status": "completed",
    "startTime": "2024-01-15T10:00:00.000Z",
    "endTime": "2024-01-15T10:45:00.000Z",
    "duration": 2700,
    "results": {
      "taskResults": [
        {
          "taskId": "task_001",
          "status": "completed",
          "success": true,
          "attempts": 1,
          "timeSpent": 300,
          "tokensUsed": 500,
          "score": 0.95
        }
      ],
      "summary": {
        "totalTasks": 10,
        "completedTasks": 8,
        "failedTasks": 2,
        "successRate": 0.8
      }
    },
    "metrics": {
      "performance": {
        "taskSuccessRate": 0.8,
        "executionTime": 2400,
        "latencyPerStep": 48,
        "totalSteps": 50
      },
      "efficiency": {
        "totalTokens": 8000,
        "estimatedCost": 0.25,
        "costPerTask": 0.025
      },
      "robustness": {
        "toolCallErrorRate": 0.05,
        "recoveryRate": 0.9
      },
      "quality": {
        "toolSelectionAccuracy": 0.92,
        "parameterAccuracy": 0.88
      }
    },
    "overallScore": 85.2
  }
}
```

## Metrics

### Get System Metrics

```http
GET /api/metrics/system
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `timeRange` (optional): Time range for metrics (`1h`, `24h`, `7d`, `30d`, default: `24h`)
- `granularity` (optional): Data granularity (`minute`, `hour`, `day`, default: `hour`)

**Response**:
```json
{
  "success": true,
  "data": {
    "timeRange": "24h",
    "granularity": "hour",
    "metrics": {
      "performance": {
        "averageTaskSuccessRate": 0.82,
        "averageExecutionTime": 2100,
        "totalEvaluations": 150,
        "successfulEvaluations": 123
      },
      "efficiency": {
        "totalTokensUsed": 150000,
        "totalEstimatedCost": 4.75,
        "averageTokensPerEvaluation": 1000,
        "averageCostPerEvaluation": 0.03
      },
      "system": {
        "cpuUsage": 45.2,
        "memoryUsage": 67.8,
        "activeConnections": 25,
        "databaseConnections": 8
      }
    },
    "timeline": [
      {
        "timestamp": "2024-01-15T00:00:00.000Z",
        "evaluations": 5,
        "successRate": 0.8,
        "averageCost": 0.03
      }
    ]
  }
}
```

### Get Agent Metrics

```http
GET /api/metrics/agents/{id}
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `timeRange` (optional): Time range for metrics (default: `30d`)
- `benchmarkId` (optional): Filter by benchmark ID

**Response**:
```json
{
  "success": true,
  "data": {
    "agentId": "agent_123",
    "timeRange": "30d",
    "performance": {
      "taskSuccessRate": 0.85,
      "executionTime": 1200,
      "latencyPerStep": 45,
      "totalSteps": 27
    },
    "efficiency": {
      "totalTokens": 50000,
      "estimatedCost": 1.50,
      "tokenEfficiency": 0.85,
      "costEfficiency": 0.78
    },
    "robustness": {
      "toolCallErrorRate": 0.04,
      "recoveryRate": 0.92,
      "errorTypes": {
        "api_errors": 0.02,
        "timeout_errors": 0.01,
        "parsing_errors": 0.01
      }
    },
    "quality": {
      "toolSelectionAccuracy": 0.91,
      "parameterAccuracy": 0.87,
      "outputRelevance": 0.89,
      "outputCompleteness": 0.86
    },
    "benchmarkPerformance": [
      {
        "benchmarkId": "benchmark_123",
        "benchmarkName": "SWE-bench",
        "successRate": 0.88,
        "averageScore": 88.5,
        "evaluations": 25
      }
    ]
  }
}
```

### Get Benchmark Metrics

```http
GET /api/metrics/benchmarks/{id}
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "benchmarkId": "benchmark_123",
    "benchmarkName": "SWE-bench Verified",
    "statistics": {
      "totalRuns": 500,
      "averageSuccessRate": 0.72,
      "averageCompletionTime": 2400,
      "averageCost": 2.50,
      "bestScore": 0.95,
      "worstScore": 0.45
    },
    "leaderboard": [
      {
        "rank": 1,
        "agentId": "agent_123",
        "agentName": "Code Generation Agent",
        "score": 0.95,
        "successRate": 0.95,
        "completionTime": 1800
      }
    ],
    "difficultyAnalysis": {
      "easy": { "successRate": 0.92, "count": 500 },
      "medium": { "successRate": 0.78, "count": 1000 },
      "hard": { "successRate": 0.65, "count": 700 },
      "expert": { "successRate": 0.45, "count": 94 }
    }
  }
}
```

## Orchestrator

### Get Orchestrator Status

```http
GET /api/orchestrator/status
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "running",
    "version": "1.0.0",
    "uptime": 86400,
    "currentEvaluations": 3,
    "maxConcurrentEvaluations": 10,
    "queueStatus": {
      "pending": 5,
      "running": 3,
      "completedToday": 45,
      "failedToday": 2
    },
    "resources": {
      "cpuUsage": 35.5,
      "memoryUsage": 65.2,
      "activeAgents": 8,
      "availableAgents": 2
    },
    "health": {
      "database": "healthy",
      "redis": "healthy",
      "fileSystem": "healthy",
      "externalApis": "healthy"
    }
  }
}
```

### Pause Orchestrator

```http
POST /api/orchestrator/pause
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "paused",
    "pausedAt": "2024-01-15T12:00:00.000Z",
    "reason": "Manual pause request"
  }
}
```

### Resume Orchestrator

```http
POST /api/orchestrator/resume
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "running",
    "resumedAt": "2024-01-15T12:05:00.000Z"
  }
}
```

## WebSocket API

### Connection

Connect to the WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

### Authentication

Send authentication message after connection:

```json
{
  "type": "auth",
  "token": "jwt_token_here"
}
```

### Subscribe to Evaluation Updates

```json
{
  "type": "subscribe",
  "channel": "evaluation",
  "evaluationId": "eval_789"
}
```

### Real-time Messages

**Evaluation Status Update**:
```json
{
  "type": "evaluation_update",
  "data": {
    "evaluationId": "eval_789",
    "status": "running",
    "progress": 45,
    "currentStep": "validating_results",
    "metrics": {
      "executionTime": 1200,
      "tokensUsed": 3500,
      "estimatedCost": 0.12
    }
  },
  "timestamp": "2024-01-15T11:30:00.000Z"
}
```

**System Status Update**:
```json
{
  "type": "system_update",
  "data": {
    "activeEvaluations": 5,
    "queueLength": 3,
    "systemLoad": 0.65
  },
  "timestamp": "2024-01-15T11:30:00.000Z"
}
```

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "agentId",
      "reason": "Agent not found"
    },
    "timestamp": "2024-01-15T11:30:00.000Z"
  },
  "metadata": {
    "requestId": "req_123",
    "timestamp": "2024-01-15T11:30:00.000Z"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `CONFLICT` | Resource conflict | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |

## Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Default Limit**: 100 requests per 15 minutes per IP
- **Authenticated Users**: 1000 requests per 15 minutes
- **Rate Limit Headers**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time (Unix timestamp)

## Pagination

List endpoints support pagination with these parameters:

- `limit`: Maximum number of results (1-100, default: 50)
- `offset`: Number of results to skip (default: 0)

**Response includes pagination metadata**:
```json
{
  "pagination": {
    "total": 250,
    "limit": 50,
    "offset": 0,
    "hasMore": true,
    "nextOffset": 50
  }
}
```

## Filtering and Sorting

Most list endpoints support filtering and sorting:

**Common Filter Parameters**:
- `status`: Filter by status
- `type`: Filter by type
- `startDate`: Filter by start date (ISO 8601)
- `endDate`: Filter by end date (ISO 8601)

**Sorting Parameters**:
- `sortBy`: Field to sort by
- `sortOrder`: `asc` or `desc` (default: `desc`)

Example:
```http
GET /api/evaluations?status=completed&startDate=2024-01-01T00:00:00.000Z&sortBy=createdAt&sortOrder=desc
```

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class HASEBClient {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async startEvaluation(agentId, benchmarkId, configuration = {}) {
    try {
      const response = await this.client.post('/evaluations', {
        agentId,
        benchmarkId,
        configuration
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start evaluation: ${error.message}`);
    }
  }

  async getEvaluationStatus(evaluationId) {
    const response = await this.client.get(`/evaluations/${evaluationId}`);
    return response.data;
  }

  async listAgents(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await this.client.get(`/agents?${params}`);
    return response.data;
  }
}

// Usage
const client = new HASEBClient('http://localhost:3000/api', 'your-jwt-token');

// Start an evaluation
const evaluation = await client.startEvaluation('agent_123', 'benchmark_456', {
  maxSteps: 100,
  timeout: 3600
});

console.log('Evaluation started:', evaluation.data.id);
```

### Python

```python
import requests
import json
from typing import Dict, Any, Optional

class HASEBClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def start_evaluation(self, agent_id: str, benchmark_id: str,
                        configuration: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Start a new evaluation"""
        url = f"{self.base_url}/evaluations"
        data = {
            "agentId": agent_id,
            "benchmarkId": benchmark_id,
            "configuration": configuration or {}
        }

        response = requests.post(url, json=data, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_evaluation_status(self, evaluation_id: str) -> Dict[str, Any]:
        """Get evaluation status"""
        url = f"{self.base_url}/evaluations/{evaluation_id}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def list_agents(self, **filters) -> Dict[str, Any]:
        """List agents with optional filters"""
        url = f"{self.base_url}/agents"
        response = requests.get(url, params=filters, headers=self.headers)
        response.raise_for_status()
        return response.json()

# Usage
client = HASEBClient('http://localhost:3000/api', 'your-jwt-token')

# Start an evaluation
evaluation = client.start_evaluation(
    agent_id='agent_123',
    benchmark_id='benchmark_456',
    configuration={
        'maxSteps': 100,
        'timeout': 3600
    }
)

print(f"Evaluation started: {evaluation['data']['id']}")
```

## Interactive API Documentation

For interactive API documentation and testing, visit:

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: http://localhost:3000/api-docs.json

The interactive documentation provides:
- Live API testing
- Request/response examples
- Authentication testing
- Parameter validation
- Response schemas

## Support

For API support and questions:
- **Documentation**: https://docs.haseb.org
- **Issues**: https://github.com/your-org/haseb/issues
- **Email**: api-support@haseb.org