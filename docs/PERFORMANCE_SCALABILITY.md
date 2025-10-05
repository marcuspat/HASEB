# HASEB Performance and Scalability Considerations

## Overview

This document outlines comprehensive performance and scalability considerations for the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) platform. It covers performance targets, scaling strategies, optimization techniques, and monitoring approaches to ensure the system can handle growing workloads efficiently.

## Performance Targets and SLAs

### Core Performance Metrics

#### Response Time Targets
| Endpoint | Target Response Time | 95th Percentile | 99th Percentile |
|----------|---------------------|-----------------|-----------------|
| API Gateway | <100ms | <150ms | <200ms |
| Evaluation Submission | <500ms | <1s | <2s |
| Dashboard Load | <200ms | <300ms | <500ms |
| Metrics Query | <300ms | <500ms | <1s |
| Real-time Updates | <50ms | <100ms | <150ms |
| Database Queries | <50ms | <100ms | <200ms |

#### Throughput Targets
| Metric | Target | Peak Capacity | Notes |
|--------|--------|--------------|-------|
| Concurrent Evaluations | 100 | 200 | With auto-scaling |
| API Requests/sec | 1,000 | 5,000 | With load balancing |
| WebSocket Connections | 1,000 | 2,500 | Real-time updates |
| Database Transactions/sec | 10,000 | 25,000 | With connection pooling |
| Cache Operations/sec | 100,000 | 500,000 | Redis cluster |

#### Availability Targets
| Component | Target Uptime | MTTR | RTO | RPO |
|-----------|---------------|------|-----|-----|
| API Services | 99.9% | 5 min | 10 min | 5 min |
| Database | 99.95% | 2 min | 5 min | 1 min |
| Cache | 99.99% | 1 min | 2 min | 0 |
| Dashboard | 99.9% | 5 min | 10 min | 5 min |

## Architecture Performance Analysis

### 1. Evaluation Orchestrator Performance

#### Bottleneck Analysis
```typescript
interface PerformanceBottleneck {
  component: string;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'queue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string[];
  metrics: {
    currentValue: number;
    targetValue: number;
    unit: string;
  };
}

const evaluationBottlenecks: PerformanceBottleneck[] = [
  {
    component: 'LangGraph State Machine',
    type: 'cpu',
    severity: 'medium',
    description: 'Complex workflow state management can be CPU intensive',
    mitigation: [
      'Implement state caching',
      'Optimize state transitions',
      'Use compiled workflows'
    ],
    metrics: {
      currentValue: 75,
      targetValue: 60,
      unit: 'cpu_percent'
    }
  },
  {
    component: 'Agent Coordinator',
    type: 'queue',
    severity: 'high',
    description: 'Task queue backlog during peak loads',
    mitigation: [
      'Implement priority queues',
      'Auto-scale worker pool',
      'Queue size monitoring'
    ],
    metrics: {
      currentValue: 50,
      targetValue: 10,
      unit: 'queue_length'
    }
  }
];
```

#### Performance Optimization Strategies

##### 1. Concurrent Execution Optimization
```typescript
class OptimizedOrchestrator {
  private evaluationPool: ThreadPool;
  private taskQueue: PriorityQueue<Task>;
  private resourcePool: ResourcePool;

  async executeEvaluation(request: EvaluationRequest): Promise<EvaluationResult> {
    // Parallel task execution with resource management
    const taskGroups = this.groupTasksByDependencies(request.tasks);
    const results: TaskResult[] = [];

    for (const group of taskGroups) {
      // Execute tasks in parallel within dependency groups
      const groupPromises = group.map(task =>
        this.executeTaskWithResourceManagement(task)
      );

      const groupResults = await Promise.allSettled(groupPromises);
      results.push(...this.processGroupResults(groupResults));
    }

    return this.aggregateResults(results);
  }

  private async executeTaskWithResourceManagement(task: Task): Promise<TaskResult> {
    // Acquire resources before execution
    const resources = await this.resourcePool.acquire(task.resourceRequirements);

    try {
      return await this.evaluationPool.execute(() =>
        this.executeTask(task, resources)
      );
    } finally {
      // Always release resources
      await this.resourcePool.release(resources);
    }
  }
}
```

