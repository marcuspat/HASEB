import dotenv from 'dotenv';
import { beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock database modules
jest.mock('@/database/connection', () => ({
  db: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    getClient: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    testConnection: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  },
  DatabaseManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    label: jest.fn(),
    prettyPrint: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = process.env.DB_NAME_TEST || 'haseb_test';

  // Set required environment variables
  process.env.VITE_API_URL = 'http://localhost:3001/api';
  process.env.VITE_WS_URL = 'ws://localhost:3001';

  // Mock import.meta.env for Vite environment variables
  global.import = global.import || {};
  global.import.meta = {
    env: {
      VITE_API_URL: 'http://localhost:3001/api',
      VITE_WS_URL: 'ws://localhost:3001',
    },
  };

  // Mock console methods in tests to keep output clean
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(async () => {
  // Cleanup global resources
  // Close database connections, etc.
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

// Global test utilities
global.createMockAgent = (overrides = {}) => ({
  id: 'test-agent-id',
  name: 'Test Agent',
  type: 'swe',
  status: 'active',
  capabilities: ['code-generation', 'debugging'],
  performance: {
    taskSuccessRate: 0.95,
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
  lastActive: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

global.createMockEvaluation = (overrides = {}) => ({
  id: 'test-eval-id',
  agentId: 'test-agent-id',
  benchmarkType: 'swe-bench',
  status: 'completed',
  progress: 100,
  metrics: {
    taskSuccessRate: 0.85,
    executionTime: 2400,
    latencyPerStep: 200,
    totalSteps: 12,
    totalTokens: 5000,
    estimatedCost: 0.05,
    toolCallErrorRate: 0.08,
    recoveryRate: 0.96,
    toolSelectionAccuracy: 0.88,
    parameterAccuracy: 0.91,
  },
  startTime: new Date(Date.now() - 3600000).toISOString(),
  endTime: new Date().toISOString(),
  ...overrides,
});

global.createMockBenchmark = (overrides = {}) => ({
  id: 'test-benchmark-id',
  name: 'SWE-Bench Test',
  type: 'swe-bench',
  description: 'Test benchmark for software engineering',
  totalTasks: 50,
  completedTasks: 45,
  difficulty: 'medium',
  isActive: true,
  lastRun: new Date().toISOString(),
  ...overrides,
});

declare global {
  var createMockAgent: (overrides?: any) => any;
  var createMockEvaluation: (overrides?: any) => any;
  var createMockBenchmark: (overrides?: any) => any;
}