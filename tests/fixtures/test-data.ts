import { v4 as uuidv4 } from 'uuid';

/**
 * Test data fixtures for consistent test data across tests
 */

export interface TestUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'admin' | 'user' | 'evaluator';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestAgent {
  id: string;
  name: string;
  type: 'swe' | 'gui' | 'general' | 'custom';
  status: 'active' | 'inactive' | 'busy' | 'error';
  capabilities: string[];
  performance: {
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
  };
  config: Record<string, any>;
  lastActive: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestBenchmark {
  id: string;
  name: string;
  type: 'swe-bench' | 'gaia' | 'osworld' | 'webarena' | 'custom';
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  totalTasks: number;
  completedTasks: number;
  config: Record<string, any>;
  isActive: boolean;
  lastRun: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestEvaluation {
  id: string;
  agentId: string;
  benchmarkId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  metrics: Record<string, any>;
  config: Record<string, any>;
  errorMessage: string | null;
  startTime: Date | null;
  endTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestEvaluationTask {
  id: string;
  evaluationId: string;
  taskIndex: number;
  taskName: string;
  taskData: Record<string, any>;
  result: Record<string, any> | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  errorMessage: string | null;
  startTime: Date | null;
  endTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test user fixtures
 */
export const testUsers: TestUser[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@test.com',
    passwordHash: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ',
    fullName: 'Admin User',
    role: 'admin',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'user@test.com',
    passwordHash: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ',
    fullName: 'Test User',
    role: 'user',
    isActive: true,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'evaluator@test.com',
    passwordHash: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ',
    fullName: 'Evaluator User',
    role: 'evaluator',
    isActive: true,
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    email: 'inactive@test.com',
    passwordHash: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ',
    fullName: 'Inactive User',
    role: 'user',
    isActive: false,
    createdAt: new Date('2024-01-04T00:00:00Z'),
    updatedAt: new Date('2024-01-04T00:00:00Z'),
  },
];

/**
 * Test agent fixtures
 */
export const testAgents: TestAgent[] = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: 'SWE-Agent-v1',
    type: 'swe',
    status: 'active',
    capabilities: ['code-generation', 'debugging', 'test-writing', 'refactoring'],
    performance: {
      taskSuccessRate: 0.85,
      executionTime: 1200,
      latencyPerStep: 150,
      totalSteps: 8,
      totalTokens: 2500,
      estimatedCost: 0.025,
      toolCallErrorRate: 0.05,
      recoveryRate: 0.98,
      toolSelectionAccuracy: 0.92,
      parameterAccuracy: 0.89,
    },
    config: {
      maxTokens: 4000,
      temperature: 0.1,
      model: 'gpt-4',
      tools: ['git', 'npm', 'terminal', 'file-editor'],
    },
    lastActive: new Date(Date.now() - 3600000), // 1 hour ago
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    name: 'GUI-Agent-v1',
    type: 'gui',
    status: 'active',
    capabilities: ['automation', 'visual-recognition', 'interaction', 'screenshot'],
    performance: {
      taskSuccessRate: 0.78,
      executionTime: 2400,
      latencyPerStep: 300,
      totalSteps: 8,
      totalTokens: 3200,
      estimatedCost: 0.032,
      toolCallErrorRate: 0.08,
      recoveryRate: 0.94,
      toolSelectionAccuracy: 0.88,
      parameterAccuracy: 0.85,
    },
    config: {
      maxTokens: 4000,
      temperature: 0.2,
      model: 'gpt-4-vision-preview',
      tools: ['browser', 'screenshot', 'mouse-keyboard', 'ocr'],
    },
    lastActive: new Date(Date.now() - 1800000), // 30 minutes ago
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date(Date.now() - 1800000),
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440003',
    name: 'General-Agent-v1',
    type: 'general',
    status: 'inactive',
    capabilities: ['reasoning', 'planning', 'execution', 'analysis'],
    performance: {
      taskSuccessRate: 0.72,
      executionTime: 1800,
      latencyPerStep: 200,
      totalSteps: 9,
      totalTokens: 2800,
      estimatedCost: 0.028,
      toolCallErrorRate: 0.12,
      recoveryRate: 0.91,
      toolSelectionAccuracy: 0.86,
      parameterAccuracy: 0.83,
    },
    config: {
      maxTokens: 4000,
      temperature: 0.3,
      model: 'gpt-4',
      tools: ['calculator', 'search', 'file-reader', 'data-analyzer'],
    },
    lastActive: new Date(Date.now() - 86400000), // 1 day ago
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440004',
    name: 'Error-Agent-v1',
    type: 'swe',
    status: 'error',
    capabilities: ['code-generation'],
    performance: {
      taskSuccessRate: 0.15,
      executionTime: 5000,
      latencyPerStep: 600,
      totalSteps: 8,
      totalTokens: 5000,
      estimatedCost: 0.05,
      toolCallErrorRate: 0.45,
      recoveryRate: 0.60,
      toolSelectionAccuracy: 0.70,
      parameterAccuracy: 0.65,
    },
    config: {
      maxTokens: 4000,
      temperature: 0.5,
      model: 'gpt-3.5-turbo',
      tools: ['git', 'terminal'],
    },
    lastActive: new Date(Date.now() - 7200000), // 2 hours ago
    createdAt: new Date('2024-01-04T00:00:00Z'),
    updatedAt: new Date(Date.now() - 7200000),
  },
];

/**
 * Test benchmark fixtures
 */
export const testBenchmarks: TestBenchmark[] = [
  {
    id: '770e8400-e29b-41d4-a716-446655440001',
    name: 'SWE-Bench-Test',
    type: 'swe-bench',
    description: 'Software engineering benchmark test dataset with real GitHub issues',
    difficulty: 'medium',
    totalTasks: 50,
    completedTasks: 45,
    config: {
      repositoryUrl: 'https://github.com/test-repo/swe-bench-test',
      timeout: 1800,
      maxAttempts: 3,
      evaluationMetrics: ['pass@1', 'pass@5', 'code-quality'],
    },
    isActive: true,
    lastRun: new Date(Date.now() - 3600000), // 1 hour ago
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'GAIA-Test',
    type: 'gaia',
    description: 'General AI assistant benchmark test with diverse tasks',
    difficulty: 'hard',
    totalTasks: 30,
    completedTasks: 25,
    config: {
      categories: ['reasoning', 'planning', 'tool-use', 'coding'],
      timeout: 3600,
      maxAttempts: 5,
      evaluationMetrics: ['accuracy', 'efficiency', 'creativity'],
    },
    isActive: true,
    lastRun: new Date(Date.now() - 1800000), // 30 minutes ago
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date(Date.now() - 1800000),
  },
  {
    id: '770e8400-e29b-41d4-a716-446655440003',
    name: 'OSWorld-Test',
    type: 'osworld',
    description: 'Operating system world benchmark test for GUI agents',
    difficulty: 'medium',
    totalTasks: 40,
    completedTasks: 35,
    config: {
      operatingSystems: ['ubuntu-22.04', 'windows-11'],
      applications: ['vscode', 'chrome', 'terminal'],
      timeout: 2400,
      evaluationMetrics: ['task-completion', 'efficiency', 'error-recovery'],
    },
    isActive: true,
    lastRun: new Date(Date.now() - 7200000), // 2 hours ago
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date(Date.now() - 7200000),
  },
  {
    id: '770e8400-e29b-41d4-a716-446655440004',
    name: 'WebArena-Test',
    type: 'webarena',
    description: 'Web automation arena benchmark test',
    difficulty: 'medium',
    totalTasks: 25,
    completedTasks: 20,
    config: {
      websites: ['https://example-shop.com', 'https://example-blog.com'],
      browsers: ['chrome', 'firefox'],
      timeout: 1800,
      evaluationMetrics: ['navigation', 'interaction', 'form-filling'],
    },
    isActive: false,
    lastRun: new Date(Date.now() - 86400000), // 1 day ago
    createdAt: new Date('2024-01-04T00:00:00Z'),
    updatedAt: new Date(Date.now() - 86400000),
  },
];

/**
 * Test evaluation fixtures
 */
export const testEvaluations: TestEvaluation[] = [
  {
    id: '880e8400-e29b-41d4-a716-446655440001',
    agentId: '660e8400-e29b-41d4-a716-446655440001',
    benchmarkId: '770e8400-e29b-41d4-a716-446655440001',
    status: 'completed',
    progress: 100,
    metrics: {
      taskSuccessRate: 0.85,
      executionTime: 1200,
      latencyPerStep: 150,
      totalSteps: 8,
      totalTokens: 2500,
      estimatedCost: 0.025,
      toolCallErrorRate: 0.05,
      recoveryRate: 0.98,
      toolSelectionAccuracy: 0.92,
      parameterAccuracy: 0.89,
      completedTasks: 42,
      failedTasks: 8,
      skippedTasks: 0,
    },
    config: {
      maxRetries: 3,
      timeout: 1800,
      detailedLogging: true,
    },
    errorMessage: null,
    startTime: new Date(Date.now() - 7200000), // 2 hours ago
    endTime: new Date(Date.now() - 3600000), // 1 hour ago
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '880e8400-e29b-41d4-a716-446655440002',
    agentId: '660e8400-e29b-41d4-a716-446655440002',
    benchmarkId: '770e8400-e29b-41d4-a716-446655440002',
    status: 'running',
    progress: 65,
    metrics: {
      taskSuccessRate: 0.78,
      executionTime: 1800,
      latencyPerStep: 300,
      totalSteps: 5,
      totalTokens: 1800,
      estimatedCost: 0.018,
      toolCallErrorRate: 0.08,
      recoveryRate: 0.94,
      toolSelectionAccuracy: 0.88,
      parameterAccuracy: 0.85,
      completedTasks: 13,
      failedTasks: 3,
      skippedTasks: 0,
    },
    config: {
      maxRetries: 5,
      timeout: 3600,
      detailedLogging: false,
    },
    errorMessage: null,
    startTime: new Date(Date.now() - 1800000), // 30 minutes ago
    endTime: null,
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(Date.now() - 600000), // 10 minutes ago
  },
  {
    id: '880e8400-e29b-41d4-a716-446655440003',
    agentId: '660e8400-e29b-41d4-a716-446655440003',
    benchmarkId: '770e8400-e29b-41d4-a716-446655440003',
    status: 'pending',
    progress: 0,
    metrics: {},
    config: {
      maxRetries: 3,
      timeout: 2400,
      detailedLogging: true,
    },
    errorMessage: null,
    startTime: null,
    endTime: null,
    createdAt: new Date(Date.now() - 300000), // 5 minutes ago
    updatedAt: new Date(Date.now() - 300000),
  },
  {
    id: '880e8400-e29b-41d4-a716-446655440004',
    agentId: '660e8400-e29b-41d4-a716-446655440004',
    benchmarkId: '770e8400-e29b-41d4-a716-446655440001',
    status: 'failed',
    progress: 25,
    metrics: {
      taskSuccessRate: 0.15,
      executionTime: 5000,
      latencyPerStep: 600,
      totalSteps: 2,
      totalTokens: 1000,
      estimatedCost: 0.01,
      toolCallErrorRate: 0.45,
      recoveryRate: 0.60,
      toolSelectionAccuracy: 0.70,
      parameterAccuracy: 0.65,
      completedTasks: 3,
      failedTasks: 10,
      skippedTasks: 0,
    },
    config: {
      maxRetries: 3,
      timeout: 1800,
      detailedLogging: true,
    },
    errorMessage: 'Agent exceeded maximum retry limit and failed to complete tasks',
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(Date.now() - 1800000), // 30 minutes ago
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 1800000),
  },
];

