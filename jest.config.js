/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom', // Changed to jsdom to support DOM APIs for React hooks
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  // Jest owns *.test.ts(x); Playwright owns *.spec.ts (see playwright.config.ts).
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/?(*.)+(test).{ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '<rootDir>/tests/e2e/',
    // Integration tests that require a live PostgreSQL database — run via
    // `npm run test:integration` with DB_HOST_TEST configured.
    '<rootDir>/tests/integration/api.test.ts',
    '<rootDir>/tests/integration/database.test.ts',
    // Performance/security suites also depend on TestDatabase + live DB.
    '<rootDir>/tests/performance/benchmark.test.ts',
    '<rootDir>/tests/performance/load.test.ts',
    '<rootDir>/tests/security/auth.test.ts',
    '<rootDir>/tests/security/api-security.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2015',
        jsx: 'react-jsx'
      }
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.spec.ts',
    '!src/**/*.spec.tsx',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'clover',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/polyfills.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.jsx?$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@langchain|@langgraph|langgraph)/)'
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};