# HASEB Component Interface Definitions

## Overview

This document defines the comprehensive interface specifications for all components in the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) platform. These interfaces ensure consistent communication, modularity, and testability across the system.

## Core Interface Philosophy

### Design Principles
1. **Interface Segregation**: Clients should not depend on interfaces they don't use
2. **Dependency Inversion**: High-level modules should not depend on low-level modules
3. **Open/Closed Principle**: Open for extension, closed for modification
4. **Liskov Substitution**: Subtypes must be substitutable for their base types
5. **Consistency**: Unified patterns across all interfaces

### Naming Conventions
- **Interfaces**: PascalCase with `I` prefix (e.g., `IEvaluationOrchestrator`)
- **Types**: PascalCase (e.g., `EvaluationResult`)
- **Methods**: camelCase starting with verb (e.g., `executeTask`)
- **Events**: Past tense (e.g., `taskCompleted`)

## Core System Interfaces

### 1. Core Abstractions

#### IEvaluationOrchestrator
Central orchestration interface for managing evaluation workflows.

```typescript
interface IEvaluationOrchestrator {
  /**
   * Initialize the orchestrator with configuration
   */
  initialize(config: OrchestratorConfig): Promise<void>;

  /**
   * Execute a complete evaluation workflow
   */
  executeEvaluation(request: EvaluationRequest): Promise<EvaluationResult>;

  /**
   * Get current status of a running evaluation
   */
  getEvaluationStatus(evaluationId: string): Promise<EvaluationStatus>;

  /**
   * Cancel a running evaluation
   */
  cancelEvaluation(evaluationId: string, reason?: string): Promise<void>;

  /**
   * Get list of all evaluations with filtering
   */
  listEvaluations(filter: EvaluationFilter): Promise<EvaluationList>;

  /**
   * Subscribe to real-time evaluation events
   */
  subscribeToEvents(evaluationId: string, listener: EventListener): Promise<Subscription>;
}

interface OrchestratorConfig {
  maxConcurrentEvaluations: number;
  defaultTimeoutMs: number;
  retryPolicy: RetryPolicy;
  metricsCollector: IMetricsCollector;
  agentFactory: IAgentFactory;
  eventBus: IEventBus;
}

interface EvaluationRequest {
  agent: AgentConfiguration;
  benchmark: BenchmarkConfiguration;
  evaluationConfig: EvaluationConfiguration;
  metadata?: Record<string, any>;
}

interface EvaluationResult {
  evaluationId: string;
  status: EvaluationStatus;
  startTime: Date;
  endTime?: Date;
  summary: EvaluationSummary;
  tasks: TaskResult[];
  metrics: AggregatedMetrics;
  error?: EvaluationError;
}

interface EvaluationSummary {
  totalTasks: number;
  completedTasks: number;
  successfulTasks: number;
  failedTasks: number;
  successRate: number;
  totalDurationMs: number;
  totalCostUsd: number;
  averageTokensPerTask: number;
}
```

#### IAgentFactory
Factory interface for creating and managing evaluation agents.

```typescript
interface IAgentFactory {
  /**
   * Create an agent instance for evaluation
   */
  createAgent(config: AgentConfiguration): Promise<IEvaluationAgent>;

  /**
   * Validate agent configuration
   */
  validateConfiguration(config: AgentConfiguration): Promise<ValidationResult>;

  /**
   * Get available agent types
   */
  getAvailableAgentTypes(): Promise<AgentTypeInfo[]>;

  /**
   * Get agent capabilities by type
   */
  getAgentCapabilities(agentType: AgentType): Promise<string[]>;

  /**
   * Cleanup agent resources
   */
  cleanupAgent(agentId: string): Promise<void>;
}

interface AgentConfiguration {
  id: string;
  name: string;
  version: string;
  type: AgentType;
  model: ModelConfiguration;
  tools: ToolConfiguration[];
  environment: EnvironmentConfiguration;
  capabilities: string[];
  parameters: AgentParameters;
}

interface ModelConfiguration {
  provider: ModelProvider;
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
  parameters: ModelParameters;
}

interface ModelParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

interface AgentParameters {
  maxRetries: number;
  timeoutMs: number;
  thinkingSteps: boolean;
  verboseLogging: boolean;
  costTracking: boolean;
}
```