##### 2. State Caching Strategy
```typescript
interface StateCache {
  get(workflowId: string, stateKey: string): Promise<EvaluationState | null>;
  set(workflowId: string, stateKey: string, state: EvaluationState, ttl?: number): Promise<void>;
  invalidate(workflowId: string): Promise<void>;
}

class RedisStateCache implements StateCache {
  constructor(private redis: Redis) {}

  async get(workflowId: string, stateKey: string): Promise<EvaluationState | null> {
    const key = `workflow:${workflowId}:state:${stateKey}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(workflowId: string, stateKey: string, state: EvaluationState, ttl: number = 3600): Promise<void> {
    const key = `workflow:${workflowId}:state:${stateKey}`;
    await this.redis.setex(key, ttl, JSON.stringify(state));
  }

  async invalidate(workflowId: string): Promise<void> {
    const pattern = `workflow:${workflowId}:state:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 2. Database Performance Optimization

#### Query Optimization

##### 1. Index Strategy
```sql
-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_evaluations_dashboard_queries
ON evaluations(status, benchmark_type, created_at DESC, success_rate)
WHERE status IN ('running', 'completed');

-- Partial indexes for performance-critical queries
CREATE INDEX CONCURRENTLY idx_tasks_performance_critical
ON tasks(evaluation_id, status, execution_time_ms)
WHERE status = 'completed' AND execution_time_ms > 300000;

-- Covering indexes to prevent table lookups
CREATE INDEX CONCURRENTLY idx_metrics_covering
ON metrics(task_id, metric_category, metric_name, metric_value, timestamp)
INCLUDE (id, metadata);

-- JSONB expression indexes
CREATE INDEX CONCURRENTLY idx_agents_capabilities
ON agents USING GIN((configuration->'capabilities'))
WHERE configuration ? 'capabilities';
```

##### 2. Query Optimization Examples
```typescript
class OptimizedQueries {
  // Efficient dashboard query with covering index
  async getDashboardEvaluations(filter: DashboardFilter): Promise<Evaluation[]> {
    const query = `
      SELECT e.id, e.agent_name, e.benchmark_type, e.status,
             e.created_at, e.success_rate, e.duration_seconds
      FROM evaluations e
      WHERE e.status = ANY($1)
        AND ($2::text IS NULL OR e.benchmark_type = $2)
        AND ($3::timestamp IS NULL OR e.created_at >= $3)
        AND ($4::timestamp IS NULL OR e.created_at <= $4)
      ORDER BY e.created_at DESC
      LIMIT $5 OFFSET $6
    `;

    return await this.db.query(query, [
      filter.statuses || ['running', 'completed'],
      filter.benchmarkType,
      filter.startDate,
      filter.endDate,
      filter.limit,
      filter.offset
    ]);
  }

  // Optimized metrics aggregation with materialized view
  async getAggregatedMetrics(evaluationId: string): Promise<AggregatedMetrics> {
    const query = `
      SELECT
        metric_category,
        json_agg(
          json_build_object(
            'name', metric_name,
            'value', AVG(metric_value),
            'unit', metric_unit
          )
        ) as metrics
      FROM aggregated_metrics_view
      WHERE evaluation_id = $1
      GROUP BY metric_category
    `;

    const results = await this.db.query(query, [evaluationId]);
    return this.formatAggregatedMetrics(results);
  }

  // Efficient time series query with time bucket
  async getTimeSeriesMetrics(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]> {
    const sql = `
      SELECT
        time_bucket($1, timestamp) as bucket,
        metric_category,
        metric_name,
        AVG(metric_value) as avg_value,
        COUNT(*) as sample_count
      FROM metrics
      WHERE timestamp BETWEEN $2 AND $3
        AND ($4::text[] IS NULL OR metric_category = ANY($4))
        AND ($5::text[] IS NULL OR metric_name = ANY($5))
      GROUP BY bucket, metric_category, metric_name
      ORDER BY bucket
    `;

    return await this.db.query(sql, [
      query.interval,
      query.startTime,
      query.endTime,
      query.categories,
      query.metricNames
    ]);
  }
}
```

#### Connection Pooling Optimization

##### PgBouncer Configuration
```ini
[databases]
haseb = host=localhost port=5432 dbname=haseb pool_size=20

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1

# Performance tuning
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 20
reserve_pool_timeout = 5
max_db_connections = 200
max_user_connections = 100

# Connection management
server_reset_query = DISCARD ALL
server_check_delay = 30
server_check_query = select 1
server_lifetime = 3600
server_idle_timeout = 600
server_connect_timeout = 15
server_login_retry = 2

# Advanced settings
track_extra_parameters = search_path application_name
ignore_startup_parameters = extra_float_digits
stats_users = stats, postgres
log_stats = 1
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

##### Application Connection Pool
```typescript
class OptimizedConnectionPool {
  private pool: Pool;
  private metrics: ConnectionPoolMetrics;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 50,                    // Maximum connections
      min: 10,                    // Minimum connections
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 5000,

      // Health check
      allowExitOnIdle: false,
      maxUses: 7500,              // Recreate connections after 7500 uses

      // Performance monitoring
      onConnect: (client) => {
        this.metrics.recordConnection();
      },
      onRemove: (client) => {
        this.metrics.recordDisconnection();
      }
    });
  }

  async query<T>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const start = performance.now();
    try {
      const result = await this.pool.query(sql, params);
      const duration = performance.now() - start;
      this.metrics.recordQuerySuccess(duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.metrics.recordQueryError(duration, error);
      throw error;
    }
  }

  async getPoolStats(): Promise<PoolStats> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxUsedCount: this.pool.maxUsedCount,
      averageQueryTime: this.metrics.getAverageQueryTime(),
      errorRate: this.metrics.getErrorRate()
    };
  }
}
```

### 3. Caching Performance Optimization

#### Multi-level Caching Strategy

##### 1. Application-level Caching
```typescript
interface CacheConfig {
  l1: {
    maxSize: number;      // Memory cache size
    ttl: number;         // Time to live in seconds
  };
  l2: {
    host: string;
    port: number;
    ttl: number;
    cluster?: boolean;
  };
  l3: {
    ttl: number;
    compression: boolean;
  };
}

class MultiLevelCache {
  private l1Cache: LRUCache<string, any>;
  private l2Cache: Redis;
  private l3Cache: CDNCache;

  constructor(private config: CacheConfig) {
    this.l1Cache = new LRUCache({
      max: config.l1.maxSize,
      ttl: config.l1.ttl * 1000
    });

    this.l2Cache = new Redis(config.l2);
    this.l3Cache = new CDNCache(config.l3);
  }

  async get<T>(key: string): Promise<T | null> {
    // L1 Cache (in-memory)
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      this.recordCacheHit('l1', key);
      return value;
    }

    // L2 Cache (Redis)
    value = await this.l2Cache.get(key);
    if (value) {
      const parsed = JSON.parse(value);
      this.l1Cache.set(key, parsed);
      this.recordCacheHit('l2', key);
      return parsed;
    }

    // L3 Cache (CDN)
    value = await this.l3Cache.get(key);
    if (value) {
      this.l1Cache.set(key, value);
      await this.l2Cache.setex(key, this.config.l2.ttl, JSON.stringify(value));
      this.recordCacheHit('l3', key);
      return value;
    }

    this.recordCacheMiss(key);
    return null;
  }

  async set<T>(key: string, value: T, customTtl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const ttl = customTtl || this.config.l1.ttl;

    // Set in all cache levels
    this.l1Cache.set(key, value);
    await this.l2Cache.setex(key, ttl, serialized);
    await this.l3Cache.set(key, value, ttl);
  }

  private recordCacheHit(level: string, key: string): void {
    // Metrics collection
    this.metrics.increment(`cache.hit.${level}`);
  }

  private recordCacheMiss(key: string): void {
    this.metrics.increment('cache.miss');
  }
}
```

##### 2. Intelligent Cache Warming
```typescript
class CacheWarmer {
  constructor(
    private cache: MultiLevelCache,
    private metricsRepository: IMetricsRepository,
    private evaluationRepository: IEvaluationRepository
  ) {}

  async warmLeaderboardCache(): Promise<void> {
    const popularBenchmarks = await this.getPopularBenchmarks();

    for (const benchmark of popularBenchmarks) {
      const leaderboard = await this.generateLeaderboard(benchmark);
      const cacheKey = `leaderboard:${benchmark}:default`;
      await this.cache.set(cacheKey, leaderboard, 300); // 5 minutes
    }
  }

  async warmEvaluationCache(evaluationId: string): Promise<void> {
    const evaluation = await this.evaluationRepository.getEvaluation(evaluationId);
    if (!evaluation) return;

    // Cache evaluation summary
    const summary = await this.generateEvaluationSummary(evaluationId);
    await this.cache.set(`evaluation:${evaluationId}:summary`, summary, 600);

    // Cache recent metrics
    const recentMetrics = await this.metricsRepository.queryMetrics({
      evaluationId,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 1000
    });

    await this.cache.set(`evaluation:${evaluationId}:recent_metrics`, recentMetrics, 300);
  }

  private async getPopularBenchmarks(): Promise<string[]> {
    // Query to find most frequently accessed benchmarks
    const query = `
      SELECT benchmark_type, COUNT(*) as access_count
      FROM evaluation_access_logs
      WHERE timestamp > NOW() - INTERVAL '7 days'
      GROUP BY benchmark_type
      ORDER BY access_count DESC
      LIMIT 10
    `;

    return await this.db.query(query);
  }
}
```

### 4. Real-time Performance Optimization

#### WebSocket Connection Management

##### 1. Connection Pooling
```typescript
class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private connectionMetrics: ConnectionMetrics;
  private connectionLimits: ConnectionLimits;

  async handleConnection(ws: WebSocket, userId: string, evaluationId: string): Promise<void> {
    // Check connection limits
    if (await this.exceedsConnectionLimit(userId)) {
      ws.close(1008, 'Connection limit exceeded');
      return;
    }

    const connectionId = this.generateConnectionId(userId, evaluationId);
    this.connections.set(connectionId, ws);

    // Setup connection monitoring
    this.setupConnectionMonitoring(ws, connectionId);

    // Join evaluation room for targeted updates
    await this.joinEvaluationRoom(connectionId, evaluationId);

    // Send initial state
    await this.sendInitialState(ws, evaluationId);

    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    ws.on('message', async (data) => {
      await this.handleMessage(ws, connectionId, data);
    });
  }

  private async sendInitialState(ws: WebSocket, evaluationId: string): Promise<void> {
    const evaluation = await this.getEvaluationStatus(evaluationId);
    const recentMetrics = await this.getRecentMetrics(evaluationId);

    ws.send(JSON.stringify({
      type: 'initial_state',
      data: { evaluation, recentMetrics }
    }));
  }

  private setupConnectionMonitoring(ws: WebSocket, connectionId: string): void {
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
        this.handleDisconnection(connectionId);
      }
    }, 30000); // Ping every 30 seconds

    ws.on('pong', () => {
      this.connectionMetrics.recordPong(connectionId);
    });
  }
}
```

##### 2. Efficient Event Broadcasting
```typescript
class EventBroadcaster {
  private rooms: Map<string, Set<string>> = new Map();
  private eventQueue: PriorityQueue<Event>;

  async broadcastToRoom(roomId: string, event: SystemEvent): Promise<void> {
    const connectionIds = this.rooms.get(roomId);
    if (!connectionIds || connectionIds.size === 0) return;

    // Batch event sending for performance
    const batchSize = 100;
    const connections = Array.from(connectionIds);

    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize);
      await this.sendEventBatch(batch, event);
    }
  }

  private async sendEventBatch(connectionIds: string[], event: SystemEvent): Promise<void> {
    const eventData = JSON.stringify(event);
    const promises = connectionIds.map(async (connectionId) => {
      const ws = this.getWebSocket(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(eventData);
        } catch (error) {
          this.handleSendError(connectionId, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  async joinRoom(connectionId: string, roomId: string): Promise<void> {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(connectionId);
  }

  async leaveRoom(connectionId: string, roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
}
```

## Horizontal Scaling Strategy

### 1. Microservices Scaling

#### Service Decomposition
```typescript
interface ServiceDefinition {
  name: string;
  version: string;
  replicas: number;
  resources: {
    cpu: string;
    memory: string;
  };
  scaling: {
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilization: number;
    targetMemoryUtilization: number;
  };
}

const services: ServiceDefinition[] = [
  {
    name: 'evaluation-orchestrator',
    version: '1.0.0',
    replicas: 3,
    resources: {
      cpu: '500m',
      memory: '1Gi'
    },
    scaling: {
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80
    }
  },
  {
    name: 'api-gateway',
    version: '1.0.0',
    replicas: 2,
    resources: {
      cpu: '200m',
      memory: '512Mi'
    },
    scaling: {
      minReplicas: 2,
      maxReplicas: 5,
      targetCPUUtilization: 80,
      targetMemoryUtilization: 75
    }
  },
  {
    name: 'metrics-collector',
    version: '1.0.0',
    replicas: 2,
    resources: {
      cpu: '300m',
      memory: '1Gi'
    },
    scaling: {
      minReplicas: 1,
      maxReplicas: 5,
      targetCPUUtilization: 75,
      targetMemoryUtilization: 85
    }
  }
];
```

#### Auto-scaling Configuration
```yaml
# Horizontal Pod Autoscaler configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: evaluation-orchestrator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: evaluation-orchestrator
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: evaluation_queue_length
      target:
        type: AverageValue
        averageValue: "5"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### 2. Database Scaling

#### Read Replica Configuration
```sql
-- Read replica setup
CREATE USER replica_user WITH REPLICATION ENCRYPTED PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE haseb TO replica_user;
GRANT USAGE ON SCHEMA public TO replica_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replica_user;

-- Monitoring replication lag
CREATE OR REPLACE FUNCTION replication_lag_seconds()
RETURNS BIGINT AS $$
BEGIN
  RETURN COALESCE(
    (EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::BIGINT),
    0
  );
END;
$$ LANGUAGE plpgsql;
```

#### Connection Pooling with PgBouncer
```ini
# PgBouncer for read-write splitting
[databases]
haseb_master = host=postgres-master port=5432 dbname=haseb
haseb_replica = host=postgres-replica port=5432 dbname=haseb

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0

# Pool configuration for different workloads
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 100

# Application-specific pools
admin_users = postgres
stats_users = stats

# Auto-reload configuration
autodb_idle_timeout = 3600
ignore_startup_parameters = extra_float_digits
```

### 3. Cache Scaling

#### Redis Cluster Configuration
```typescript
class RedisClusterManager {
  private cluster: RedisCluster;
  private shardCount: number;

  constructor(config: RedisClusterConfig) {
    this.shardCount = config.shardCount || 6;
    this.cluster = new RedisCluster([
      {
        host: config.hosts[0],
        port: 7000,
        password: config.password
      },
      // Additional cluster nodes
    ], {
      enableReadyCheck: true,
      maxRedirections: 16,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      keyPrefix: 'haseb:',
      redisOptions: {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        maxLoadingTimeout: 5000,
        lazyConnect: true
      }
    });
  }

  async get(key: string): Promise<string | null> {
    // Automatic sharding based on key
    const shardKey = this.getShardKey(key);
    return await this.cluster.get(shardKey);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const shardKey = this.getShardKey(key);
    if (ttl) {
      await this.cluster.setex(shardKey, ttl, value);
    } else {
      await this.cluster.set(shardKey, value);
    }
  }

  private getShardKey(key: string): string {
    // Hash key to determine shard
    const hash = this.hashKey(key);
    const shardIndex = hash % this.shardCount;
    return `${shardIndex}:${key}`;
  }

  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
```

## Performance Monitoring and Observability

### 1. Application Performance Monitoring (APM)

#### Metrics Collection
```typescript
class PerformanceMonitor {
  private metrics: Map<string, Metric> = new Map();
  private histogram: Map<string, Histogram> = new Map();

  recordExecutionTime(operation: string, duration: number): void {
    const key = `operation.${operation}.duration`;
    const histogram = this.histogram.get(key) || new Histogram();
    histogram.observe(duration);
    this.histogram.set(key, histogram);
  }

  recordCacheHit(cache: string, hit: boolean): void {
    this.metrics.set(`cache.${cache}.hits`, this.metrics.get(`cache.${cache}.hits`) || 0);
    this.metrics.set(`cache.${cache}.misses`, this.metrics.get(`cache.${cache}.misses`) || 0);

    if (hit) {
      this.metrics.set(`cache.${cache}.hits`, this.metrics.get(`cache.${cache}.hits`) + 1);
    } else {
      this.metrics.set(`cache.${cache}.misses`, this.metrics.get(`cache.${cache}.misses`) + 1);
    }
  }

  recordDatabaseQuery(query: string, duration: number, success: boolean): void {
    const key = `database.query.${query}`;

    // Record duration histogram
    const histogram = this.histogram.get(`${key}.duration`) || new Histogram();
    histogram.observe(duration);
    this.histogram.set(`${key}.duration`, histogram);

    // Record success/failure count
    const successKey = `${key}.success`;
    const errorKey = `${key}.error`;

    this.metrics.set(successKey, (this.metrics.get(successKey) || 0) + (success ? 1 : 0));
    this.metrics.set(errorKey, (this.metrics.get(errorKey) || 0) + (success ? 0 : 1));
  }

  getMetrics(): MetricSnapshot {
    const snapshot: MetricSnapshot = {
      timestamp: new Date(),
      gauges: {},
      counters: {},
      histograms: {}
    };

    // Collect gauge metrics
    for (const [key, value] of this.metrics) {
      if (typeof value === 'number') {
        snapshot.gauges[key] = value;
      }
    }

    // Collect histogram metrics
    for (const [key, histogram] of this.histogram) {
      snapshot.histograms[key] = {
        count: histogram.count,
        sum: histogram.sum,
        min: histogram.min,
        max: histogram.max,
        mean: histogram.mean,
        p50: histogram.percentile(0.5),
        p95: histogram.percentile(0.95),
        p99: histogram.percentile(0.99)
      };
    }

    return snapshot;
  }
}
```

#### Distributed Tracing
```typescript
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, any>;
  logs: LogEntry[];
  status: SpanStatus;
}

class TracingService {
  private activeSpans: Map<string, Span> = new Map();

  startSpan(operationName: string, parentSpanId?: string): Span {
    const span: Span = {
      traceId: parentSpanId ? this.getTraceId(parentSpanId) : this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId,
      operationName,
      startTime: performance.now(),
      tags: {},
      logs: [],
      status: { code: 'OK' }
    };

    this.activeSpans.set(span.spanId, span);
    return span;
  }

  finishSpan(spanId: string, tags?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = performance.now();
      if (tags) {
        span.tags = { ...span.tags, ...tags };
      }
      this.exportSpan(span);
      this.activeSpans.delete(spanId);
    }
  }

  private exportSpan(span: Span): void {
    // Export to tracing system (Jaeger, Zipkin, etc.)
    const duration = span.endTime ? span.endTime - span.startTime : 0;

    this.tracingExporter.export({
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      operationName: span.operationName,
      startTime: span.startTime,
      duration,
      tags: span.tags,
      status: span.status
    });
  }
}
```

### 2. Infrastructure Monitoring

#### Prometheus Metrics Export
```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