/**
 * Test evaluation task fixtures
 */
export const testEvaluationTasks: TestEvaluationTask[] = [
  {
    id: '990e8400-e29b-41d4-a716-446655440001',
    evaluationId: '880e8400-e29b-41d4-a716-446655440001',
    taskIndex: 1,
    taskName: 'Fix login bug',
    taskData: {
      repository: 'test-repo',
      issue: 'Login fails on mobile devices',
      difficulty: 'medium',
      expectedChanges: ['bug-fix', 'test-addition'],
      timeout: 600,
    },
    result: {
      status: 'fixed',
      changes: 15,
      testsAdded: 3,
      codeQuality: 0.92,
      executionTime: 450,
    },
    status: 'completed',
    errorMessage: null,
    startTime: new Date(Date.now() - 7200000),
    endTime: new Date(Date.now() - 6750000),
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 6750000),
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440002',
    evaluationId: '880e8400-e29b-41d4-a716-446655440001',
    taskIndex: 2,
    taskName: 'Add search feature',
    taskData: {
      repository: 'test-repo',
      requirement: 'Implement full-text search with filtering',
      difficulty: 'hard',
      expectedChanges: ['feature-addition', 'database-schema', 'ui-components'],
      timeout: 1200,
    },
    result: {
      status: 'implemented',
      changes: 25,
      testsAdded: 5,
      codeQuality: 0.88,
      executionTime: 980,
      performanceMetrics: {
        searchTime: 150,
        indexSize: '2.3MB',
        accuracy: 0.95,
      },
    },
    status: 'completed',
    errorMessage: null,
    startTime: new Date(Date.now() - 6750000),
    endTime: new Date(Date.now() - 5770000),
    createdAt: new Date(Date.now() - 6750000),
    updatedAt: new Date(Date.now() - 5770000),
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440003',
    evaluationId: '880e8400-e29b-41d4-a716-446655440002',
    taskIndex: 1,
    taskName: 'Navigate to settings',
    taskData: {
      website: 'test-site.com',
      goal: 'Find and click settings button in navigation',
      difficulty: 'easy',
      expectedActions: ['navigate', 'locate-element', 'click'],
      timeout: 300,
    },
    result: null,
    status: 'pending',
    errorMessage: null,
    startTime: null,
    endTime: null,
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(Date.now() - 1800000),
  },
];

