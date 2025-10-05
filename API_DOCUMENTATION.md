# HASEB API Documentation

This document provides comprehensive documentation for all HASEB API endpoints, including request/response formats, authentication requirements, and usage examples.

## 📚 Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Agents](#agents)
  - [Benchmarks](#benchmarks)
  - [Evaluations](#evaluations)
  - [Metrics](#metrics)
  - [Authentication](#authentication-endpoints)
  - [Orchestrator](#orchestrator)
- [WebSocket API](#websocket-api)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [Filtering and Sorting](#filtering-and-sorting)

## 🌐 Base Information

### Base URLs
- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`
- **API Documentation**: `/api-docs` (Swagger UI)

### Content Type
All API requests and responses use JSON format:
```
Content-Type: application/json
Accept: application/json
```

### API Version
Current API version: **v1.0.0**

## 🔐 Authentication

### JWT Bearer Token Authentication

For protected endpoints, include a JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-here",
    "expiresIn": 86400,
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

### Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token-here"
}
```

## 📤 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "metadata": {
    "timestamp": "2023-12-01T10:00:00.000Z",
    "requestId": "req-uuid-here",
    "version": "1.0.0"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "metadata": {
    "timestamp": "2023-12-01T10:00:00.000Z",
    "requestId": "req-uuid-here",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "validation error details"
    }
  },
  "metadata": {
    "timestamp": "2023-12-01T10:00:00.000Z",
    "requestId": "req-uuid-here",
    "version": "1.0.0"
  }
}
```

## ⚠️ Error Handling

### HTTP Status Codes

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no content returned |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `ALREADY_EXISTS` | Resource already exists | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Internal server error | 500 |

## 🛠️ API Endpoints

## Agents

### Get All Agents

```http
GET /api/agents
```

**Query Parameters:**
- `page` (integer, optional): Page number, default: 1
- `limit` (integer, optional): Items per page, default: 20, max: 100
- `type` (string, optional): Filter by agent type (`swe`, `gui`, `general`, `orchestrator`)
- `status` (string, optional): Filter by status (`active`, `inactive`, `training`, `error`)
- `sortBy` (string, optional): Sort field (`name`, `createdAt`, `lastActive`)
- `sortOrder` (string, optional): Sort order (`asc`, `desc`), default: `desc`

**Example Request:**
```http
GET /api/agents?page=1&limit=10&type=swe&status=active&sortBy=createdAt&sortOrder=desc
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "SWE-Bench Agent v1",
      "type": "swe",
      "description": "Software engineering task agent",
      "capabilities": [
        "code_generation",
        "debugging",
        "refactoring"
      ],
      "configuration": {
        "model": "gpt-4",
        "temperature": 0.1,
        "maxTokens": 4000
      },
      "status": "active",
      "createdAt": "2023-12-01T10:00:00.000Z",
      "updatedAt": "2023-12-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Get Agent by ID

```http
GET /api/agents/{id}
```

**Path Parameters:**
- `id` (string, required): Agent UUID

**Example Request:**
```http
GET /api/agents/550e8400-e29b-41d4-a716-446655440000
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "SWE-Bench Agent v1",
    "type": "swe",
    "description": "Software engineering task agent",
    "capabilities": ["code_generation", "debugging", "refactoring"],
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokens": 4000
    },
    "status": "active",
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Create Agent

```http
POST /api/agents
```

**Request Body:**
```json
{
  "name": "New Agent",
  "type": "swe",
  "description": "Agent description",
  "capabilities": ["code_generation", "debugging"],
  "configuration": {
    "model": "gpt-4",
    "temperature": 0.1,
    "maxTokens": 4000
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "New Agent",
    "type": "swe",
    "description": "Agent description",
    "capabilities": ["code_generation", "debugging"],
    "configuration": {
      "model": "gpt-4",
      "temperature": 0.1,
      "maxTokens": 4000
    },
    "status": "inactive",
    "createdAt": "2023-12-01T10:00:00.000Z",
    "updatedAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Update Agent

```http
PUT /api/agents/{id}
```

**Request Body:**
```json
{
  "name": "Updated Agent Name",
  "description": "Updated description",
  "configuration": {
    "temperature": 0.2
  },
  "status": "active"
}
```

### Update Agent Status

```http
PATCH /api/agents/{id}/status
```

**Request Body:**
```json
{
  "status": "active"
}
```

### Delete Agent

```http
DELETE /api/agents/{id}
```

**Response:** 204 No Content

### Search Agents

```http
GET /api/agents/search?q={query}
```

**Query Parameters:**
- `q` (string, required): Search query
- `page` (integer, optional): Page number, default: 1
- `limit` (integer, optional): Items per page, default: 20

### Get Agent Types

```http
GET /api/agents/types
```

**Example Response:**
```json
{
  "success": true,
  "data": ["swe", "gui", "general", "orchestrator"]
}
```

## Benchmarks

### Get All Benchmarks

```http
GET /api/benchmarks
```

**Query Parameters:**
- `page` (integer, optional): Page number, default: 1
- `limit` (integer, optional): Items per page, default: 20
- `type` (string, optional): Filter by benchmark type
- `active` (boolean, optional): Filter by active status

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "SWE-Bench Lite",
      "type": "swe-bench",
      "description": "Software engineering benchmark dataset",
      "dataset": "swe-bench-lite-v1",
      "evaluationCriteria": [
        "functional_correctness",
        "code_quality",
        "efficiency"
      ],
      "configuration": {
        "timeout": 3600,
        "maxTasks": 100
      },
      "isActive": true,
      "createdAt": "2023-12-01T10:00:00.000Z",
      "updatedAt": "2023-12-01T10:00:00.000Z"
    }
  ]
}
```

### Get Benchmark by ID

```http
GET /api/benchmarks/{id}
```

### Create Benchmark

```http
POST /api/benchmarks
```

**Request Body:**
```json
{
  "name": "Custom Benchmark",
  "type": "custom",
  "description": "Custom evaluation benchmark",
  "dataset": "custom-dataset-v1",
  "evaluationCriteria": ["accuracy", "efficiency"],
  "configuration": {
    "timeout": 1800,
    "maxTasks": 50
  },
  "isActive": true
}
```

### Update Benchmark

```http
PUT /api/benchmarks/{id}
```

### Delete Benchmark

```http
DELETE /api/benchmarks/{id}
```

## Evaluations

### Get All Evaluations

```http
GET /api/evaluations
```

**Query Parameters:**
- `page` (integer, optional): Page number, default: 1
- `limit` (integer, optional): Items per page, default: 20
- `agentId` (string, optional): Filter by agent ID
- `benchmarkId` (string, optional): Filter by benchmark ID
- `status` (string, optional): Filter by status (`pending`, `running`, `completed`, `failed`, `cancelled`)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "evaluations": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "agentId": "550e8400-e29b-41d4-a716-446655440000",
        "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
        "status": "completed",
        "startTime": "2023-12-01T10:00:00.000Z",
        "endTime": "2023-12-01T10:30:00.000Z",
        "configuration": {
          "maxSteps": 100,
          "timeout": 3600
        },
        "metrics": {
          "performance": {
            "taskSuccessRate": 0.85,
            "executionTime": 1800
          },
          "efficiency": {
            "totalSteps": 45,
            "totalTokens": 15000
          },
          "cost": {
            "estimatedCost": 0.25
          }
        },
        "logs": [
          {
            "id": "log-uuid",
            "timestamp": "2023-12-01T10:00:00.000Z",
            "level": "info",
            "message": "Evaluation started",
            "source": "orchestrator"
          }
        ],
        "createdAt": "2023-12-01T10:00:00.000Z",
        "updatedAt": "2023-12-01T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### Get Evaluation by ID

```http
GET /api/evaluations/{id}
```

### Create Evaluation

```http
POST /api/evaluations
```

**Request Body:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
  "configuration": {
    "maxSteps": 100,
    "timeout": 3600,
    "customParameters": {
      "temperature": 0.1
    }
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440001",
    "agentId": "550e8400-e29b-41d4-a716-446655440000",
    "benchmarkId": "660e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "configuration": {
      "maxSteps": 100,
      "timeout": 3600
    },
    "logs": [],
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### Update Evaluation Status

```http
PATCH /api/evaluations/{id}/status
```

**Request Body:**
```json
{
  "status": "running",
  "startTime": "2023-12-01T10:00:00.000Z"
}
```

### Update Evaluation Metrics

```http
PUT /api/evaluations/{id}/metrics
```

**Request Body:**
```json
{
  "performance": {
    "taskSuccessRate": 0.85,
    "executionTime": 1800,
    "firstSuccessTime": 800
  },
  "efficiency": {
    "totalSteps": 45,
    "latencyPerStep": 40,
    "totalTokens": 15000
  },
  "cost": {
    "estimatedCost": 0.25,
    "costPerTask": 0.05
  },
  "robustness": {
    "toolCallErrorRate": 0.12,
    "recoveryRate": 0.89
  },
  "quality": {
    "toolSelectionAccuracy": 0.92,
    "parameterAccuracy": 0.88
  }
}
```

### Add Log to Evaluation

```http
POST /api/evaluations/{id}/logs
```

**Request Body:**
```json
{
  "log": {
    "level": "info",
    "message": "Task completed successfully",
    "source": "agent",
    "metadata": {
      "taskId": "task-uuid",
      "duration": 1200
    }
  }
}
```

### Delete Evaluation

```http
DELETE /api/evaluations/{id}
```

## Metrics

### Get Dashboard Metrics

```http
GET /api/metrics/dashboard
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalEvaluations": 150,
      "activeEvaluations": 5,
      "totalAgents": 12,
      "totalBenchmarks": 8
    },
    "performance": {
      "averageSuccessRate": 0.78,
      "averageExecutionTime": 1450,
      "totalTasksCompleted": 1250
    },
    "cost": {
      "totalCost": 25.50,
      "averageCostPerEvaluation": 0.17
    },
    "recentActivity": [
      {
        "id": "eval-uuid",
        "agentName": "SWE Agent",
        "benchmarkName": "SWE-Bench",
        "status": "completed",
        "timestamp": "2023-12-01T10:00:00.000Z"
      }
    ]
  }
}
```

### Get Performance Analytics

```http
GET /api/metrics/performance
```

**Query Parameters:**
- `timeRange` (string, optional): Time range (`1h`, `24h`, `7d`, `30d`), default: `24h`
- `agentId` (string, optional): Filter by agent ID
- `benchmarkId` (string, optional): Filter by benchmark ID

### Get Leaderboard Data

```http
GET /api/metrics/leaderboard
```

**Query Parameters:**
- `benchmarkId` (string, optional): Filter by benchmark ID
- `timeRange` (string, optional): Time range, default: `7d`
- `limit` (integer, optional): Number of entries, default: 10

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "agent": {
        "id": "agent-uuid",
        "name": "Elite SWE Agent",
        "type": "swe"
      },
      "benchmark": {
        "id": "benchmark-uuid",
        "name": "SWE-Bench Lite"
      },
      "metrics": {
        "taskSuccessRate": 0.92,
        "averageExecutionTime": 1200,
        "estimatedCost": 0.18
      },
      "overallScore": 94.5,
      "trend": "up"
    }
  ]
}
```

