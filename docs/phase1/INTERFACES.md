# HASEB Interface Contracts

## Overview

This document defines all interface contracts for the HASEB system, providing the foundation for mock-first development and progressive integration. All interfaces are designed with TypeScript strict mode and include comprehensive type definitions.

## Core Evaluation Interfaces

### Evaluation Workflow Interfaces

```typescript
// src/types/evaluation.ts

export interface EvaluationRequest {
  id: string;
  agentName: string;
  benchmarkType: BenchmarkType;
  configuration: EvaluationConfiguration;
  metadata: EvaluationMetadata;
  createdAt: Date;
  requestedBy: string;
}

export interface EvaluationConfiguration {
  timeout: number;
  maxRetries: number;
  resources: ResourceAllocation;
  environment: EnvironmentConfig;
  metrics: MetricsConfiguration;
}

export interface ResourceAllocation {
  cpu: number;
  memory: number;
  storage: number;
  network: NetworkConfig;
}

export interface EvaluationResult {
  id: string;
  requestId: string;
  status: EvaluationStatus;
  metrics: EvaluationMetrics;
  artifacts: EvaluationArtifacts;
  duration: number;
  completedAt: Date;
  error?: EvaluationError;
}

export interface EvaluationStatus {
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  estimatedCompletion?: Date;
}

export interface EvaluationMetrics {
  performance: PerformanceMetrics;
  efficiency: EfficiencyMetrics;
  cost: CostMetrics;
  robustness: RobustnessMetrics;
  quality: QualityMetrics;
}

export interface EvaluationArtifacts {
  logs: string[];
  screenshots: string[];
  outputs: Record<string, any>;
  intermediateResults: Record<string, any>;
}

export interface EvaluationError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  stack?: string;
  context?: Record<string, any>;
}
```

### Benchmark Type Interfaces

```typescript
// src/types/benchmark.ts

export enum BenchmarkType {
  SWE_BENCH = 'swe-bench',
  GUI_AUTOMATION = 'gui-automation',
  GENERAL_REASONING = 'general-reasoning',
  CODE_GENERATION = 'code-generation',
  WEB_NAVIGATION = 'web-navigation',
  TOOL_USAGE = 'tool-usage'
}

export interface BenchmarkDefinition {
  id: string;
  type: BenchmarkType;
  name: string;
  description: string;
  version: string;
  tasks: BenchmarkTask[];
  environment: EnvironmentRequirements;
  evaluation: EvaluationCriteria;
}

export interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: string;
  input: TaskInput;
  expectedOutput: TaskOutput;
  constraints: TaskConstraints;
}

export interface TaskInput {
  type: 'text' | 'file' | 'url' | 'api' | 'database';
  data: any;
  format: string;
  size?: number;
}

export interface TaskOutput {
  type: 'text' | 'file' | 'json' | 'numeric' | 'boolean';
  expected: any;
  format: string;
  validationRules: ValidationRule[];
}

export interface TaskConstraints {
  timeLimit?: number;
  memoryLimit?: number;
  allowedTools: string[];
  forbiddenActions: string[];
  environment: EnvironmentConstraints;
}

export interface EvaluationCriteria {
  successMetrics: SuccessMetric[];
  weighting: MetricWeighting;
  passingThreshold: number;
  bonusCriteria: BonusCriterion[];
}
```

## Agent Execution Interfaces

### Agent Management Interfaces

```typescript
// src/types/agent.ts

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  version: string;
  capabilities: AgentCapability[];
  configuration: AgentConfiguration;
  status: AgentStatus;
  metrics: AgentMetrics;
}

export enum AgentType {
  EVALUATION_ORCHESTRATOR = 'evaluation-orchestrator',
  SWE_BENCH_AGENT = 'swe-bench-agent',
  GUI_AUTOMATION_AGENT = 'gui-automation-agent',
  GENERAL_REASONING_AGENT = 'general-reasoning-agent',
  ANALYTICS_AGENT = 'analytics-agent'
}

export interface AgentCapability {
  name: string;
  version: string;
  description: string;
  parameters: CapabilityParameter[];
  dependencies: string[];
}

export interface CapabilityParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
  description: string;
}

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'file'
  | 'url';

export interface AgentConfiguration {
  timeout: number;
  maxRetries: number;
  resources: ResourceAllocation;
  environment: EnvironmentConfig;
  logging: LoggingConfiguration;
  security: SecurityConfiguration;
}

export interface AgentStatus {
  state: 'idle' | 'busy' | 'error' | 'maintenance';
  currentTask?: string;
  health: HealthStatus;
  lastHeartbeat: Date;
}

export interface HealthStatus {
  cpu: number;
  memory: number;
  disk: number;
  network: NetworkStatus;
  errors: HealthError[];
}

export interface AgentMetrics {
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
}
```

### Agent Communication Interfaces

