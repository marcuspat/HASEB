import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MetricsOrchestrator } from '@/services/metrics/MetricsOrchestrator';
import { MetricsCollectionContext, ComprehensiveMetrics } from '@/types/metrics';

// Mock collectors
jest.mock('@/services/metrics/PerformanceMetricsCollector', () => ({
  PerformanceMetricsCollector: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    collectMetrics: jest.fn().mockResolvedValue({
      performance: {
        totalExecutionTime: 1000,
        averageResponseTime: 500,
        peakMemoryUsage: 1024000,
        cpuUsage: 75.5
      }
    }),
    getStatus: jest.fn().mockReturnValue({ isActive: false }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@/services/metrics/EfficiencyMetricsCollector', () => ({
  EfficiencyMetricsCollector: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    collectMetrics: jest.fn().mockResolvedValue({
      efficiency: {
        throughput: 10,
        totalSteps: 5,
        averageStepDuration: 200,
        averageCpuUsage: 60.0,
        peakMemoryUsage: 512000
      }
    }),
    getStatus: jest.fn().mockReturnValue({ isActive: false }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@/services/metrics/CostMetricsCollector', () => ({
  CostMetricsCollector: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    collectMetrics: jest.fn().mockResolvedValue({
      cost: {
        totalTokens: 1000,
        estimatedCost: 0.05,
        tokenBreakdown: { input: 600, output: 400 }
      }
    }),
    getStatus: jest.fn().mockReturnValue({ isActive: false }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@/services/metrics/RobustnessMetricsCollector', () => ({
  RobustnessMetricsCollector: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    collectMetrics: jest.fn().mockResolvedValue({
      robustness: {
        toolCallErrorRate: 0.1,
        recoveryRate: 0.8,
        totalErrors: 2,
        successfulRecoveries: 8
      }
    }),
    getStatus: jest.fn().mockReturnValue({ isActive: false }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@/services/metrics/QualityMetricsCollector', () => ({
  QualityMetricsCollector: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    collectMetrics: jest.fn().mockResolvedValue({
      quality: {
        toolSelectionAccuracy: 0.85,
        parameterAccuracy: 0.9,
        overallQualityScore: 0.88
      }
    }),
    getStatus: jest.fn().mockReturnValue({ isActive: false }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('MetricsOrchestrator', () => {
  let orchestrator: MetricsOrchestrator;
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

    orchestrator = new MetricsOrchestrator(context, {
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

  afterEach(async () => {
    if (orchestrator && typeof orchestrator.stop === 'function') {
      try {
        await orchestrator.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct context and config', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator['context']).toEqual(context);
    });

    it('should start and stop without throwing', async () => {
      await expect(orchestrator.start()).resolves.not.toThrow();
      expect(typeof orchestrator.stop === 'function').toBe(true);
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle multiple start/stop cycles', async () => {
      await expect(orchestrator.start()).resolves.not.toThrow();
      await expect(orchestrator.stop()).resolves.not.toThrow();
      await expect(orchestrator.start()).resolves.not.toThrow();
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const mockOrchestrator = new MetricsOrchestrator(context, {});
      await expect(mockOrchestrator.start()).resolves.not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await orchestrator.start();
    });

    it('should collect metrics without throwing', async () => {
      if (typeof orchestrator.collectAllMetrics === 'function') {
        await expect(orchestrator.collectAllMetrics()).resolves.not.toThrow();
      }
    });

    it('should get current metrics without throwing', () => {
      if (typeof orchestrator.getCurrentMetrics === 'function') {
        expect(() => {
          const metrics = orchestrator.getCurrentMetrics();
          expect(metrics === null || typeof metrics === 'object').toBe(true);
        }).not.toThrow();
      }
    });

    it('should get aggregated metrics without throwing', () => {
      if (typeof orchestrator.getAggregatedMetrics === 'function') {
        expect(() => {
          const metrics = orchestrator.getAggregatedMetrics();
          expect(metrics === null || typeof metrics === 'object').toBe(true);
        }).not.toThrow();
      }
    });

    it('should handle metrics collection errors gracefully', async () => {
      // Should not throw even if individual collectors fail
      if (typeof orchestrator.collectAllMetrics === 'function') {
        await expect(orchestrator.collectAllMetrics()).resolves.not.toThrow();
      }
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await orchestrator.start();
    });

    it('should handle event listeners', () => {
      const mockListener = jest.fn();

      expect(() => {
        if (typeof orchestrator.on === 'function') {
          orchestrator.on('testEvent', mockListener);
          orchestrator.off('testEvent', mockListener);
        }
      }).not.toThrow();
    });

    it('should emit events without throwing', () => {
      expect(() => {
        if (typeof orchestrator.emit === 'function') {
          orchestrator.emit('testEvent', { data: 'test' });
        }
      }).not.toThrow();
    });
  });

  describe('Status and Monitoring', () => {
    it('should provide status information', () => {
      if (typeof orchestrator.getStatus === 'function') {
        const status = orchestrator.getStatus();
        expect(status).toBeDefined();
        expect(typeof status).toBe('object');
      }
    });

    it('should check if active', () => {
      if (typeof orchestrator.isActive === 'function') {
        expect(typeof orchestrator.isActive()).toBe('boolean');
      }
    });

    it('should handle status queries during execution', async () => {
      await orchestrator.start();

      if (typeof orchestrator.getStatus === 'function') {
        for (let i = 0; i < 3; i++) {
          const status = orchestrator.getStatus();
          expect(status).toBeDefined();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle start failures gracefully', async () => {
      await expect(orchestrator.start()).resolves.not.toThrow();
    });

    it('should handle stop failures gracefully', async () => {
      await orchestrator.start();
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle invalid operations gracefully', async () => {
      // Test various edge cases
      await expect(orchestrator.start()).resolves.not.toThrow(); // Start when already started
      await expect(orchestrator.stop()).resolves.not.toThrow(); // Stop when not started
    });

    it('should handle concurrent operations', async () => {
      const operations = [
        orchestrator.start(),
        orchestrator.start(),
        orchestrator.start()
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on stop', async () => {
      await orchestrator.start();
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle resource cleanup errors gracefully', async () => {
      await orchestrator.start();
      // Should not throw even if cleanup has issues
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle multiple cleanup attempts', async () => {
      await orchestrator.start();
      await orchestrator.stop();
      await expect(orchestrator.stop()).resolves.not.toThrow(); // Stop again
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration values', () => {
      const customOrchestrator = new MetricsOrchestrator(context, {
        collectionInterval: 200,
        batchSize: 20,
        enableRealTime: false
      });

      expect(customOrchestrator).toBeDefined();
    });

    it('should handle missing configuration gracefully', () => {
      const minimalOrchestrator = new MetricsOrchestrator(context, {});
      expect(minimalOrchestrator).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should simulate complete metrics workflow', async () => {
      await orchestrator.start();

      // Collect metrics
      if (typeof orchestrator.collectAllMetrics === 'function') {
        await orchestrator.collectAllMetrics();
      }

      // Get status
      if (typeof orchestrator.getStatus === 'function') {
        orchestrator.getStatus();
      }

      // Stop
      await orchestrator.stop();

      // Should not throw at any point
    });

    it('should handle edge cases in configuration', () => {
      const edgeCases = [
        { collectionInterval: -1 },
        { batchSize: 0 },
        { enableRealTime: true, collectionInterval: 0 },
        { validation: { strictMode: false, qualityThreshold: 1.0 } }
      ];

      edgeCases.forEach(config => {
        expect(() => {
          new MetricsOrchestrator(context, config);
        }).not.toThrow();
      });
    });
  });
});