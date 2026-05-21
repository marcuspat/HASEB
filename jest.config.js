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
    // Root uuid (v13) is ESM-only and the LangChain-bundled uuid (v10) resolves
    // to its untranspiled esm-browser build under the jsdom environment. The
    // `transform` config only handles .tsx?, so neither gets transpiled and the
    // raw `export` tokens crash module load. Force every `uuid` import to the
    // bundled v10 CommonJS build, which loads without transformation.
    '^uuid$': '<rootDir>/node_modules/@langchain/langgraph/node_modules/uuid/dist/index.js',
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
  restoreMocks: true,
};