```typescript
// src/types/communication.ts

export interface AgentMessage {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  payload: MessagePayload;
  timestamp: Date;
  priority: MessagePriority;
  correlationId?: string;
}

export enum MessageType {
  TASK_ASSIGNMENT = 'task-assignment',
  TASK_UPDATE = 'task-update',
  TASK_COMPLETION = 'task-completion',
  ERROR_NOTIFICATION = 'error-notification',
  HEARTBEAT = 'heartbeat',
  STATUS_REQUEST = 'status-request',
  STATUS_RESPONSE = 'status-response',
  COORDINATION_REQUEST = 'coordination-request',
  COORDINATION_RESPONSE = 'coordination-response'
}

export interface MessagePayload {
  type: string;
  data: any;
  metadata: Record<string, any>;
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
  URGENT = 5
}

export interface CommunicationProtocol {
  protocol: 'http' | 'websocket' | 'message-queue' | 'grpc';
  endpoint: string;
  authentication: AuthenticationConfig;
  encryption: EncryptionConfig;
  reliability: ReliabilityConfig;
}
```

## Metrics Collection Interfaces

### Metrics Framework Interfaces

```typescript
// src/types/metrics.ts

export interface MetricsCollector {
  collect(type: MetricType, data: any): Promise<void>;
  getMetrics(filter: MetricsFilter): Promise<MetricData[]>;
  aggregate(metrics: MetricData[], aggregation: AggregationType): Promise<AggregatedMetrics>;
  export(format: ExportFormat): Promise<string>;
}

export enum MetricType {
  PERFORMANCE = 'performance',
  EFFICIENCY = 'efficiency',
  COST = 'cost',
  ROBUSTNESS = 'robustness',
  QUALITY = 'quality',
  CUSTOM = 'custom'
}

export interface MetricData {
  id: string;
  type: MetricType;
  name: string;
  value: number | string | boolean;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
  metadata: Record<string, any>;
}

export interface MetricsFilter {
  types?: MetricType[];
  names?: string[];
  timeRange?: TimeRange;
  tags?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export enum AggregationType {
  SUM = 'sum',
  AVERAGE = 'average',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count',
  PERCENTILE = 'percentile'
}

export interface AggregatedMetrics {
  type: MetricType;
  aggregation: AggregationType;
  result: number;
  count: number;
  timeRange: TimeRange;
  metadata: Record<string, any>;
}
```

### Performance Metrics Interfaces

```typescript
// src/types/performance-metrics.ts

export interface PerformanceMetrics {
  taskSuccessRate: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageCompletionTime: number;
  completionTimeDistribution: DistributionData;
  throughput: number;
  latency: LatencyMetrics;
}

export interface DistributionData {
  min: number;
  max: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  standardDeviation: number;
}

export interface LatencyMetrics {
  average: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface EfficiencyMetrics {
  totalExecutionTime: number;
  latencyPerStep: number;
  totalSteps: number;
  averageStepTime: number;
  resourceUtilization: ResourceUtilization;
  efficiency: number;
}

export interface ResourceUtilization {
  cpu: UtilizationData;
  memory: UtilizationData;
  disk: UtilizationData;
  network: NetworkUtilization;
}

export interface UtilizationData {
  average: number;
  peak: number;
  min: number;
  timeSeries: TimeSeriesData[];
}

export interface NetworkUtilization {
  bandwidth: UtilizationData;
  connections: number;
  requestsPerSecond: number;
  errorRate: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
}
```

## Database Persistence Interfaces

### Database Layer Interfaces

```typescript
// src/types/database.ts

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T>;
  healthCheck(): Promise<DatabaseHealth>;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  dataTypeId: number;
  tableID: number;
  columnID: number;
}

export interface Transaction {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseHealth {
  connected: boolean;
  responseTime: number;
  connectionCount: number;
  maxConnections: number;
  version: string;
  uptime: number;
  size: DatabaseSize;
}

export interface DatabaseSize {
  total: string;
  tables: Record<string, string>;
  indexes: Record<string, string>;
}

export interface Repository<T, ID = string> {
  create(entity: Partial<T>): Promise<T>;
  findById(id: ID): Promise<T | null>;
  find(filter: Partial<T>): Promise<T[]>;
  update(id: ID, updates: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
  count(filter?: Partial<T>): Promise<number>;
}
```

### Entity Interfaces

```typescript
// src/types/entities.ts

export interface EvaluationEntity {
  id: string;
  agent_name: string;
  benchmark_type: string;
  configuration: any;
  status: string;
  metrics: any;
  artifacts: any;
  duration: number;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  error?: any;
}

export interface AgentEntity {
  id: string;
  name: string;
  type: string;
  version: string;
  capabilities: any;
  configuration: any;
  status: string;
  metrics: any;
  created_at: Date;
  updated_at: Date;
}

export interface MetricEntity {
  id: string;
  evaluation_id: string;
  type: string;
  name: string;
  value: any;
  unit: string;
  timestamp: Date;
  tags: any;
  metadata: any;
  created_at: Date;
}

export interface BenchmarkEntity {
  id: string;
  type: string;
  name: string;
  description: string;
  version: string;
  definition: any;
  environment: any;
  evaluation_criteria: any;
  created_at: Date;
  updated_at: Date;
}
```

