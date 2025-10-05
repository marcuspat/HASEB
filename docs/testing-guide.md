# HASEB Testing Guide

## Overview

This comprehensive testing guide covers the HASEB (Holistic Agentic System Evaluator & Benchmarking Suite) testing strategy, infrastructure, and best practices.

## Testing Stack

- **Unit Tests**: Jest with TypeScript support
- **Integration Tests**: Jest with Supertest for API testing
- **End-to-End Tests**: Playwright for browser automation
- **Performance Tests**: Custom load testing with Jest
- **Security Tests**: Security-focused test suites
- **Database Tests**: PostgreSQL with test fixtures

## Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── helpers/                    # Test utilities and helpers
│   ├── test-db.ts             # Database test utilities
│   └── test-database-client.ts # Database client with fixtures
├── fixtures/                   # Test data fixtures
│   └── test-data.ts           # Comprehensive test data
├── unit/                       # Unit tests
│   ├── database/
│   ├── api/
│   ├── services/
│   └── utils/
├── integration/                # Integration tests
│   ├── api.test.ts
│   ├── database.test.ts
│   └── websocket.test.ts
├── e2e/                        # End-to-end tests
│   ├── dashboard.spec.ts
│   ├── evaluation.spec.ts
│   └── auth.spec.ts
├── performance/                # Performance tests
│   ├── load.test.ts
│   ├── stress.test.ts
│   └── benchmark.test.ts
└── security/                   # Security tests
    ├── auth.test.ts
    ├── api-security.test.ts
    └── input-validation.test.ts
```

## Configuration

### Jest Configuration (`jest.config.js`)

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/server.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 4,
  detectOpenHandles: true,
  forceExit: true
};
```

### Test Environment (`.env.test`)

See `.env.test` for complete test environment configuration including:
- Database settings
- JWT configuration
- Rate limiting
- Mock service settings
- Security configurations

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security

# Run all test suites
npm run test:all
```

### Database Management

```bash
# Seed test database
npm run seed:test

# Reset test database
npm run seed:test reset

