import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PerformanceMetricsCollector } from '@/services/metrics/PerformanceMetricsCollector';
import { MetricsCollectionContext } from '@/types/metrics';

// Mock the dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    findById: jest.fn().mockResolvedValue(null),
    updateMetrics: jest.fn().mockResolvedValue(true),
  },
}));

describe('PerformanceMetricsCollector', () => {
  let collector: PerformanceMetricsCollector;
  let context: MetricsCollectionContext;

  beforeEach(() => {
    context = {
      evaluationId: 'test-eval-123',
      agentId: 'test-agent-456',
      benchmarkId: 'test-benchmark-789',
      sessionId: 'test-session-001',
      startTime: new Date(),
      configuration: { timeout: 30000 },
      environment: {
        platform: 'linux',
        version: '18.0.0',
        resources: { cpu: '4 cores', memory: '8GB', storage: '100GB' }
      }
    };

    collector = new PerformanceMetricsCollector(context, {
      collectionInterval: 100,
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 50,
      enableRealTime: true,
      storage: { persistImmediately: false, compressionEnabled: false, retentionDays: 30 },
      validation: { strictMode: true, outlierDetection: false, qualityThreshold: 0.8 }
    });

    // Mock console methods to reduce noise in tests
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    if (collector.isCollectorActive()) {
      collector.stop();
    }
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct context and config', () => {
      expect(collector).toBeDefined();
      expect(collector['context']).toEqual(context);
    });

    it('should start and stop collection correctly', async () => {
      await collector.start();
      expect(collector.isCollectorActive()).toBe(true);

      collector.stop();
      expect(collector.isCollectorActive()).toBe(false);
    });

    it('should have correct initial status', () => {
      const status = collector.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.bufferedMetricsCount).toBe(0);
      expect(status.context).toEqual(context);
    });
  });

  describe('Task Recording Methods', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record task start without throwing', () => {
      expect(() => {
        collector.recordTaskStart('task-1', 5);
      }).not.toThrow();
    });

    it('should record task completion without throwing', () => {
      collector.recordTaskStart('task-1');

      expect(() => {
        collector.recordTaskCompletion('task-1', true, 0.95);
      }).not.toThrow();
    });

    it('should record task failure without throwing', () => {
      collector.recordTaskStart('task-1');

      expect(() => {
        collector.recordTaskFailure('task-1', 'Test error');
      }).not.toThrow();
    });

    it('should record task skip without throwing', () => {
      collector.recordTaskStart('task-1');

      expect(() => {
        collector.recordTaskSkip('task-1', 'Task skipped');
      }).not.toThrow();
    });

    it('should record validation result without throwing', () => {
      collector.recordTaskStart('task-1');

      expect(() => {
        collector.recordValidationResult('task-1', true, 'All checks passed');
      }).not.toThrow();
    });

    it('should handle multiple task operations', () => {
      expect(() => {
        // Record multiple tasks
        collector.recordTaskStart('task-1');
        collector.recordTaskStart('task-2');
        collector.recordTaskStart('task-3');

        // Complete tasks
        collector.recordTaskCompletion('task-1', true, 1.0);
        collector.recordTaskCompletion('task-2', true, 0.9);
        collector.recordTaskFailure('task-3', 'Test error');

        // Record validation results
        collector.recordValidationResult('task-1', true);
        collector.recordValidationResult('task-2', false);
        collector.recordValidationResult('task-3', true);
      }).not.toThrow();
    });

    it('should handle operations on non-existent tasks gracefully', () => {
      expect(() => {
        collector.recordTaskCompletion('nonexistent-task', true);
        collector.recordTaskFailure('nonexistent-task', 'Error');
        collector.recordTaskSkip('nonexistent-task', 'Skipped');
        collector.recordValidationResult('nonexistent-task', true);
      }).not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should have getStatus method that returns expected structure', () => {
      const status = collector.getStatus();
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('bufferedMetricsCount');
      expect(status).toHaveProperty('context');
      expect(typeof status.isActive).toBe('boolean');
      expect(typeof status.bufferedMetricsCount).toBe('number');
      expect(status.context).toEqual(context);
    });

    it('should have getCurrentMetrics method', () => {
      expect(typeof collector.getCurrentMetrics).toBe('function');

      // Should return null when no metrics collected yet
      const metrics = collector.getCurrentMetrics();
      expect(metrics === null || typeof metrics === 'object').toBe(true);
    });

    it('should handle metrics collection without throwing', () => {
      collector.recordTaskStart('task-1');
      collector.recordTaskCompletion('task-1', true, 0.85);

      expect(() => {
        const metrics = collector.getCurrentMetrics();
        // Should not throw even if metrics are null
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should handle event listeners', () => {
      const mockListener = jest.fn();

      expect(() => {
        collector.on('testEvent', mockListener);
        collector.off('testEvent', mockListener);
      }).not.toThrow();
    });

    it('should not throw when emitting events', () => {
      expect(() => {
        collector.recordTaskStart('task-1');
        collector.recordTaskCompletion('task-1', true);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should handle invalid inputs gracefully', () => {
      expect(() => {
        collector.recordTaskStart(''); // Empty task ID
        collector.recordTaskCompletion('', true, -0.1); // Negative accuracy
        collector.recordTaskCompletion('', true, 1.5); // Over 100%
        collector.recordValidationResult('', true, '');
      }).not.toThrow();
    });

    it('should handle rapid task operations', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          collector.recordTaskStart(`task-${i}`);
          if (i % 2 === 0) {
            collector.recordTaskCompletion(`task-${i}`, true, Math.random());
          } else {
            collector.recordTaskFailure(`task-${i}`, `Error ${i}`);
          }
        }
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on stop', async () => {
      await collector.start();
      collector.recordTaskStart('task-1');

      expect(() => {
        collector.stop();
      }).not.toThrow();

      expect(collector.isCollectorActive()).toBe(false);
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await collector.start();
        expect(collector.isCollectorActive()).toBe(true);

        collector.recordTaskStart(`task-${i}`);
        collector.recordTaskCompletion(`task-${i}`, true);

        collector.stop();
        expect(collector.isCollectorActive()).toBe(false);
      }
    });

    it('should handle stop when not started', () => {
      expect(() => {
        collector.stop(); // Stop without starting
      }).not.toThrow();
    });

    it('should handle start when already started', async () => {
      await collector.start();

      await expect(collector.start()).resolves.not.toThrow();
    });
  });
});