import { jest } from '@jest/globals';

// Mock database connection
export const mockDatabaseConnection = {
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
  testConnection: jest.fn<(...args: any[]) => any>().mockResolvedValue(true),
  close: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
  getPoolStats: jest.fn<(...args: any[]) => any>().mockReturnValue({
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
  headers: { 'x-request-id': 'test-request-id' },
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn<(...args: any[]) => any>().mockReturnValue(res);
  res.json = jest.fn<(...args: any[]) => any>().mockReturnValue(res);
  res.send = jest.fn<(...args: any[]) => any>().mockReturnValue(res);
  res.redirect = jest.fn<(...args: any[]) => any>().mockReturnValue(res);
  res.cookie = jest.fn<(...args: any[]) => any>().mockReturnValue(res);
  res.clearCookie = jest.fn<(...args: any[]) => any>().mockReturnValue(res);
  return res;
};

// Mock authentication middleware
export const mockAuthMiddleware = {
  authenticate: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'admin' };
    next();
  }),
  authorize: jest.fn((roles: any) => (req: any, res: any, next: any) => {
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
        create: jest.fn<(...args: any[]) => any>().mockResolvedValue({
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
      get: jest.fn<(...args: any[]) => any>().mockResolvedValue({
        data: {
          id: 123,
          name: 'test-repo',
          full_name: 'user/test-repo',
          description: 'Test repository',
        },
      }),
      createFile: jest.fn<(...args: any[]) => any>().mockResolvedValue({
        data: { commit: { sha: 'abc123' } },
      }),
    },
    issues: {
      create: jest.fn<(...args: any[]) => any>().mockResolvedValue({
        data: { id: 456, number: 1, title: 'Test issue' },
      }),
    },
  },

  // Mock Slack API
  slack: {
    chat: {
      postMessage: jest.fn<(...args: any[]) => any>().mockResolvedValue({
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
  to: jest.fn<(...args: any[]) => any>().mockReturnThis(),
  join: jest.fn(),
  leave: jest.fn(),
};

// Mock file system operations
export const mockFileSystem = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  existsSync: jest.fn<(...args: any[]) => any>().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn<(...args: any[]) => any>().mockReturnValue([]),
};

// Mock metrics collector
export const mockMetricsCollector = {
  recordMetric: jest.fn(),
  recordPerformance: jest.fn(),
  recordError: jest.fn(),
  getMetrics: jest.fn<(...args: any[]) => any>().mockReturnValue({
    totalRequests: 100,
    averageResponseTime: 150,
    errorRate: 0.02,
  }),
};

// Mock rate limiter
export const mockRateLimiter = {
  consume: jest.fn<(...args: any[]) => any>().mockResolvedValue({ remainingPoints: 99 }),
  penalty: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
  block: jest.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
  get: jest.fn<(...args: any[]) => any>().mockReturnValue({ remainingPoints: 100 }),
  delete: jest.fn<(...args: any[]) => any>().mockResolvedValue(true),
};

// Mock cache
export const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  clear: jest.fn(),
  has: jest.fn<(...args: any[]) => any>().mockReturnValue(false),
  keys: jest.fn<(...args: any[]) => any>().mockReturnValue([]),
};

// Create mock factory function
export const createMockService = (methods = {}) => {
  const service: Record<string, any> = {};
  Object.entries(methods).forEach(([key, value]) => {
    service[key] = typeof value === 'function' ? jest.fn(value as (...args: any[]) => any) : jest.fn<(...args: any[]) => any>().mockReturnValue(value);
  });
  return service;
};

// Reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
};