#### IMetricsCollector
Interface for collecting and processing evaluation metrics.

```typescript
interface IMetricsCollector {
  /**
   * Record a metric value
   */
  recordMetric(metric: MetricData): Promise<void>;

  /**
   * Record multiple metrics in batch
   */
  recordMetrics(metrics: MetricData[]): Promise<void>;

  /**
   * Get aggregated metrics for an evaluation
   */
  getAggregatedMetrics(evaluationId: string): Promise<AggregatedMetrics>;

  /**
   * Get time series metrics
   */
  getTimeSeriesMetrics(query: TimeSeriesQuery): Promise<TimeSeriesData[]>;

  /**
   * Calculate performance comparisons
   */
  compareAgents(query: ComparisonQuery): Promise<ComparisonResult>;

  /**
   * Generate leaderboard data
   */
  generateLeaderboard(criteria: LeaderboardCriteria): Promise<LeaderboardData>;

  /**
   * Export metrics data
   */
  exportData(query: ExportQuery): Promise<ExportResult>;
}

interface MetricData {
  evaluationId: string;
  taskId: string;
  category: MetricCategory;
  name: string;
  value: number;
  unit?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AggregatedMetrics {
  performance: PerformanceMetrics;
  efficiency: EfficiencyMetrics;
  cost: CostMetrics;
  robustness: RobustnessMetrics;
  quality: QualityMetrics;
  custom?: Record<string, any>;
}

interface TimeSeriesQuery {
  evaluationId?: string;
  agentName?: string;
  benchmarkType?: string;
  metricNames: string[];
  startTime: Date;
  endTime: Date;
  interval: TimeInterval;
}
```

#### IEventBus
Interface for system-wide event communication.

```typescript
interface IEventBus {
  /**
   * Publish an event to all subscribers
   */
  publish(event: SystemEvent): Promise<void>;

  /**
   * Subscribe to specific event types
   */
  subscribe(eventTypes: string[], handler: EventHandler): Promise<Subscription>;

  /**
   * Subscribe to all events
   */
  subscribeToAll(handler: EventHandler): Promise<Subscription>;

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Get event history
   */
  getEventHistory(query: EventHistoryQuery): Promise<SystemEvent[]>;
}

interface SystemEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, any>;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
}

interface EventHandler {
  (event: SystemEvent): Promise<void>;
}

interface Subscription {
  id: string;
  unsubscribe(): Promise<void>;
}
```

### 2. Evaluation Agent Interfaces

#### IEvaluationAgent
Base interface for all evaluation agents.

```typescript
interface IEvaluationAgent {
  /**
   * Initialize the agent with environment
   */
  initialize(environment: IAgentEnvironment): Promise<void>;

  /**
   * Execute a specific task
   */
  executeTask(task: Task): Promise<TaskResult>;

  /**
   * Get agent status and health
   */
  getStatus(): Promise<AgentStatus>;

  /**
   * Get agent capabilities
   */
  getCapabilities(): Promise<string[]>;

  /**
   * Configure agent parameters
   */
  configure(config: AgentConfiguration): Promise<void>;

  /**
   * Cleanup agent resources
   */
  cleanup(): Promise<void>;
}

interface IAgentEnvironment {
  id: string;
  type: EnvironmentType;
  tools: ITool[];
  resources: IResource[];
  configuration: EnvironmentConfiguration;
  setup(): Promise<void>;
  execute(agent: IEvaluationAgent, task: Task): Promise<ExecutionResult>;
  cleanup(): Promise<void>;
}

interface Task {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  inputData: any;
  expectedOutput?: any;
  configuration: TaskConfiguration;
  constraints: TaskConstraints;
  successCriteria: SuccessCriteria;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  output: any;
  executionTimeMs: number;
  steps: ExecutionStep[];
  metrics: TaskMetrics;
  error?: TaskError;
  artifacts?: Artifact[];
}

interface ExecutionStep {
  type: StepType;
  timestamp: Date;
  input: any;
  output?: any;
  durationMs: number;
  error?: string;
  metadata?: Record<string, any>;
}
```