### Get Metrics for Evaluation

```http
GET /api/metrics/evaluations/{evaluationId}
```

### Get Metrics for Agent

```http
GET /api/metrics/agents/{agentId}
```

**Query Parameters:**
- `timeRange` (string, optional): Time range, default: `30d`
- `benchmarkId` (string, optional): Filter by benchmark ID

## Authentication Endpoints

### Login

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Register

```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "fullName": "New User",
  "password": "password123"
}
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Refresh Token

```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh-token-here"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## Orchestrator

### Start Evaluation Workflow

```http
POST /api/orchestrator/evaluations/start
```

**Request Body:**
```json
{
  "agentId": "agent-uuid",
  "benchmarkId": "benchmark-uuid",
  "configuration": {
    "maxSteps": 100,
    "timeout": 3600,
    "priority": "high"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "evaluationId": "eval-uuid",
    "status": "queued",
    "estimatedStartTime": "2023-12-01T10:00:00.000Z",
    "queuePosition": 1
  }
}
```

### Stop Evaluation

```http
POST /api/orchestrator/evaluations/{id}/stop
```

### Get Evaluation Queue Status

```http
GET /api/orchestrator/queue/status
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "queueLength": 3,
    "runningEvaluations": 2,
    "maxConcurrent": 5,
    "averageWaitTime": 300,
    "queueItems": [
      {
        "evaluationId": "eval-uuid",
        "agentName": "Agent 1",
        "benchmarkName": "Benchmark 1",
        "priority": "high",
        "queuedAt": "2023-12-01T09:55:00.000Z",
        "estimatedStart": "2023-12-01T10:00:00.000Z"
      }
    ]
  }
}
```