class PrometheusMetrics {
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private activeConnections: Gauge;
  private evaluationQueueLength: Gauge;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'haseb_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.httpRequestDuration = new Histogram({
      name: 'haseb_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });

    this.activeConnections = new Gauge({
      name: 'haseb_active_connections',
      help: 'Number of active connections'
    });

    this.evaluationQueueLength = new Gauge({
      name: 'haseb_evaluation_queue_length',
      help: 'Number of evaluations waiting in queue'
    });

    // Register all metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.evaluationQueueLength);
  }

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe({ method, route }, duration / 1000);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  setEvaluationQueueLength(length: number): void {
    this.evaluationQueueLength.set(length);
  }

  getMetrics(): string {
    return register.metrics();
  }
}
```

#### Health Check Endpoints
```typescript
class HealthCheckService {
  constructor(
    private database: DatabaseService,
    private cache: CacheService,
    private externalServices: ExternalServiceRegistry
  ) {}

  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
      this.checkExternalServices(),
      this.checkMemoryUsage(),
      this.checkDiskSpace()
    ]);

    return {
      status: this.determineOverallStatus(checks),
      timestamp: new Date(),
      checks: this.formatCheckResults(checks),
      version: process.env.APP_VERSION || 'unknown',
      uptime: process.uptime()
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      await this.database.query('SELECT 1');
      const duration = performance.now() - start;

      return {
        component: 'database',
        status: 'healthy',
        responseTime: duration,
        details: { queryTime: duration }
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'unhealthy',
        error: error.message,
        responseTime: performance.now() - start
      };
    }
  }

  private async checkCache(): Promise<ComponentHealth> {
    const start = performance.now();
    try {
      await this.cache.ping();
      const duration = performance.now() - start;

      return {
        component: 'cache',
        status: 'healthy',
        responseTime: duration,
        details: { pingTime: duration }
      };
    } catch (error) {
      return {
        component: 'cache',
        status: 'unhealthy',
        error: error.message,
        responseTime: performance.now() - start
      };
    }
  }

  private determineOverallStatus(checks: PromiseSettledResult<ComponentHealth>[]): 'healthy' | 'degraded' | 'unhealthy' {
    const healthy = checks.filter(c => c.status === 'fulfilled' && c.value.status === 'healthy').length;
    const total = checks.length;

    if (healthy === total) return 'healthy';
    if (healthy > 0) return 'degraded';
    return 'unhealthy';
  }
}
```

## Performance Testing Strategy

### 1. Load Testing

#### K6 Load Testing Script
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate below 10%
    errors: ['rate<0.1'],
  },
};

export default function () {
  // Test evaluation submission
  const evaluationResponse = http.post('http://localhost:3001/api/v1/evaluations', JSON.stringify({
    agent_name: 'test-agent',
    benchmark_type: 'swe-bench',
    configuration: {
      max_concurrent_tasks: 5,
      timeout_seconds: 1800
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + __ENV.API_TOKEN
    }
  });

  const evaluationSuccess = check(evaluationResponse, {
    'evaluation submission status is 201': (r) => r.status === 201,
    'evaluation response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!evaluationSuccess);

  if (evaluationResponse.status === 201) {
    const evaluationId = evaluationResponse.json('id');

    // Test evaluation status retrieval
    const statusResponse = http.get(`http://localhost:3001/api/v1/evaluations/${evaluationId}`, {
      headers: {
        'Authorization': 'Bearer ' + __ENV.API_TOKEN
      }
    });

    check(statusResponse, {
      'status response is 200': (r) => r.status === 200,
      'status response time < 200ms': (r) => r.timings.duration < 200,
    });

    // Test metrics retrieval
    const metricsResponse = http.get(`http://localhost:3001/api/v1/evaluations/${evaluationId}/results`, {
      headers: {
        'Authorization': 'Bearer ' + __ENV.API_TOKEN
      }
    });

    check(metricsResponse, {
      'metrics response is 200': (r) => r.status === 200,
      'metrics response time < 300ms': (r) => r.timings.duration < 300,
    });
  }

  sleep(1);
}
```

### 2. Stress Testing

#### Database Stress Test
```typescript
class DatabaseStressTest {
  constructor(private db: Database) {}

  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    const results: TestResult[] = [];
    const startTime = performance.now();