#### ISWEBenchAgent
Specialized agent for SWE-bench evaluations.

```typescript
interface ISWEBenchAgent extends IEvaluationAgent {
  /**
   * Setup GitHub repository for evaluation
   */
  setupRepository(repoConfig: RepositoryConfig): Promise<RepositorySetup>;

  /**
   * Apply agent-generated patch to codebase
   */
  applyPatch(patch: CodePatch): Promise<PatchResult>;

  /**
   * Run test suite to validate changes
   */
  runTests(testConfig: TestConfiguration): Promise<TestResults>;

  /**
   * Analyze code changes for correctness
   */
  analyzeCodeChanges(changes: CodeChange[]): Promise<CodeAnalysis>;
}

interface RepositoryConfig {
  owner: string;
  repo: string;
  branch: string;
  commit: string;
  issue: GitHubIssue;
  testCommand: string;
  language: string;
}

interface GitHubIssue {
  title: string;
  body: string;
  number: number;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface CodePatch {
  files: PatchFile[];
  commitMessage: string;
  author: string;
}

interface PatchFile {
  path: string;
  content: string;
  type: 'create' | 'modify' | 'delete';
}

interface TestResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  output: string;
  durationMs: number;
  testResults: IndividualTestResult[];
}

interface IndividualTestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
}
```

#### IGUIAutomationAgent
Specialized agent for GUI-based evaluations.

```typescript
interface IGUIAutomationAgent extends IEvaluationAgent {
  /**
   * Create and configure desktop environment
   */
  setupDesktopEnvironment(config: DesktopConfig): Promise<DesktopEnvironment>;

  /**
   * Present task to agent in GUI environment
   */
  presentTask(task: GUITask): Promise<void>;

  /**
   * Monitor agent interactions with GUI
   */
  monitorInteractions(): Promise<InteractionSequence>;

  /**
   * Validate task completion in GUI
   */
  validateTaskCompletion(): Promise<ValidationResult>;

  /**
   * Capture screenshots during execution
   */
  captureScreenshots(): Promise<Screenshot[]>;
}

interface DesktopEnvironment {
  id: string;
  os: OperatingSystem;
  resolution: ScreenResolution;
  applications: Application[];
  network: NetworkConfig;
  environment: Record<string, string>;
}

interface InteractionSequence {
  actions: GUIAction[];
  durationMs: number;
  screenshots: Screenshot[];
  logs: string[];
}

interface GUIAction {
  type: 'click' | 'type' | 'scroll' | 'drag' | 'keypress';
  timestamp: Date;
  target: ActionTarget;
  parameters: ActionParameters;
  result: ActionResult;
}

interface Screenshot {
  timestamp: Date;
  path: string;
  metadata: ScreenshotMetadata;
}

interface ScreenshotMetadata {
  width: number;
  height: number;
  format: 'png' | 'jpg';
  fileSize: number;
  description?: string;
}
```

#### IGeneralReasoningAgent
Specialized agent for general reasoning evaluations.