### Get System Status

```http
GET /api/orchestrator/status
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "activeAgents": 3,
    "runningEvaluations": 2,
    "queueLength": 1,
    "systemResources": {
      "cpuUsage": 0.65,
      "memoryUsage": 0.78,
      "diskUsage": 0.45
    },
    "lastHealthCheck": "2023-12-01T10:00:00.000Z"
  }
}
```

## 🔌 WebSocket API

### Connection

Connect to WebSocket endpoint:
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Authentication

Send authentication message after connection:
```javascript
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));
```

### Subscribe to Events

Subscribe to evaluation updates:
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'evaluations',
  evaluationId: 'eval-uuid' // Optional: specific evaluation
}));
```

Subscribe to system updates:
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'system'
}));
```

### Message Format

**Evaluation Update:**
```json
{
  "type": "evaluation_update",
  "data": {
    "evaluationId": "eval-uuid",
    "status": "running",
    "progress": 0.65,
    "currentTask": "Task 3/10",
    "metrics": {
      "executionTime": 1200,
      "tasksCompleted": 6
    },
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

**System Status:**
```json
{
  "type": "system_status",
  "data": {
    "status": "healthy",
    "activeEvaluations": 2,
    "queueLength": 1,
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

**Error Message:**
```json
{
  "type": "error",
  "data": {
    "code": "SUBSCRIPTION_FAILED",
    "message": "Failed to subscribe to channel",
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

## 🚦 Rate Limiting

### Default Limits
- **Window**: 15 minutes
- **Requests**: 100 per IP (development), 50 per IP (production)
- **Authenticated Users**: 200 requests per window
- **WebSocket Connections**: 10 per IP

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1701422400
```

### Rate Limit Exceeded Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later.",
    "retryAfter": 900
  }
}
```

## 📄 Pagination

### Standard Pagination Parameters
- `page` (integer): Page number, starting from 1
- `limit` (integer): Items per page, default: 20, max: 100

### Pagination Response Headers
```http
X-Total-Count: 150
X-Page: 1
X-Total-Pages: 8
X-Per-Page: 20
```

## 🔍 Filtering and Sorting

### Common Filter Parameters
- `status`: Filter by status
- `type`: Filter by type
- `active`: Filter by active status
- `dateFrom`: Filter by date range (ISO 8601)
- `dateTo`: Filter by date range (ISO 8601)

### Common Sort Parameters
- `sortBy`: Field to sort by
- `sortOrder`: Sort order (`asc`, `desc`)

### Example Filtering
```http
GET /api/evaluations?status=completed&dateFrom=2023-11-01T00:00:00Z&dateTo=2023-12-01T00:00:00Z&sortBy=endTime&sortOrder=desc
```

## 🧪 API Testing Examples

### Using curl

**Create Agent:**
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "type": "swe",
    "description": "Test agent for API documentation"
  }'
```