    // Concurrent insertion test
    const insertionPromises = Array.from({ length: config.concurrentInserts }, async (_, index) => {
      const start = performance.now();
      try {
        await this.insertTestEvaluation(index);
        const duration = performance.now() - start;
        return { success: true, duration, operation: 'insert' };
      } catch (error) {
        const duration = performance.now() - start;
        return { success: false, duration, operation: 'insert', error: error.message };
      }
    });

    const insertionResults = await Promise.all(insertionPromises);
    results.push(...insertionResults);

    // Query performance test
    const queryPromises = Array.from({ length: config.concurrentQueries }, async () => {
      const start = performance.now();
      try {
        await this.runComplexQuery();
        const duration = performance.now() - start;
        return { success: true, duration, operation: 'query' };
      } catch (error) {
        const duration = performance.now() - start;
        return { success: false, duration, operation: 'query', error: error.message };
      }
    });

    const queryResults = await Promise.all(queryPromises);
    results.push(...queryResults);

    const totalDuration = performance.now() - startTime;
    return this.analyzeResults(results, totalDuration, config);
  }

  private async insertTestEvaluation(index: number): Promise<void> {
    const query = `
      INSERT INTO evaluations (agent_name, benchmark_type, status, configuration)
      VALUES ($1, $2, $3, $4)
    `;

    await this.db.query(query, [
      `test-agent-${index}`,
      'swe-bench',
      'pending',
      { test_run: true, index }
    ]);
  }

  private async runComplexQuery(): Promise<any> {
    const query = `
      SELECT
        e.agent_name,
        AVG(m.metric_value) as avg_performance,
        COUNT(t.id) as total_tasks,
        e.created_at
      FROM evaluations e
      LEFT JOIN tasks t ON e.id = t.evaluation_id
      LEFT JOIN metrics m ON t.id = m.task_id
      WHERE e.created_at > NOW() - INTERVAL '1 hour'
        AND m.metric_category = 'performance'
      GROUP BY e.id, e.agent_name, e.created_at
      ORDER BY avg_performance DESC
      LIMIT 100
    `;

    return await this.db.query(query);
  }

  private analyzeResults(results: TestResult[], totalDuration: number, config: StressTestConfig): StressTestResult {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const insertions = results.filter(r => r.operation === 'insert');
    const queries = results.filter(r => r.operation === 'query');

    return {
      totalOperations: results.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      totalDuration,
      operationsPerSecond: results.length / (totalDuration / 1000),
      averageResponseTime: successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
      p95ResponseTime: this.calculatePercentile(successful.map(r => r.duration), 0.95),
      p99ResponseTime: this.calculatePercentile(successful.map(r => r.duration), 0.99),
      insertionPerformance: {
        total: insertions.length,
        successful: insertions.filter(r => r.success).length,
        averageTime: this.average(insertions.filter(r => r.success).map(r => r.duration))
      },
      queryPerformance: {
        total: queries.length,
        successful: queries.filter(r => r.success).length,
        averageTime: this.average(queries.filter(r => r.success).map(r => r.duration))
      },
      errorRate: failed.length / results.length,
      errors: failed.map(r => r.error).filter(Boolean)
    };
  }
}
```

## Conclusion

The performance and scalability strategy outlined above ensures that HASEB can handle growing workloads efficiently while maintaining high availability and user experience. Key points include:

1. **Multi-layered Optimization**: From application-level caching to database indexing
2. **Horizontal Scalability**: Auto-scaling services and database read replicas
3. **Comprehensive Monitoring**: Real-time metrics and distributed tracing
4. **Proactive Testing**: Regular load and stress testing to identify bottlenecks
5. **Performance Targets**: Clear SLAs and performance benchmarks

This comprehensive approach ensures the system can scale from handling 10 evaluations to 1000+ evaluations seamlessly while maintaining sub-second response times for dashboard interactions.