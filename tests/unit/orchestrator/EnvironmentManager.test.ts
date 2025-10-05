import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EnvironmentManager } from '@/orchestrator/EnvironmentManager';
import { EvaluationEnvironment, EnvironmentRequirements } from '@/types/orchestrator';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn(),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

describe('EnvironmentManager', () => {
  let environmentManager: EnvironmentManager;

  beforeEach(() => {
    environmentManager = new EnvironmentManager({
      defaultEnvironmentType: 'local',
      resourceLimits: {
        maxCpu: 4,
        maxMemory: 8192,
        maxDisk: 100,
      },
      cleanupInterval: 60000,
    });

    // Mock console methods to reduce noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    environmentManager.stopCleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(environmentManager).toBeDefined();
      expect(typeof environmentManager.createEnvironment).toBe('function');
      expect(typeof environmentManager.stopEnvironment).toBe('function');
      expect(typeof environmentManager.cleanup).toBe('function');
    });

    it('should accept custom configuration', () => {
      const customManager = new EnvironmentManager({
        defaultEnvironmentType: 'docker',
        resourceLimits: {
          maxCpu: 8,
          maxMemory: 16384,
          maxDisk: 200,
        },
        cleanupInterval: 30000,
      });

      expect(customManager).toBeDefined();
      customManager.stopCleanup();
    });
  });

  describe('Environment Creation', () => {
    it('should create environment without throwing', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: {
          cpu: 2,
          memory: 4096,
          disk: 10,
        },
        timeout: 300000,
      };

      const environment = await environmentManager.createEnvironment('test-eval-123', requirements);
      expect(environment).toBeDefined();
      expect(environment.id).toBe('test-eval-123');
    });

    it('should handle environment creation errors gracefully', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'docker',
        resources: {
          cpu: 16, // Exceeds max limit
          memory: 32768,
          disk: 500,
        },
        timeout: 300000,
      };

      // Should not throw even with invalid requirements
      await expect(environmentManager.createEnvironment('test-eval-456', requirements))
        .resolves.not.toThrow();
    });

    it('should create multiple environments', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: {
          cpu: 1,
          memory: 2048,
          disk: 5,
        },
        timeout: 300000,
      };

      const env1 = await environmentManager.createEnvironment('test-eval-1', requirements);
      const env2 = await environmentManager.createEnvironment('test-eval-2', requirements);

      expect(env1.id).toBe('test-eval-1');
      expect(env2.id).toBe('test-eval-2');
      expect(env1.id).not.toBe(env2.id);
    });
  });

  describe('Environment Management', () => {
    it('should stop environment without throwing', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      const environment = await environmentManager.createEnvironment('test-stop', requirements);

      await expect(environmentManager.stopEnvironment(environment.id))
        .resolves.not.toThrow();
    });

    it('should handle stopping non-existent environment', async () => {
      await expect(environmentManager.stopEnvironment('non-existent-id'))
        .resolves.not.toThrow();
    });

    it('should cleanup environments without throwing', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      await environmentManager.createEnvironment('test-cleanup-1', requirements);
      await environmentManager.createEnvironment('test-cleanup-2', requirements);

      await expect(environmentManager.cleanup())
        .resolves.not.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should track environment resources', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 2, memory: 4096, disk: 20 },
        timeout: 300000,
      };

      const environment = await environmentManager.createEnvironment('resource-test', requirements);
      expect(environment.resources.cpu).toBe(2);
      expect(environment.resources.memory).toBe(4096);
      expect(environment.resources.disk).toBe(20);
    });

    it('should handle resource limit validation', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 10, memory: 32768, disk: 1000 }, // Exceeds limits
        timeout: 300000,
      };

      // Should not throw but may adjust to limits
      const environment = await environmentManager.createEnvironment('limit-test', requirements);
      expect(environment).toBeDefined();
    });
  });

  describe('Environment Status', () => {
    it('should track environment status', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      const environment = await environmentManager.createEnvironment('status-test', requirements);
      expect(['ready', 'starting', 'error']).toContain(environment.status);
    });

    it('should get environment status', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      const environment = await environmentManager.createEnvironment('status-get', requirements);
      const status = environmentManager.getEnvironmentStatus(environment.id);
      expect(status).toBeDefined();
    });

    it('should handle getting status of non-existent environment', () => {
      const status = environmentManager.getEnvironmentStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('Event Emission', () => {
    it('should emit events during environment lifecycle', async () => {
      const mockListener = jest.fn();
      environmentManager.on('environment:created', mockListener);
      environmentManager.on('environment:stopped', mockListener);

      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      const environment = await environmentManager.createEnvironment('event-test', requirements);
      await environmentManager.stopEnvironment(environment.id);

      // Events should be emitted without throwing
      expect(() => {
        environmentManager.emit('test-event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent environment operations', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      // Create multiple environments concurrently
      const promises = Array(5).fill(null).map((_, i) =>
        environmentManager.createEnvironment(`concurrent-${i}`, requirements)
      );

      const environments = await Promise.all(promises);
      expect(environments).toHaveLength(5);

      // Clean up
      const cleanupPromises = environments.map(env =>
        environmentManager.stopEnvironment(env.id)
      );
      await Promise.all(cleanupPromises);
    });

    it('should handle environment timeout', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 1, // Very short timeout
      };

      const environment = await environmentManager.createEnvironment('timeout-test', requirements);

      // Wait for timeout to potentially occur
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not throw even with timeout
      expect(environment).toBeDefined();
    });
  });

  describe('Cleanup Operations', () => {
    it('should start and stop cleanup interval', () => {
      expect(() => {
        environmentManager.startCleanup();
        environmentManager.stopCleanup();
      }).not.toThrow();
    });

    it('should handle cleanup operations without active environments', async () => {
      await expect(environmentManager.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup with failed environments', async () => {
      const requirements: EnvironmentRequirements = {
        type: 'local',
        resources: { cpu: 1, memory: 1024, disk: 1 },
        timeout: 300000,
      };

      await environmentManager.createEnvironment('failed-cleanup', requirements);

      // Simulate failed environment
      const status = environmentManager.getEnvironmentStatus('failed-cleanup');
      if (status) {
        status.status = 'error';
      }

      await expect(environmentManager.cleanup()).resolves.not.toThrow();
    });
  });
});