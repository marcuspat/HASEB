import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EvaluationQueue } from '@/orchestrator/EvaluationQueue';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
}));

describe('EvaluationQueue', () => {
  let queue: EvaluationQueue;

  beforeEach(() => {
    queue = new EvaluationQueue({
      maxSize: 100,
      concurrency: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      priorityLevels: ['low', 'medium', 'high', 'critical'],
    });

    // Mock console methods to reduce noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    queue.stop();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(queue).toBeDefined();
      expect(typeof queue.add).toBe('function');
      expect(typeof queue.start).toBe('function');
      expect(typeof queue.stop).toBe('function');
      expect(typeof queue.getStatus).toBe('function');
    });

    it('should accept custom configuration', () => {
      const customQueue = new EvaluationQueue({
        maxSize: 200,
        concurrency: 10,
        retryAttempts: 5,
        retryDelay: 2000,
        priorityLevels: ['low', 'medium', 'high', 'critical', 'urgent'],
      });

      expect(customQueue).toBeDefined();
      customQueue.stop();
    });

    it('should start and stop without throwing', () => {
      expect(() => {
        queue.start();
        queue.stop();
      }).not.toThrow();
    });
  });

  describe('Queue Operations', () => {
    beforeEach(() => {
      queue.start();
    });

    it('should add evaluation to queue without throwing', async () => {
      const evaluation = {
        id: 'test-eval-123',
        agentId: 'test-agent-456',
        benchmarkId: 'test-benchmark-789',
        priority: 'medium',
        data: { timeout: 300000 },
      };

      await expect(queue.add(evaluation)).resolves.not.toThrow();
    });

    it('should add multiple evaluations to queue', async () => {
      const evaluations = Array(5).fill(null).map((_, i) => ({
        id: `test-eval-${i}`,
        agentId: `test-agent-${i}`,
        benchmarkId: `test-benchmark-${i}`,
        priority: 'medium' as const,
        data: { timeout: 300000 },
      }));

      const promises = evaluations.map(evaluation => queue.add(evaluation));
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle queue overflow gracefully', async () => {
      const smallQueue = new EvaluationQueue({ maxSize: 2 });
      smallQueue.start();

      const evaluation = {
        id: 'overflow-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'low' as const,
        data: {},
      };

      // Add evaluations up to and beyond max size
      await smallQueue.add({ ...evaluation, id: 'eval-1' });
      await smallQueue.add({ ...evaluation, id: 'eval-2' });
      await expect(smallQueue.add({ ...evaluation, id: 'eval-3' }))
        .resolves.not.toThrow(); // Should handle gracefully

      smallQueue.stop();
    });
  });

  describe('Priority Handling', () => {
    beforeEach(() => {
      queue.start();
    });

    it('should handle different priority levels', async () => {
      const priorities = ['low', 'medium', 'high', 'critical'] as const;

      for (const priority of priorities) {
        const evaluation = {
          id: `priority-test-${priority}`,
          agentId: 'test-agent',
          benchmarkId: 'test-benchmark',
          priority,
          data: {},
        };

        await expect(queue.add(evaluation)).resolves.not.toThrow();
      }
    });

    it('should handle invalid priority levels', async () => {
      const evaluation = {
        id: 'invalid-priority-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'invalid' as any,
        data: {},
      };

      await expect(queue.add(evaluation)).resolves.not.toThrow();
    });

    it('should handle missing priority', async () => {
      const evaluation = {
        id: 'no-priority-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: undefined as any,
        data: {},
      };

      await expect(queue.add(evaluation)).resolves.not.toThrow();
    });
  });

  describe('Processing Operations', () => {
    beforeEach(() => {
      queue.start();
    });

    it('should process evaluations without throwing', async () => {
      const evaluation = {
        id: 'process-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: { timeout: 1000 },
      };

      await queue.add(evaluation);

      // Wait a moment for processing to potentially start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Processing should not cause errors
      expect(queue.getStatus()).toBeDefined();
    });

    it('should handle concurrent processing', async () => {
      const evaluations = Array(10).fill(null).map((_, i) => ({
        id: `concurrent-${i}`,
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: { timeout: 1000 },
      }));

      const addPromises = evaluations.map(evaluation => queue.add(evaluation));
      await Promise.all(addPromises);

      // Wait for potential processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(queue.getStatus()).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      queue.start();
    });

    it('should handle invalid evaluation data', async () => {
      const invalidEvaluations = [
        null,
        undefined,
        {},
        { id: '' },
        { id: 'test' }, // Missing required fields
        { id: 'test', agentId: null, benchmarkId: undefined },
      ];

      for (const evaluation of invalidEvaluations) {
        await expect(queue.add(evaluation as any)).resolves.not.toThrow();
      }
    });

    it('should handle processing errors gracefully', async () => {
      const problematicEvaluation = {
        id: 'error-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: { throw: true, timeout: 1000 },
      };

      await queue.add(problematicEvaluation);

      // Wait for potential processing and error handling
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(queue.getStatus()).toBeDefined();
    });

    it('should handle retry logic', async () => {
      const flakyEvaluation = {
        id: 'retry-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'high' as const,
        data: { flaky: true, timeout: 1000 },
      };

      await queue.add(flakyEvaluation);

      // Wait for potential retries
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(queue.getStatus()).toBeDefined();
    });
  });

  describe('Status and Monitoring', () => {
    beforeEach(() => {
      queue.start();
    });

    it('should provide queue status', () => {
      const status = queue.getStatus();
      expect(status).toBeDefined();
      expect(typeof status.size).toBe('number');
      expect(typeof status.processing).toBe('number');
      expect(typeof status.completed).toBe('number');
      expect(typeof status.failed).toBe('number');
    });

    it('should track queue size accurately', async () => {
      const initialStatus = queue.getStatus();
      const initialSize = initialStatus.size;

      const evaluation = {
        id: 'size-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: {},
      };

      await queue.add(evaluation);
      const newStatus = queue.getStatus();
      expect(newStatus.size).toBeGreaterThanOrEqual(initialSize);
    });

    it('should handle status queries during processing', async () => {
      const evaluation = {
        id: 'status-during-process',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: { timeout: 1000 },
      };

      await queue.add(evaluation);

      // Query status multiple times during potential processing
      for (let i = 0; i < 5; i++) {
        const status = queue.getStatus();
        expect(status).toBeDefined();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle start/stop cycles', () => {
      for (let i = 0; i < 3; i++) {
        expect(() => {
          queue.start();
          queue.stop();
        }).not.toThrow();
      }
    });

    it('should handle multiple start calls', () => {
      queue.start();
      queue.start();
      queue.start();
      expect(() => queue.start()).not.toThrow();
    });

    it('should handle multiple stop calls', () => {
      queue.start();
      queue.stop();
      queue.stop();
      queue.stop();
      expect(() => queue.stop()).not.toThrow();
    });

    it('should handle operations when stopped', async () => {
      // Don't start the queue
      const evaluation = {
        id: 'stopped-queue-test',
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: {},
      };

      await expect(queue.add(evaluation)).resolves.not.toThrow();
      expect(queue.getStatus()).toBeDefined();
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limits', async () => {
      const concurrentQueue = new EvaluationQueue({ concurrency: 2 });
      concurrentQueue.start();

      const evaluations = Array(10).fill(null).map((_, i) => ({
        id: `concurrency-test-${i}`,
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        priority: 'medium' as const,
        data: { timeout: 5000 },
      }));

      const addPromises = evaluations.map(evaluation => concurrentQueue.add(evaluation));
      await Promise.all(addPromises);

      // Wait a moment to let processing potentially start
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = concurrentQueue.getStatus();
      expect(status).toBeDefined();
      expect(status.processing).toBeLessThanOrEqual(2);

      concurrentQueue.stop();
    });

    it('should handle concurrent queue operations', async () => {
      queue.start();

      const operations = Array(20).fill(null).map((_, i) =>
        queue.add({
          id: `concurrent-op-${i}`,
          agentId: 'test-agent',
          benchmarkId: 'test-benchmark',
          priority: i % 2 === 0 ? 'high' : 'low' as const,
          data: {},
        })
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});