## External Service Interfaces

### API Integration Interfaces

```typescript
// src/types/external-services.ts

export interface ExternalService {
  name: string;
  version: string;
  endpoint: string;
  authentication: AuthenticationConfig;
  rateLimiting: RateLimitConfig;
  timeout: number;
  retryPolicy: RetryPolicy;
}

export interface AuthenticationConfig {
  type: 'none' | 'api-key' | 'oauth' | 'jwt' | 'basic';
  credentials?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  strategy: 'fixed-window' | 'sliding-window' | 'token-bucket';
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata: ResponseMetadata;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ResponseMetadata {
  statusCode: number;
  headers: Record<string, string>;
  responseTime: number;
  requestId?: string;
}
```

## Configuration and Environment Interfaces

### Configuration Management Interfaces

```typescript
// src/types/configuration.ts

export interface SystemConfiguration {
  database: DatabaseConfiguration;
  agents: AgentConfiguration;
  metrics: MetricsConfiguration;
  security: SecurityConfiguration;
  logging: LoggingConfiguration;
  development: DevelopmentConfiguration;
}

export interface DatabaseConfiguration {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: PoolConfiguration;
  migrations: MigrationConfiguration;
}

export interface PoolConfiguration {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface MigrationConfiguration {
  directory: string;
  tableName: string;
  autoRun: boolean;
}

export interface MetricsConfiguration {
  enabled: boolean;
  collectionInterval: number;
  retentionPeriod: number;
  aggregationRules: AggregationRule[];
  export: ExportConfiguration;
}

export interface AggregationRule {
  metricName: string;
  interval: string;
  functions: AggregationType[];
}

export interface ExportConfiguration {
  enabled: boolean;
  format: ExportFormat;
  destination: string;
  schedule: string;
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PROMETHEUS = 'prometheus',
  INFLUXDB = 'influxdb'
}
```

## Error Handling Interfaces

### Error Management Interfaces

```typescript
// src/types/errors.ts

export interface HASEBError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  stack?: string;
  timestamp: Date;
  correlationId?: string;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  NETWORK = 'network',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SYSTEM = 'system',
  BUSINESS = 'business'
}

export interface ErrorContext {
  component: string;
  operation: string;
  parameters?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface ErrorHandler {
  handle(error: HASEBError): Promise<void>;
  canHandle(error: Error): boolean;
  priority: number;
}

export interface ErrorRecoveryStrategy {
  type: RecoveryType;
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
  conditions: RecoveryCondition[];
}

export enum RecoveryType {
  RETRY = 'retry',
  CIRCUIT_BREAKER = 'circuit-breaker',
  FALLBACK = 'fallback',
  IGNORE = 'ignore',
  ESCALATE = 'escalate'
}

export interface RecoveryCondition {
  errorCode?: string;
  errorCategory?: ErrorCategory;
  errorSeverity?: ErrorSeverity;
}
```

## Security and Authentication Interfaces

### Security Framework Interfaces

```typescript
// src/types/security.ts

export interface SecurityConfiguration {
  authentication: AuthenticationConfiguration;
  authorization: AuthorizationConfiguration;
  encryption: EncryptionConfiguration;
  audit: AuditConfiguration;
}

export interface AuthenticationConfiguration {
  enabled: boolean;
  providers: AuthenticationProvider[];
  session: SessionConfiguration;
  password: PasswordConfiguration;
}

export interface AuthenticationProvider {
  type: 'local' | 'oauth' | 'ldap' | 'saml';
  name: string;
  configuration: Record<string, any>;
  enabled: boolean;
}

export interface SessionConfiguration {
  timeout: number;
  refreshThreshold: number;
  store: SessionStoreConfiguration;
}

export interface SessionStoreConfiguration {
  type: 'memory' | 'redis' | 'database';
  configuration: Record<string, any>;
}

export interface AuthorizationConfiguration {
  enabled: boolean;
  strategy: 'rbac' | 'abac' | 'hybrid';
  roles: RoleDefinition[];
  policies: PolicyDefinition[];
}

export interface RoleDefinition {
  name: string;
  permissions: string[];
  description: string;
}

export interface PolicyDefinition {
  name: string;
  rules: PolicyRule[];
  effect: 'allow' | 'deny';
}

export interface PolicyRule {
  attribute: string;
  operator: string;
  value: any;
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  attributes: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}
```

---

**These interface contracts provide the foundation for mock-first development, ensuring type safety and clear contracts between all components of the HASEB system.**