```typescript
interface IGeneralReasoningAgent extends IEvaluationAgent {
  /**
   * Setup reasoning environment with tools
   */
  setupReasoningEnvironment(config: ReasoningConfig): Promise<ReasoningEnvironment>;

  /**
   * Provide agent with reasoning tools
   */
  provideTools(tools: ITool[]): Promise<void>;

  /**
   * Evaluate reasoning path
   */
  evaluateReasoning(reasoningPath: ReasoningPath): Promise<ReasoningEvaluation>;

  /**
   * Validate answer against ground truth
   */
  validateAnswer(answer: any, groundTruth: any): Promise<AnswerValidation>;
}

interface ReasoningEnvironment {
  knowledgeBase: KnowledgeBase;
  tools: ITool[];
  constraints: ReasoningConstraints;
  taskType: ReasoningTaskType;
}

interface ReasoningPath {
  steps: ReasoningStep[];
  finalAnswer: any;
  confidence: number;
  reasoning: string;
}

interface ReasoningStep {
  stepNumber: number;
  action: string;
  input: any;
  output: any;
  toolUsed?: string;
  reasoning: string;
  confidence: number;
}

interface AnswerValidation {
  isCorrect: boolean;
  accuracy: number;
  completeness: number;
  reasoning: string;
  partialCredit?: number;
  explanation: string;
}
```

### 3. Tool and Resource Interfaces

#### ITool
Interface for tools available to agents.

```typescript
interface ITool {
  /**
   * Get tool name and description
   */
  getInfo(): ToolInfo;

  /**
   * Validate tool parameters
   */
  validateParameters(params: any): Promise<ValidationResult>;

  /**
   * Execute the tool with given parameters
   */
  execute(params: any, context: ToolContext): Promise<ToolResult>;

  /**
   * Get tool schema for parameter validation
   */
  getSchema(): JSONSchema;
}

interface ToolInfo {
  name: string;
  description: string;
  category: ToolCategory;
  version: string;
  parameters: ParameterSchema[];
  examples: ToolExample[];
  capabilities: string[];
}

interface ToolContext {
  agentId: string;
  taskId: string;
  environment: IAgentEnvironment;
  resources: IResource[];
  executionId: string;
}

interface ToolResult {
  success: boolean;
  output: any;
  error?: ToolError;
  metadata: Record<string, any>;
  durationMs: number;
  tokensUsed?: number;
}

interface ToolError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}
```

#### IResource
Interface for system resources available to agents.

```typescript
interface IResource {
  /**
   * Get resource information
   */
  getInfo(): ResourceInfo;

  /**
   * Check if resource is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Acquire resource with specific requirements
   */
  acquire(requirements: ResourceRequirements): Promise<ResourceHandle>;

  /**
   * Release resource
   */
  release(handle: ResourceHandle): Promise<void>;

  /**
   * Get resource usage statistics
   */
  getUsage(): Promise<ResourceUsage>;
}

interface ResourceInfo {
  id: string;
  type: ResourceType;
  name: string;
  description: string;
  capacity: ResourceCapacity;
  currentUsage: ResourceUsage;
  availability: ResourceAvailability;
  cost?: ResourceCost;
}

interface ResourceRequirements {
  cpu?: number;
  memory?: number; // MB
  storage?: number; // GB
  gpu?: boolean;
  network?: NetworkRequirements;
  timeout?: number; // seconds
}

interface ResourceHandle {
  id: string;
  resourceId: string;
  acquiredAt: Date;
  expiresAt?: Date;
  allocation: ResourceAllocation;
}
```

### 4. Persistence Interfaces

#### IEvaluationRepository
Repository interface for evaluation data persistence.

```typescript
interface IEvaluationRepository {
  /**
   * Create a new evaluation
   */
  createEvaluation(evaluation: Evaluation): Promise<Evaluation>;

  /**
   * Get evaluation by ID
   */
  getEvaluation(id: string): Promise<Evaluation | null>;

  /**
   * Update evaluation
   */
  updateEvaluation(id: string, updates: EvaluationUpdate): Promise<Evaluation>;

  /**
   * List evaluations with filtering and pagination
   */
  listEvaluations(query: EvaluationQuery): Promise<PaginatedResult<Evaluation>>;

  /**
   * Delete evaluation
   */
  deleteEvaluation(id: string): Promise<void>;

  /**
   * Get evaluation summary statistics
   */
  getStatistics(filter: StatisticsFilter): Promise<EvaluationStatistics>;
}

interface Evaluation {
  id: string;
  agentName: string;
  agentVersion: string;
  benchmarkType: string;
  benchmarkVersion: string;
  status: EvaluationStatus;
  configuration: EvaluationConfiguration;
  metadata: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  tasks: Task[];
}

interface EvaluationQuery {
  agentName?: string;
  benchmarkType?: string;
  status?: EvaluationStatus[];
  createdAtStart?: Date;
  createdAtEnd?: Date;
  limit?: number;
  offset?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}
```

