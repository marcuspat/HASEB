import { jest } from '@jest/globals';

// Mock database connection
export const mockDatabaseConnection = {
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined),
  getPoolStats: jest.fn().mockReturnValue({
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  }),
};

// Mock logger
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock express request/response
export const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  headers: { 'x-request-id': 'test-request-id' },
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

// Mock authentication middleware
export const mockAuthMiddleware = {
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'admin' };
    next();
  }),
  authorize: jest.fn((roles) => (req, res, next) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  }),
};

// Mock external services
export const mockExternalServices = {
  // Mock OpenAI API
  openai: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Mock AI response' }
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      },
    },
  },

  // Mock GitHub API
  github: {
    repos: {
      get: jest.fn().mockResolvedValue({
        data: {
          id: 123,
          name: 'test-repo',
          full_name: 'user/test-repo',
          description: 'Test repository',
        },
      }),
      createFile: jest.fn().mockResolvedValue({
        data: { commit: { sha: 'abc123' } },
      }),
    },
    issues: {
      create: jest.fn().mockResolvedValue({
        data: { id: 456, number: 1, title: 'Test issue' },
      }),
    },
  },

  // Mock Slack API
  slack: {
    chat: {
      postMessage: jest.fn().mockResolvedValue({
        ok: true,
        channel: 'C123456',
        ts: '1234567890.123456',
      }),
    },
  },
};

// Mock WebSocket
export const mockWebSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  broadcast: jest.fn(),
  to: jest.fn().mockReturnThis(),
  join: jest.fn(),
  leave: jest.fn(),
};

// Mock file system operations
export const mockFileSystem = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
};

// Mock metrics collector
export const mockMetricsCollector = {
  recordMetric: jest.fn(),
  recordPerformance: jest.fn(),
  recordError: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({
    totalRequests: 100,
    averageResponseTime: 150,
    errorRate: 0.02,
  }),
};

// Mock rate limiter
export const mockRateLimiter = {
  consume: jest.fn().mockResolvedValue({ remainingPoints: 99 }),
  penalty: jest.fn().mockResolvedValue(undefined),
  block: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockReturnValue({ remainingPoints: 100 }),
  delete: jest.fn().mockResolvedValue(true),
};

// Mock cache
export const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  clear: jest.fn(),
  has: jest.fn().mockReturnValue(false),
  keys: jest.fn().mockReturnValue([]),
};

// Create mock factory function
export const createMockService = (methods = {}) => {
  const service = {};
  Object.entries(methods).forEach(([key, value]) => {
    service[key] = typeof value === 'function' ? jest.fn(value) : jest.fn().mockReturnValue(value);
  });
  return service;
};

// Reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
};