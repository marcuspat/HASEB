export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'busy' | 'error';
  capabilities: string[];
  performance: PerformanceMetrics;
  lastActive: string;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  agentId: string;
  benchmarkId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  configuration: Record<string, any>;
  logs: EvaluationLog[];
  metrics?: Partial<EvaluationMetrics>;
}

export interface EvaluationMetrics {
  taskSuccessRate: number;
  executionTime: number;
  latencyPerStep: number;
  totalSteps: number;
  totalTokens: number;
  estimatedCost: number;
  toolCallErrorRate: number;
  recoveryRate: number;
  toolSelectionAccuracy: number;
  parameterAccuracy: number;
}

export interface EvaluationLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  taskSuccessRate: number;
  executionTime: number;
  latencyPerStep: number;
  totalSteps: number;
  totalTokens: number;
  estimatedCost: number;
  toolCallErrorRate: number;
  recoveryRate: number;
  toolSelectionAccuracy: number;
  parameterAccuracy: number;
}

export interface Benchmark {
  id: string;
  name: string;
  type: 'swe-bench' | 'gaia' | 'osworld' | 'webarena' | 'agentbench';
  description: string;
  totalTasks: number;
  completedTasks: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  isActive: boolean;
  lastRun?: string;
}

export interface LeaderboardEntry {
  rank: number;
  agent: Agent;
  metrics: PerformanceMetrics;
  benchmark: Benchmark;
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
}

export interface FilterState {
  benchmarkType: string;
  agentType: string;
  status: string;
  difficulty: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    tension?: number;
  }[];
}

export interface ParetoPoint {
  accuracy: number;
  cost: number;
  agentName: string;
  agentId: string;
  isParetoOptimal: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    timestamp: Date;
  };
  metadata?: {
    timestamp: Date;
    requestId?: string;
    version?: string;
  };
}

export interface DatabaseConfig {
  type: 'postgresql' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionTimeout?: number;
  maxConnections?: number;
  idleTimeoutMs?: number;
  file?: string; // For SQLite
}