#### IMetricsRepository
Repository interface for metrics data persistence.

```typescript
interface IMetricsRepository {
  /**
   * Store metrics for a task
   */
  storeMetrics(taskId: string, metrics: MetricData[]): Promise<void>;

  /**
   * Get metrics for a specific task
   */
  getTaskMetrics(taskId: string): Promise<MetricData[]>;

  /**
   * Get aggregated metrics for evaluation
   */
  getEvaluationMetrics(evaluationId: string): Promise<AggregatedMetrics>;

  /**
   * Query metrics with flexible filters
   */
  queryMetrics(query: MetricsQuery): Promise<MetricData[]>;

  /**
   * Get time series aggregated data
   */
  getTimeSeriesData(query: TimeSeriesQuery): Promise<TimeSeriesPoint[]>;

  /**
   * Delete old metrics based on retention policy
   */
  cleanupMetrics(retentionPolicy: RetentionPolicy): Promise<number>;
}

interface MetricsQuery {
  evaluationId?: string;
  taskId?: string;
  agentName?: string;
  benchmarkType?: string;
  categories?: MetricCategory[];
  metricNames?: string[];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}
```

#### IAgentRepository
Repository interface for agent data persistence.

```typescript
interface IAgentRepository {
  /**
   * Register a new agent
   */
  registerAgent(agent: AgentRegistration): Promise<Agent>;

  /**
   * Get agent by name and version
   */
  getAgent(name: string, version: string): Promise<Agent | null>;

  /**
   * List agents with filtering
   */
  listAgents(query: AgentQuery): Promise<Agent[]>;

  /**
   * Update agent configuration
   */
  updateAgent(id: string, updates: AgentUpdate): Promise<Agent>;

  /**
   * Deactivate agent
   */
  deactivateAgent(id: string): Promise<void>;

  /**
   * Get agent performance history
   */
  getAgentPerformance(agentId: string): Promise<PerformanceHistory[]>;
}

interface AgentRegistration {
  name: string;
  version: string;
  type: AgentType;
  configuration: AgentConfiguration;
  capabilities: string[];
  environmentRequirements: EnvironmentRequirements;
  createdBy: string;
}

interface AgentQuery {
  type?: AgentType;
  capabilities?: string[];
  status?: AgentStatus;
  createdBy?: string;
  limit?: number;
  offset?: number;
}
```

### 5. Security and Authentication Interfaces

#### IAuthenticationService
Interface for user authentication and authorization.

```typescript
interface IAuthenticationService {
  /**
   * Authenticate user with credentials
   */
  authenticate(credentials: Credentials): Promise<AuthenticationResult>;

  /**
   * Validate JWT token
   */
  validateToken(token: string): Promise<TokenValidationResult>;

  /**
   * Refresh access token
   */
  refreshToken(refreshToken: string): Promise<TokenRefreshResult>;

  /**
   * Revoke token/session
   */
  revokeToken(token: string): Promise<void>;

  /**
   * Get user permissions
   */
  getUserPermissions(userId: string): Promise<string[]>;

  /**
   * Check if user has specific permission
   */
  hasPermission(userId: string, permission: string): Promise<boolean>;
}

interface AuthenticationResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: AuthenticationError;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: string[];
  createdAt: Date;
  lastLoginAt?: Date;
}
```

#### IAuthorizationService
Interface for authorization and access control.