**Start Evaluation:**
```bash
curl -X POST http://localhost:3000/api/evaluations \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-uuid-here",
    "benchmarkId": "benchmark-uuid-here",
    "configuration": {
      "maxSteps": 10
    }
  }'
```

### Using JavaScript

```javascript
// Create and start evaluation
async function startEvaluation() {
  const response = await fetch('http://localhost:3000/api/evaluations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: 'agent-uuid',
      benchmarkId: 'benchmark-uuid',
      configuration: { maxSteps: 100 }
    })
  });

  const result = await response.json();
  console.log('Evaluation started:', result.data.evaluationId);
}

// Get evaluation status
async function getEvaluationStatus(evaluationId) {
  const response = await fetch(`http://localhost:3000/api/evaluations/${evaluationId}`);
  const result = await response.json();
  return result.data;
}
```

### Using Python

```python
import requests

# Create agent
agent_data = {
    "name": "Python Test Agent",
    "type": "swe",
    "description": "Test agent created via Python"
}

response = requests.post(
    "http://localhost:3000/api/agents",
    json=agent_data
)

agent = response.json()['data']
print(f"Created agent: {agent['id']}")

# Start evaluation
evaluation_data = {
    "agentId": agent['id'],
    "benchmarkId": "benchmark-uuid",
    "configuration": {"maxSteps": 50}
}

response = requests.post(
    "http://localhost:3000/api/evaluations",
    json=evaluation_data
)

evaluation = response.json()['data']
print(f"Started evaluation: {evaluation['id']}")
```

## 📚 Additional Resources

- **Interactive API Documentation**: http://localhost:3000/api-docs
- **OpenAPI Specification**: http://localhost:3000/api-docs/json
- **Postman Collection**: Available in the repository
- **SDK Examples**: See `/examples/` directory
- **Integration Tests**: See `/tests/integration/api.test.ts`

For more information about the HASEB system, see the [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md) files.