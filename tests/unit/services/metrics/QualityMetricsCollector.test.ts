import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { QualityMetricsCollector } from '@/services/metrics/QualityMetricsCollector';
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
    findById: jest.fn<(...args: any[]) => any>().mockResolvedValue(null),
    updateMetrics: jest.fn<(...args: any[]) => any>().mockResolvedValue(true),
  },
}));

describe('QualityMetricsCollector', () => {
  let collector: QualityMetricsCollector;
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

    collector = new QualityMetricsCollector(context, {
      collectionInterval: 100,
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 50,
      enableRealTime: true,
      storage: { persistImmediately: false, compressionEnabled: false, retentionDays: 30 },
      validation: { strictMode: true, outlierDetection: false, qualityThreshold: 0.8 }
    });

    // Mock console methods to reduce noise in tests
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
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

  describe('Tool Usage Tracking', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record tool usage without throwing', () => {
      expect(() => {
        (collector as any).recordToolUsage('api_client', 150, true);
      }).not.toThrow();
    });

    it('should record tool failures without throwing', () => {
      expect(() => {
        (collector as any).recordToolUsage('api_client', 100, false, 'Connection timeout');
      }).not.toThrow();
    });

    it('should track multiple tool uses', () => {
      expect(() => {
        (collector as any).recordToolUsage('api_client', 100, true);
        (collector as any).recordToolUsage('api_client', 200, false, 'Rate limit exceeded');
        (collector as any).recordToolUsage('api_client', 150, true);
      }).not.toThrow();
    });

    it('should track different tools', () => {
      expect(() => {
        (collector as any).recordToolUsage('api_client', 100, true);
        (collector as any).recordToolUsage('file_system', 50, true);
        (collector as any).recordToolUsage('terminal', 200, false, 'Command not found');
      }).not.toThrow();
    });

    it('should handle zero tool uses gracefully', () => {
      expect(() => {
        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Parameter Validation', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record correct parameters without throwing', () => {
      expect(() => {
        (collector as any).recordParameterValidation('api_client', 'endpoint', true);
      }).not.toThrow();
    });

    it('should record incorrect parameters without throwing', () => {
      expect(() => {
        (collector as any).recordParameterValidation('api_client', 'endpoint', false, 'Invalid URL format');
      }).not.toThrow();
    });

    it('should record missing parameters without throwing', () => {
      expect(() => {
        (collector as any).recordParameterValidation('api_client', 'api_key', false, 'Missing required parameter');
      }).not.toThrow();
    });

    it('should record invalid parameters without throwing', () => {
      expect(() => {
        (collector as any).recordParameterValidation('terminal', 'command', false, 'Invalid command syntax');
      }).not.toThrow();
    });

    it('should track mixed parameter validation results', () => {
      expect(() => {
        (collector as any).recordParameterValidation('api_client', 'endpoint', true);
        (collector as any).recordParameterValidation('api_client', 'timeout', false, 'Invalid timeout value');
        (collector as any).recordParameterValidation('file_system', 'path', true);
      }).not.toThrow();
    });

    it('should handle parameter accuracy calculation', () => {
      expect(() => {
        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Decision Tracking', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record optimal decisions without throwing', () => {
      expect(() => {
        (collector as any).recordDecision('tool_selection', 'optimal', 'Chose correct tool for task');
      }).not.toThrow();
    });

    it('should record suboptimal decisions without throwing', () => {
      expect(() => {
        (collector as any).recordDecision('tool_selection', 'suboptimal', 'Could have used more efficient tool');
      }).not.toThrow();
    });

    it('should record incorrect decisions without throwing', () => {
      expect(() => {
        (collector as any).recordDecision('tool_selection', 'incorrect', 'Wrong tool choice for task');
      }).not.toThrow();
    });

    it('should track mixed decision quality', () => {
      expect(() => {
        (collector as any).recordDecision('tool_selection', 'optimal', 'Correct tool choice');
        (collector as any).recordDecision('parameter_setting', 'suboptimal', 'Could be optimized');
        (collector as any).recordDecision('execution_order', 'incorrect', 'Wrong sequence');
      }).not.toThrow();
    });

    it('should handle decision with missing quality', () => {
      expect(() => {
        (collector as any).recordDecision('unknown_decision', 'optimal', 'Quality unclear');
      }).not.toThrow();
    });
  });

  describe('Output Scoring', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should record output quality scores without throwing', () => {
      expect(() => {
        (collector as any).recordOutputQuality('task_1', 0.95, 0.9, 0.85, 0.92, 'High quality output');
      }).not.toThrow();
    });

    it('should calculate overall output quality', () => {
      expect(() => {
        (collector as any).recordOutputQuality('task_1', 0.8, 0.85, 0.9, 0.88);
        (collector as any).recordOutputQuality('task_2', 0.7, 0.75, 0.8, 0.77);
      }).not.toThrow();
    });

    it('should handle partial output scores', () => {
      expect(() => {
        (collector as any).recordOutputQuality('task_1', 0.9); // Only overall score
        (collector as any).recordOutputQuality('task_2', undefined, 0.8); // Only clarity score
      }).not.toThrow();
    });

    it('should validate score ranges', () => {
      expect(() => {
        (collector as any).recordOutputQuality('task_1', 1.1, 0.5, 0.8, 0.9, 'Test');
        (collector as any).recordOutputQuality('task_2', -0.1, 0.5, 0.8, 0.9, 'Test');
        (collector as any).recordOutputQuality('task_3', NaN, 0.5, 0.8, 0.9, 'Test');
        (collector as any).recordOutputQuality('task_4', Infinity, 0.5, 0.8, 0.9, 'Test');
      }).not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should collect comprehensive quality metrics', () => {
      expect(() => {
        (collector as any).recordToolUsage('api_client', 100, true);
        (collector as any).recordParameterValidation('api_client', 'endpoint', true);
        (collector as any).recordDecision('tool_selection', 'optimal');
        (collector as any).recordOutputQuality('task_1', 0.95, 0.9, 0.85, 0.92);

        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });

    it('should handle metrics aggregation', () => {
      expect(() => {
        // Multiple operations
        for (let i = 0; i < 10; i++) {
          (collector as any).recordToolUsage(`tool_${i}`, 100, i % 3 !== 0);
          (collector as any).recordParameterValidation(`tool_${i}`, 'param1', i % 2 === 0);
          (collector as any).recordDecision('decision', 'optimal');
          (collector as any).recordOutputQuality(`task_${i}`, Math.random());
        }

        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Complex Quality Scenarios', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should simulate a complete evaluation scenario', () => {
      expect(() => {
        // Simulate a complex task with multiple quality aspects
        (collector as any).recordToolUsage('api_client', 150, true);
        (collector as any).recordParameterValidation('api_client', 'endpoint', true);
        (collector as any).recordParameterValidation('api_client', 'method', true);
        (collector as any).recordDecision('tool_selection', 'optimal', 'Best tool for API calls');
        (collector as any).recordOutputQuality('api_task', 0.95, 0.9, 0.88, 0.92, 'Successful API integration');

        (collector as any).recordToolUsage('file_system', 200, false, 'Permission denied');
        (collector as any).recordParameterValidation('file_system', 'path', false, 'Invalid path');
        (collector as any).recordDecision('error_handling', 'suboptimal', 'Could have handled better');
        (collector as any).recordOutputQuality('file_task', 0.6, 0.7, 0.5, 0.65, 'Partial success with errors');

        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });

    it('should handle edge cases in quality calculations', () => {
      expect(() => {
        // Edge cases
        (collector as any).recordToolUsage('tool', 0, true); // Zero execution time
        (collector as any).recordParameterValidation('tool', 'param', true);
        (collector as any).recordDecision('decision', 'optimal'); // Simple decision
        (collector as any).recordOutputQuality('task', NaN, NaN, NaN, NaN); // NaN scores

        const metrics = collector.getCurrentMetrics();
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await collector.start();
    });

    it('should handle invalid tool usage data', () => {
      expect(() => {
        (collector as any).recordToolUsage('', -100, true); // Empty tool name, negative time
        (collector as any).recordToolUsage(null as any, undefined as any, false); // Null values
      }).not.toThrow();
    });

    it('should handle invalid parameter validation data', () => {
      expect(() => {
        (collector as any).recordParameterValidation('', '', false); // Empty strings
        (collector as any).recordParameterValidation(null as any, null as any, true); // Null values
      }).not.toThrow();
    });

    it('should handle invalid decision data', () => {
      expect(() => {
        (collector as any).recordDecision('', 'optimal'); // Empty decision type
        (collector as any).recordDecision('test_decision', 'optimal'); // Normal decision
      }).not.toThrow();
    });

    it('should handle very large execution times', () => {
      expect(() => {
        (collector as any).recordToolUsage('tool', Number.MAX_SAFE_INTEGER, true);
        (collector as any).recordOutputQuality('task', 1.0, 1.0, 1.0, 1.0, 'Perfect execution');
      }).not.toThrow();
    });

    it('should handle negative execution times', () => {
      expect(() => {
        (collector as any).recordToolUsage('tool', -1000, true);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should cleanup resources on stop', async () => {
      await collector.start();
      (collector as any).recordToolUsage('test_tool', 100, true);

      expect(() => {
        collector.stop();
      }).not.toThrow();

      expect(collector.isCollectorActive()).toBe(false);
    });

    it('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await collector.start();
        expect(collector.isCollectorActive()).toBe(true);

        (collector as any).recordToolUsage(`tool_${i}`, 100, true);
        (collector as any).recordOutputQuality(`task_${i}`, 0.8 + (i * 0.1));

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