```typescript
interface IAuthorizationService {
  /**
   * Check if user can access a resource
   */
  canAccess(userId: string, resource: string, action: string): Promise<boolean>;

  /**
   * Check if user can perform evaluation
   */
  canExecuteEvaluation(userId: string, evaluationConfig: EvaluationConfiguration): Promise<boolean>;

  /**
   * Filter evaluations user can access
   */
  filterAccessibleEvaluations(evaluations: Evaluation[], userId: string): Promise<Evaluation[]>;

  /**
   * Enforce rate limits
   */
  checkRateLimit(userId: string, operation: string): Promise<RateLimitResult>;

  /**
   * Create API key for user
   */
  createApiKey(userId: string, scopes: string[]): Promise<ApiKey>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  limit: number;
}

interface ApiKey {
  id: string;
  key: string;
  userId: string;
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}
```

### 6. External Service Interfaces

#### IGitHubService
Interface for GitHub API integration.

```typescript
interface IGitHubService {
  /**
   * Get repository information
   */
  getRepository(owner: string, repo: string): Promise<Repository>;

  /**
   * Get GitHub issue details
   */
  getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue>;

  /**
   * Clone repository to local filesystem
   */
  cloneRepository(owner: string, repo: string, branch: string): Promise<CloneResult>;

  /**
   * Apply code changes and create commit
   */
  createCommit(owner: string, repo: string, changes: CodeChange[]): Promise<CommitResult>;

  /**
   * Run tests in repository
   */
  runTests(owner: string, repo: string, commit: string, testCommand: string): Promise<TestResults>;
}

interface Repository {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  language: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  updatedAt: Date;
}

interface CloneResult {
  localPath: string;
  commit: string;
  success: boolean;
  error?: string;
}
```

#### IDockerService
Interface for Docker container management.

```typescript
interface IDockerService {
  /**
   * Build Docker image from Dockerfile
   */
  buildImage(buildContext: BuildContext): Promise<BuildResult>;

  /**
   * Run container with specific configuration
   */
  runContainer(config: ContainerConfig): Promise<Container>;

  /**
   * Execute command in running container
   */
  executeCommand(containerId: string, command: string[]): Promise<ExecutionResult>;

  /**
   * Copy files to/from container
   */
  copyFiles(containerId: string, source: string, destination: string): Promise<void>;

  /**
   * Stop and remove container
   */
  removeContainer(containerId: string, force?: boolean): Promise<void>;

  /**
   * Get container logs
   */
  getContainerLogs(containerId: string): Promise<string>;

  /**
   * Get container status
   */
  getContainerStatus(containerId: string): Promise<ContainerStatus>;
}

interface BuildContext {
  dockerfilePath: string;
  contextPath: string;
  imageName: string;
  tags: string[];
  buildArgs?: Record<string, string>;
}

interface ContainerConfig {
  image: string;
  name: string;
  environment?: Record<string, string>;
  volumes?: Volume[];
  ports?: PortBinding[];
  resourceLimits?: ResourceLimits;
  command?: string[];
  autoRemove?: boolean;
}
```

### 7. Configuration Interfaces

#### IConfigurationService
Interface for system configuration management.

```typescript
interface IConfigurationService {
  /**
   * Get configuration value
   */
  get<T>(key: string): Promise<T>;

  /**
   * Set configuration value
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Get configuration section
   */
  getSection<T>(section: string): Promise<T>;

  /**
   * Watch configuration for changes
   */
  watch(key: string, callback: ConfigChangeCallback): Promise<Subscription>;

  /**
   * Validate configuration
   */
  validate(): Promise<ValidationResult>;

  /**
   * Reload configuration from source
   */
  reload(): Promise<void>;
}

interface ConfigChangeCallback {
  (key: string, oldValue: any, newValue: any): void;
}
```

#### ILoggerService
Interface for structured logging.

