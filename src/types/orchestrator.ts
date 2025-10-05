import { Evaluation, EvaluationMetrics } from './index';

export interface EvaluationState {
  id: string;
  agentId: string;
  benchmarkId: string;
  status: 'pending' | 'queued' | 'setup' | 'execute' | 'collect' | 'analyze' | 'teardown' | 'completed' | 'failed' | 'cancelled';
  currentStep: 'setup' | 'execute' | 'collect' | 'analyze' | 'teardown' | null;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  configuration: Record<string, any>;
  environment: EvaluationEnvironment;
  execution: ExecutionState;
  metrics: Partial<EvaluationMetrics>;
  logs: EvaluationLog[];
  errors: EvaluationError[];
  metadata: Record<string, any>;
}

export interface EvaluationEnvironment {
  id: string;
  type: 'docker' | 'vm' | 'sandbox' | 'local';
  status: 'creating' | 'ready' | 'running' | 'cleaning' | 'destroyed';
  resources: {
    cpu: number;
    memory: number;
    disk: number;
    network: boolean;
  };
  configuration: Record<string, any>;
  endpoint?: string;
  credentials?: Record<string, string>;
}

export interface ExecutionState {
  tasks: TaskState[];
  currentTaskIndex: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  executionHistory: ExecutionStep[];
}

export interface TaskState {
  id: string;
  type: string;
  description: string;
  input: any;
  expectedOutput?: any;
  actualOutput?: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  tokensUsed: number;
  cost: number;
  errors: string[];
  metrics: Record<string, any>;
}

export interface ExecutionStep {
  step: string;
  timestamp: Date;
  action: string;
  result?: any;
  error?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface EvaluationLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface EvaluationError {
  id: string;
  timestamp: Date;
  type: 'system' | 'agent' | 'benchmark' | 'environment' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  recoverable: boolean;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface QueueItem {
  id: string;
  agentId: string;
  benchmarkId: string;
  configuration: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  estimatedDuration?: number;
  retryCount: number;
  maxRetries: number;
}

export interface OrchestrationConfig {
  maxConcurrentEvaluations: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  environmentCleanupDelay: number;
  metricsCollectionInterval: number;
  progressUpdateInterval: number;
  enableAutoRetry: boolean;
  enableResourceMonitoring: boolean;
  enableRealTimeUpdates: boolean;
}

export interface WebSocketMessage {
  type: 'evaluation_update' | 'progress_update' | 'metrics_update' | 'error' | 'log' | 'status_change';
  evaluationId: string;
  timestamp: Date;
  data: any;
}

export interface AgentCapability {
  name: string;
  version: string;
  supportedBenchmarks: string[];
  requirements: Record<string, any>;
  configuration: Record<string, any>;
}

export interface BenchmarkConfig {
  name: string;
  type: string;
  dataset: string;
  tasks: BenchmarkTask[];
  evaluationCriteria: EvaluationCriteria[];
  environment: EnvironmentRequirements;
  timeout: number;
}

export interface BenchmarkTask {
  id: string;
  type: string;
  description: string;
  input: any;
  expectedOutput?: any;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: string;
  tags: string[];
}

export interface EvaluationCriteria {
  name: string;
  type: 'accuracy' | 'efficiency' | 'cost' | 'robustness' | 'quality';
  weight: number;
  measurement: string;
  threshold?: number;
}

export interface EnvironmentRequirements {
  os: string;
  architecture: string;
  resources: {
    minCpu: number;
    minMemory: number;
    minDisk: number;
    networkRequired: boolean;
  };
  dependencies: string[];
  configuration: Record<string, any>;
}