/**
 * Helper functions to create test data
 */
export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: uuidv4(),
  email: `test-${Date.now()}@example.com`,
  passwordHash: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ',
  fullName: 'Test User',
  role: 'user',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestAgent = (overrides: Partial<TestAgent> = {}): TestAgent => ({
  id: uuidv4(),
  name: 'Test Agent',
  type: 'general',
  status: 'active',
  capabilities: ['test-capability'],
  performance: {
    taskSuccessRate: 0.8,
    executionTime: 1000,
    latencyPerStep: 100,
    totalSteps: 10,
    totalTokens: 2000,
    estimatedCost: 0.02,
    toolCallErrorRate: 0.1,
    recoveryRate: 0.9,
    toolSelectionAccuracy: 0.85,
    parameterAccuracy: 0.8,
  },
  config: {},
  lastActive: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestBenchmark = (overrides: Partial<TestBenchmark> = {}): TestBenchmark => ({
  id: uuidv4(),
  name: 'Test Benchmark',
  type: 'custom',
  description: 'Test benchmark description',
  difficulty: 'medium',
  totalTasks: 10,
  completedTasks: 0,
  config: {},
  isActive: true,
  lastRun: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestEvaluation = (overrides: Partial<TestEvaluation> = {}): TestEvaluation => ({
  id: uuidv4(),
  agentId: uuidv4(),
  benchmarkId: uuidv4(),
  status: 'pending',
  progress: 0,
  metrics: {},
  config: {},
  errorMessage: null,
  startTime: null,
  endTime: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestEvaluationTask = (overrides: Partial<TestEvaluationTask> = {}): TestEvaluationTask => ({
  id: uuidv4(),
  evaluationId: uuidv4(),
  taskIndex: 1,
  taskName: 'Test Task',
  taskData: {},
  result: null,
  status: 'pending',
  errorMessage: null,
  startTime: null,
  endTime: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});