```typescript
interface ILoggerService {
  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, any>): Promise<void>;

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, any>): Promise<void>;

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, any>): Promise<void>;

  /**
   * Log error message
   */
  error(message: string, error?: Error, meta?: Record<string, any>): Promise<void>;

  /**
   * Create child logger with context
   */
  child(context: Record<string, any>): ILoggerService;

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): Promise<void>;
}

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}
```

## Interface Implementation Guidelines

### 1. Error Handling Patterns

#### Standardized Error Handling
```typescript
interface HASEBError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
  recoverable: boolean;
  timestamp: Date;
}

class EvaluationError extends HASEBError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = 'EvaluationError';
    this.code = code;
    this.statusCode = 500;
    this.details = details;
    this.recoverable = false;
    this.timestamp = new Date();
  }
}

class ValidationError extends HASEBError {
  constructor(message: string, field: string, value: any) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 422;
    this.details = { field, value };
    this.recoverable = true;
    this.timestamp = new Date();
  }
}
```

### 2. Event Handling Patterns

#### Standard Event Structure
```typescript
interface BaseEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  correlationId?: string;
  version: string;
}

interface EvaluationEvent extends BaseEvent {
  type: 'evaluation_started' | 'evaluation_progress' | 'evaluation_completed' | 'evaluation_failed';
  data: {
    evaluationId: string;
    agentName: string;
    benchmarkType: string;
    progress?: number;
    result?: EvaluationResult;
    error?: HASEBError;
  };
}

interface TaskEvent extends BaseEvent {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed';
  data: {
    evaluationId: string;
    taskId: string;
    progress?: number;
    result?: TaskResult;
    error?: HASEBError;
  };
}
```

### 3. Async Operation Patterns

#### Cancellable Operations
```typescript
interface CancellationToken {
  isCancelled: boolean;
  onCancelled: Promise<void>;
  cancel(reason?: string): void;
}

interface AsyncOperation<T> {
  (token: CancellationToken): Promise<T>;
}

interface OperationResult<T> {
  success: boolean;
  result?: T;
  error?: HASEBError;
  cancelled: boolean;
  durationMs: number;
}
```

#### Timeout Handling
```typescript
interface TimeoutOptions {
  durationMs: number;
  onTimeout?: () => Promise<void>;
  graceful?: boolean;
}

async function withTimeout<T>(
  operation: AsyncOperation<T>,
  options: TimeoutOptions,
  token?: CancellationToken
): Promise<OperationResult<T>> {
  const timeoutToken = new CancellationToken();
  const combinedToken = combineTokens(token, timeoutToken);

  const timeoutPromise = new Promise<OperationResult<T>>(resolve => {
    setTimeout(async () => {
      timeoutToken.cancel('Operation timed out');
      if (options.onTimeout) {
        await options.onTimeout();
      }
      resolve({
        success: false,
        cancelled: true,
        durationMs: options.durationMs
      });
    }, options.durationMs);
  });

  try {
    const operationPromise = operation(combinedToken);
    const result = await Promise.race([operationPromise, timeoutPromise]);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof HASEBError ? error : new EvaluationError(error.message, 'UNKNOWN_ERROR'),
      cancelled: false,
      durationMs: options.durationMs
    };
  }
}
```

### 4. Testing Interfaces

#### Mock Implementation Support
```typescript
interface IMockFactory {
  createMock<T>(interfaceName: string): T;
  setupMock<T>(mock: T, method: string, implementation: any): void;
  verifyMock<T>(mock: T, method: string, times?: number): boolean;
  resetMock<T>(mock: T): void;
}

interface TestHelpers {
  createTestEvaluation(): Evaluation;
  createTestTask(): Task;
  createTestMetrics(): MetricData[];
  createMockAgent(): IEvaluationAgent;
  createMockRepository(): IEvaluationRepository;
}
```

This comprehensive interface specification provides a solid foundation for implementing the HASEB system with clear contracts between components, ensuring modularity, testability, and maintainability. Each interface includes detailed type definitions, method signatures, and usage examples to guide implementation.