# Clean test database
npm run seed:test clean
```

## Test Categories

### 1. Unit Tests

Unit tests focus on individual components and functions in isolation.

#### Database Model Tests

```typescript
// tests/unit/database/models/Agent.test.ts
describe('Agent Model', () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  test('should create agent with valid data', async () => {
    const agentData = createTestAgent();
    const agent = await Agent.create(agentData);

    expect(agent.id).toBeDefined();
    expect(agent.name).toBe(agentData.name);
  });
});
```

#### API Endpoint Tests

```typescript
// tests/unit/api/agents.test.ts
describe('Agents API', () => {
  let app: Express;

  beforeAll(async () => {
    app = createTestApp();
  });

  test('GET /api/agents should return agents list', async () => {
    const response = await request(app)
      .get('/api/agents')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### 2. Integration Tests

Integration tests verify that multiple components work together correctly.

#### API Integration Tests

```typescript
// tests/integration/api.test.ts
describe('API Integration', () => {
  let app: Express;
  let testDb: TestDatabase;

  beforeAll(async () => {
    app = createTestApp();
    testDb = new TestDatabase();
    await testDb.initialize();
  });

  test('should handle complete evaluation workflow', async () => {
    // Create agent
    const agent = await testDb.insertTestAgent();

    // Create benchmark
    const benchmark = await testDb.insertTestBenchmark();

    // Start evaluation
    const response = await request(app)
      .post('/api/evaluations')
      .send({
        agentId: agent.id,
        benchmarkId: benchmark.id
      })
      .expect(201);

    expect(response.body.data.status).toBe('pending');
  });
});
```

### 3. End-to-End Tests

E2E tests verify complete user workflows in the browser.

#### Dashboard Tests

```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display evaluation statistics', async ({ page }) => {
    await expect(page.locator('[data-testid="total-evaluations"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
  });

  test('should create new evaluation', async ({ page }) => {
    await page.click('[data-testid="new-evaluation-btn"]');
    await page.selectOption('[data-testid="agent-select"]', 'SWE-Agent-v1');
    await page.selectOption('[data-testid="benchmark-select"]', 'SWE-Bench-Test');
    await page.click('[data-testid="start-evaluation-btn"]');

    await expect(page.locator('[data-testid="evaluation-status"]')).toContainText('running');
  });
});
```

### 4. Performance Tests

Performance tests verify system performance under load.

#### Load Testing

```typescript
// tests/performance/load.test.ts
describe('Load Testing', () => {
  test('should handle 100 concurrent requests', async () => {
    const requests = Array.from({ length: 100 }, () =>
      request(app).get('/api/agents')
    );

    const startTime = Date.now();
    const results = await Promise.all(requests);
    const endTime = Date.now();

    const successCount = results.filter(r => r.status === 200).length;
    const totalTime = endTime - startTime;

    expect(successCount).toBeGreaterThan(95);
    expect(totalTime).toBeLessThan(5000); // 5 seconds
  });
});
```

### 5. Security Tests

Security tests verify system security and data protection.

#### Authentication Security

```typescript
// tests/security/auth.test.ts
describe('Authentication Security', () => {
  test('should prevent brute force attacks', async () => {
    const loginAttempts = Array.from({ length: 20 }, () =>
      request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
    );

    const results = await Promise.all(loginAttempts);
    const rateLimited = results.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(5);
  });
});
```

## Test Data Management

### Fixtures

Test fixtures provide consistent test data across all test suites.

```typescript
// tests/fixtures/test-data.ts
export const testUsers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@test.com',
    fullName: 'Admin User',
    role: 'admin'
  },
  // ... more test users
];

export const createTestUser = (overrides = {}) => ({
  id: uuidv4(),
  email: `test-${Date.now()}@example.com`,
  fullName: 'Test User',
  role: 'user',
  ...overrides
});
```

### Database Helpers

```typescript
// tests/helpers/test-database-client.ts
export class TestDatabaseClient {
  async initialize(): Promise<void> {
    await this.testDb.initialize();
    await this.testDb.createSchema();
    await this.seedAllFixtures();
  }

  async insertTestUser(overrides = {}): Promise<any> {
    const user = createTestUser(overrides);
    await this.seedUsers([user]);
    return user;
  }

  async cleanup(): Promise<void> {
    await this.testDb.cleanup();
  }
}
```

## Mock Strategy

### External Service Mocks

```typescript
// tests/mocks/external-services.ts
jest.mock('../src/services/openai', () => ({
  OpenAIService: {
    createCompletion: jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Mock response' } }]
    })
  }
}));

jest.mock('../src/services/github', () => ({
  GitHubService: {
    getRepository: jest.fn().mockResolvedValue({
      name: 'test-repo',
      default_branch: 'main'
    })
  }
}));
```

### Database Transaction Mocks

```typescript
// tests/helpers/database-mocks.ts
export const mockTransaction = {
  query: jest.fn(),
  release: jest.fn(),
};

export const mockPool = {
  connect: jest.fn().mockResolvedValue(mockTransaction),
  end: jest.fn().mockResolvedValue(undefined),
};
```

## Coverage Requirements

### Target Coverage Metrics

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html

# Generate coverage badge
npx istanbul-cobertura-badger
```

### Coverage Configuration

```javascript
// jest.config.js
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts',
  '!src/server.ts'
],
coverageThreshold: {
  global: {
    branches: 85,
    functions: 90,
    lines: 90,
    statements: 90
  }
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_USER: postgres
          POSTGRES_DB: haseb_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup test database
      run: |
        npm run seed:test seed

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  e2e-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright
      run: npx playwright install --with-deps

    - name: Build application
      run: npm run build

    - name: Run E2E tests
      run: npm run test:e2e

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
```

### Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:unit"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

## Best Practices

### Test Writing Guidelines

1. **Arrange-Act-Assert Pattern**
   ```typescript
   test('should update agent status', async () => {
     // Arrange
     const agent = await testDb.insertTestAgent();
     const newStatus = 'busy';

     // Act
     const updatedAgent = await Agent.updateStatus(agent.id, newStatus);

     // Assert
     expect(updatedAgent.status).toBe(newStatus);
   });
   ```

2. **Descriptive Test Names**
   ```typescript
   test('should return 400 when creating agent with invalid data', async () => {
     // Test implementation
   });
   ```

3. **Test Isolation**
   ```typescript
   beforeEach(async () => {
     await testDb.cleanup();
     await testDb.seedAllFixtures();
   });
   ```

4. **Mock External Dependencies**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
     jest.resetAllMocks();
   });
   ```

### Performance Testing Guidelines

1. **Use Realistic Data**: Test with production-like data volumes
2. **Measure Baselines**: Establish performance baselines
3. **Monitor Resources**: Track CPU, memory, and database usage
4. **Test Edge Cases**: Test system limits and failure scenarios

### Security Testing Guidelines

1. **Test Authentication Flows**: Verify login, logout, and session management
2. **Validate Input Sanitization**: Test XSS, SQL injection, and CSRF protection
3. **Check Authorization**: Verify role-based access control
4. **Test Rate Limiting**: Verify protection against brute force attacks

## Debugging Tests

### Debugging Unit Tests

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test file
npm test -- Agent.test.ts

# Run tests with verbose output
npm test -- --verbose
```

### Debugging E2E Tests

```bash
# Run Playwright in debug mode
npx playwright test --debug

# Run with headed browser
npx playwright test --headed

# Generate trace files
npx playwright test --trace on
```

### Common Issues

1. **Database Connection Errors**
   - Ensure test database is running
   - Check environment variables in `.env.test`
   - Verify connection pool settings

2. **Timeout Errors**
   - Increase test timeout in Jest config
   - Check for async operations without proper await
   - Verify cleanup functions are working

3. **Memory Leaks**
   - Ensure proper cleanup in `afterEach`
   - Close database connections
   - Clear event listeners

## Test Maintenance

### Regular Tasks

1. **Update Test Data**: Keep fixtures current with schema changes
2. **Review Coverage**: Monitor coverage reports and address gaps
3. **Update Mocks**: Keep mocks aligned with actual service APIs
4. **Performance Monitoring**: Track test execution times

### Test Refactoring

1. **Remove Redundant Tests**: Consolidate similar test cases
2. **Extract Common Patterns**: Create reusable test utilities
3. **Improve Test Data**: Make fixtures more realistic and comprehensive
4. **Optimize Test Performance**: Reduce test execution time

## Troubleshooting

### Common Test Failures

1. **Async/Await Issues**
   ```typescript
   // Incorrect
   test('should create agent', () => {
     const agent = Agent.create(data); // Missing await
   });

   // Correct
   test('should create agent', async () => {
     const agent = await Agent.create(data);
   });
   ```

2. **Database Cleanup**
   ```typescript
   // Ensure proper cleanup
   afterEach(async () => {
     await testDb.cleanup();
   });
   ```

3. **Mock Implementation**
   ```typescript
   // Ensure mocks return expected values
   jest.mock('../src/service', () => ({
     serviceMethod: jest.fn().mockResolvedValue(expectedValue)
   }));
   ```

### Performance Issues

1. **Database Connections**: Use connection pooling
2. **Test Data**: Minimize test data size
3. **Parallel Execution**: Configure appropriate maxWorkers
4. **Cleanup**: Ensure proper resource cleanup

This testing guide provides a comprehensive foundation for maintaining and extending the HASEB test suite. Regular updates and adherence to these practices will ensure system reliability and performance.