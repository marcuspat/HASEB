import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RobustnessMetricsCollector } from '@/services/metrics/RobustnessMetricsCollector';
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

describe('RobustnessMetricsCollector', () => {
  let collector: RobustnessMetricsCollector;
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

    collector = new RobustnessMetricsCollector(context, {
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

  describe('Error Recording', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record fatal errors without throwing', () => {
      expect(() => {
        collector.recordError('fatal', 'timeout', 'Task execution timed out');
      }).not.toThrow();
    });

    it('should record recoverable errors without throwing', () => {
      expect(() => {
        collector.recordError('recoverable', 'api_failure', 'API call failed');
      }).not.toThrow();
    });

    it('should record transient errors without throwing', () => {
      expect(() => {
        collector.recordError('transient', 'network', 'Network connection lost');
      }).not.toThrow();
    });

    it('should record errors with context', () => {
      expect(() => {
        collector.recordError('fatal', 'timeout', 'Task timed out', {
          taskId: 'task-123',
          timeout: 30000
        });
      }).not.toThrow();
    });

    it('should record different error categories', () => {
      expect(() => {
        collector.recordError('recoverable', 'resource_exhaustion', 'Memory limit exceeded');
        collector.recordError('recoverable', 'logic_error', 'Invalid parameter value');
        collector.recordError('transient', 'unexpected_input', 'Malformed data received');
        collector.recordError('fatal', 'unknown', 'Unknown error occurred');
      }).not.toThrow();
    });

    it('should handle recording multiple errors', () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          collector.recordError('transient', 'network', `Network error ${i}`);
        }
      }).not.toThrow();
    });
  });

  describe('Recovery Recording', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record recovery attempts without throwing', () => {
      const errorId = collector.recordError('recoverable', 'api_failure', 'API call failed');

      expect(() => {
        collector.recordRecoveryAttempt(errorId, 'retry_with_backoff', true, 1000);
      }).not.toThrow();
    });

    it('should record failed recovery attempts', () => {
      const errorId = collector.recordError('recoverable', 'api_failure', 'API call failed');

      expect(() => {
        collector.recordRecoveryAttempt(errorId, 'retry_with_backoff', false, 500);
      }).not.toThrow();
    });

    it('should handle multiple recovery attempts', () => {
      const errorId = collector.recordError('recoverable', 'api_failure', 'API call failed');

      expect(() => {
        collector.recordRecoveryAttempt(errorId, 'retry_with_backoff', false, 500);
        collector.recordRecoveryAttempt(errorId, 'retry_with_backoff', false, 1000);
        collector.recordRecoveryAttempt(errorId, 'retry_with_backoff', true, 2000);
      }).not.toThrow();
    });

    it('should handle recovery attempts for non-existent errors gracefully', () => {
      expect(() => {
        collector.recordRecoveryAttempt('non-existent-error', 'retry', true, 1000);
      }).not.toThrow();
    });

    it('should record different recovery strategies', () => {
      const errorId1 = collector.recordError('recoverable', 'api_failure', 'API rate limit');
      const errorId2 = collector.recordError('recoverable', 'timeout', 'Task timeout');

      expect(() => {
        collector.recordRecoveryAttempt(errorId1, 'exponential_backoff', true, 5000);
        collector.recordRecoveryAttempt(errorId2, 'increase_timeout', true, 2000);
      }).not.toThrow();
    });
  });

  describe('Downtime Recording', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record downtime start without throwing', () => {
      expect(() => {
        collector.recordDowntimeStart('Database connection lost');
      }).not.toThrow();
    });

    it('should record downtime with impact level', () => {
      expect(() => {
        collector.recordDowntimeStart('API rate limit exceeded', 'partial');
        collector.recordDowntimeStart('System crash', 'full');
      }).not.toThrow();
    });

    it('should record downtime end without throwing', () => {
      collector.recordDowntimeStart('Maintenance window');

      expect(() => {
        collector.recordDowntimeEnd();
      }).not.toThrow();
    });

    it('should handle downtime end without active downtime gracefully', () => {
      expect(() => {
        collector.recordDowntimeEnd(); // No active downtime
      }).not.toThrow();
    });

    it('should handle multiple downtime periods', () => {
      expect(() => {
        collector.recordDowntimeStart('First incident');
        collector.recordDowntimeEnd();

        collector.recordDowntimeStart('Second incident');
        collector.recordDowntimeEnd();
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
      collector.recordError('transient', 'network', 'Network timeout');
      collector.recordRecoveryAttempt(
        collector['state'].errors.keys().next().value,
        'retry',
        true,
        1000
      );

      expect(() => {
        const metrics = collector.getCurrentMetrics();
        // Should not throw even if metrics are null
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });

    it('should have getRobustnessSummary method', () => {
      expect(typeof collector.getRobustnessSummary).toBe('function');

      const summary = collector.getRobustnessSummary();
      expect(typeof summary).toBe('object');
      expect(summary).toHaveProperty('errorRate');
      expect(summary).toHaveProperty('recoveryRate');
      expect(summary).toHaveProperty('availability');
      expect(summary).toHaveProperty('averageRecoveryTime');
      expect(summary).toHaveProperty('totalErrors');
      expect(summary).toHaveProperty('successfulRecoveries');
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

    it('should not throw when recording errors that emit events', () => {
      expect(() => {
        collector.recordError('transient', 'network', 'Test error');
        collector.recordDowntimeStart('Test downtime');
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should handle empty error messages', () => {
      expect(() => {
        collector.recordError('transient', 'unknown', '');
      }).not.toThrow();
    });

    it('should handle null error context', () => {
      expect(() => {
        collector.recordError('fatal', 'timeout', 'Test error', null as any);
      }).not.toThrow();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'x'.repeat(10000);
      expect(() => {
        collector.recordError('transient', 'unknown', longMessage);
      }).not.toThrow();
    });

    it('should handle rapid successive errors', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          collector.recordError('transient', 'network', `Error ${i}`);
        }
      }).not.toThrow();
    });

    it('should handle undefined recovery strategy', () => {
      const errorId = collector.recordError('recoverable', 'api_failure', 'Test error');

      expect(() => {
        collector.recordRecoveryAttempt(errorId, undefined as any, true, 1000);
      }).not.toThrow();
    });

    it('should handle negative recovery duration', () => {
      const errorId = collector.recordError('recoverable', 'api_failure', 'Test error');

      expect(() => {
        collector.recordRecoveryAttempt(errorId, 'retry', true, -1000);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on stop', async () => {
      await collector.start();
      collector.recordError('transient', 'network', 'Test error');

      expect(() => {
        collector.stop();
      }).not.toThrow();

      expect(collector.isCollectorActive()).toBe(false);
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await collector.start();
        expect(collector.isCollectorActive()).toBe(true);

        collector.recordError('transient', 'network', `Error ${i}`);
        collector.recordDowntimeStart(`Incident ${i}`);
        collector.recordDowntimeEnd();

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

  describe('Complex Robustness Scenarios', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should simulate complete error-recovery cycle', () => {
      expect(() => {
        // Record an error
        const errorId = collector.recordError('recoverable', 'api_failure', 'Rate limit exceeded', {
          endpoint: '/api/v1/chat',
          statusCode: 429
        });

        // Attempt recovery
        collector.recordRecoveryAttempt(errorId, 'exponential_backoff', false, 1000);
        collector.recordRecoveryAttempt(errorId, 'exponential_backoff', true, 2000);

        // Record downtime during the issue
        collector.recordDowntimeStart('API rate limiting', 'partial');
        collector.recordDowntimeEnd();

        // Verify summary can be calculated
        const summary = collector.getRobustnessSummary();
        expect(typeof summary.errorRate).toBe('number');
        expect(typeof summary.recoveryRate).toBe('number');
      }).not.toThrow();
    });

    it('should handle mixed error types and recovery patterns', () => {
      expect(() => {
        // Multiple different errors
        const error1 = collector.recordError('fatal', 'timeout', 'Critical service timeout');
        const error2 = collector.recordError('recoverable', 'api_failure', 'API error');
        const error3 = collector.recordError('transient', 'network', 'Network blip');

        // Different recovery outcomes
        collector.recordRecoveryAttempt(error2, 'retry', true, 500);
        collector.recordRecoveryAttempt(error3, 'retry', true, 200);
        // error1 is fatal, no recovery

        // Multiple downtime periods
        collector.recordDowntimeStart('Critical failure', 'full');
        collector.recordDowntimeEnd();
        collector.recordDowntimeStart('Minor issue', 'partial');
        collector.recordDowntimeEnd();

        // Get comprehensive metrics
        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });
  });
});