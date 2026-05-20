import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { EnvironmentManager as EnvironmentManagerType } from '@/orchestrator/EnvironmentManager';

// Under this repo's native-ESM Jest setup, `jest.mock(path, factory)` does not
// reliably intercept static imports of the module under test. Use the
// ESM-correct `jest.unstable_mockModule` + a dynamic `import()` performed AFTER
// the mocks are registered.

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// child_process is used both via `spawn` and a dynamic `import('child_process')`
// (for `exec` in validateDockerInstallation). Provide both so neither touches
// the real system.
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn((_cmd: string, cb: (err: Error | null, stdout: string) => void) => {
    // Report Docker as unavailable so the manager falls back to 'local'.
    cb(new Error('docker not found'), '');
  }),
}));

jest.unstable_mockModule('fs', () => ({
  promises: {
    writeFile: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    rm: jest.fn(async () => undefined),
  },
}));

jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

const { EnvironmentManager } = await import('@/orchestrator/EnvironmentManager');

// REAL API: createEnvironment(evaluationId, config) where config is an
// EnvironmentConfig. The environment type is read from
// config.configuration.environmentType (defaults to the manager's default,
// which becomes 'local' once Docker validation fails above).
const makeConfig = (evaluationId: string, overrides: Record<string, any> = {}) => ({
  evaluationId,
  agentId: 'test-agent',
  benchmarkId: 'test-benchmark',
  configuration: {
    environmentType: 'local',
    resources: { cpu: 2, memory: 4096, disk: 10240 },
    ...overrides,
  },
});

describe('EnvironmentManager', () => {
  let environmentManager: EnvironmentManagerType;

  beforeEach(() => {
    // REAL API: constructor takes NO arguments.
    environmentManager = new EnvironmentManager();
  });

  afterEach(() => {
    // Stop the cleanup interval started in the constructor so it does not leak
    // an open handle / keep the test runner alive.
    environmentManager.stopCleanup();
  });

  describe('Initialization', () => {
    it('should construct with no arguments and expose the real API', () => {
      expect(environmentManager).toBeDefined();
      expect(typeof environmentManager.createEnvironment).toBe('function');
      expect(typeof environmentManager.cleanupEnvironment).toBe('function');
      expect(typeof environmentManager.cleanupAll).toBe('function');
      expect(typeof environmentManager.getEnvironmentStatus).toBe('function');
      expect(typeof environmentManager.getEnvironmentStats).toBe('function');
      expect(typeof environmentManager.stopCleanup).toBe('function');
    });

    it('should report empty stats before any environments are created', () => {
      const stats = environmentManager.getEnvironmentStats();
      expect(stats.totalEnvironments).toBe(0);
      expect(stats.activeEnvironments).toBe(0);
    });
  });

  describe('Environment Creation', () => {
    it('should create a local environment and return it with the expected shape', async () => {
      const environment = await environmentManager.createEnvironment(
        'test-eval-123',
        makeConfig('test-eval-123')
      );

      expect(environment).toBeDefined();
      expect(environment.id).toBe('test-eval-123');
      expect(environment.type).toBe('local');
      expect(environment.status).toBe('ready');
      expect(environment.endpoint).toContain('test-eval-123');
    });

    it('should track created environments in the stats', async () => {
      await environmentManager.createEnvironment('stats-eval', makeConfig('stats-eval'));

      const stats = environmentManager.getEnvironmentStats();
      expect(stats.totalEnvironments).toBe(1);
      expect(stats.activeEnvironments).toBe(1);
    });

    it('should create multiple distinct environments', async () => {
      const env1 = await environmentManager.createEnvironment('test-eval-1', makeConfig('test-eval-1'));
      const env2 = await environmentManager.createEnvironment('test-eval-2', makeConfig('test-eval-2'));

      expect(env1.id).toBe('test-eval-1');
      expect(env2.id).toBe('test-eval-2');
      expect(env1.id).not.toBe(env2.id);

      const stats = environmentManager.getEnvironmentStats();
      expect(stats.totalEnvironments).toBe(2);
    });

    it('should emit an environmentCreated event', async () => {
      const listener = jest.fn();
      environmentManager.on('environmentCreated', listener);

      await environmentManager.createEnvironment('event-eval', makeConfig('event-eval'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toBe('event-eval');
    });

    it('should reject creation once the maximum environment limit is exceeded', async () => {
      // The default resource limit is 20 environments.
      for (let i = 0; i < 20; i++) {
        await environmentManager.createEnvironment(`bulk-${i}`, makeConfig(`bulk-${i}`));
      }

      await expect(
        environmentManager.createEnvironment('overflow', makeConfig('overflow'))
      ).rejects.toThrow('Maximum environment limit reached');
    });
  });

  describe('Resource Management', () => {
    it('should propagate requested resources onto the created environment', async () => {
      const environment = await environmentManager.createEnvironment(
        'resource-test',
        makeConfig('resource-test', { resources: { cpu: 2, memory: 4096, disk: 20 } })
      );

      // Local environments report a fixed default resource profile.
      expect(environment.resources.cpu).toBe(2);
      expect(environment.resources.memory).toBe(4096);
      expect(typeof environment.resources.disk).toBe('number');
    });
  });

  describe('Environment Status', () => {
    it('should report a created environment status as ready', async () => {
      const environment = await environmentManager.createEnvironment('status-test', makeConfig('status-test'));
      expect(['ready', 'creating', 'running']).toContain(environment.status);
    });

    it('should return the environment via getEnvironmentStatus', async () => {
      await environmentManager.createEnvironment('status-get', makeConfig('status-get'));
      const status = await environmentManager.getEnvironmentStatus('status-get');
      expect(status).not.toBeNull();
      expect(status?.id).toBe('status-get');
    });

    it('should return null for an unknown environment', async () => {
      const status = await environmentManager.getEnvironmentStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should clean up a single environment and remove it from state', async () => {
      await environmentManager.createEnvironment('cleanup-one', makeConfig('cleanup-one'));
      expect(environmentManager.getEnvironmentStats().totalEnvironments).toBe(1);

      await environmentManager.cleanupEnvironment('cleanup-one');

      expect(environmentManager.getEnvironmentStats().totalEnvironments).toBe(0);
      expect(await environmentManager.getEnvironmentStatus('cleanup-one')).toBeNull();
    });

    it('should emit environmentCleanedUp when cleaning up an environment', async () => {
      const listener = jest.fn();
      environmentManager.on('environmentCleanedUp', listener);

      await environmentManager.createEnvironment('cleanup-event', makeConfig('cleanup-event'));
      await environmentManager.cleanupEnvironment('cleanup-event');

      expect(listener).toHaveBeenCalledWith('cleanup-event');
    });

    it('should not throw when cleaning up a non-existent environment', async () => {
      await expect(environmentManager.cleanupEnvironment('nope')).resolves.toBeUndefined();
    });

    it('should clean up all environments via cleanupAll', async () => {
      await environmentManager.createEnvironment('all-1', makeConfig('all-1'));
      await environmentManager.createEnvironment('all-2', makeConfig('all-2'));

      await environmentManager.cleanupAll();

      expect(environmentManager.getEnvironmentStats().totalEnvironments).toBe(0);
    });

    it('should clear the cleanup timer via stopCleanup so no handle leaks', () => {
      // stopCleanup should be idempotent and never throw.
      expect(() => {
        environmentManager.stopCleanup();
        environmentManager.stopCleanup();
      }).not.toThrow();
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent environment creation', async () => {
      const promises = Array(5)
        .fill(null)
        .map((_, i) => environmentManager.createEnvironment(`concurrent-${i}`, makeConfig(`concurrent-${i}`)));

      const environments = await Promise.all(promises);
      expect(environments).toHaveLength(5);
      expect(environmentManager.getEnvironmentStats().totalEnvironments).toBe(5);

      await Promise.all(environments.map(env => environmentManager.cleanupEnvironment(env.id)));
      expect(environmentManager.getEnvironmentStats().totalEnvironments).toBe(0);
    });
  });
});
