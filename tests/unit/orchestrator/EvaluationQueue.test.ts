import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { EvaluationQueue as EvaluationQueueType } from '@/orchestrator/EvaluationQueue';
import type { QueueItem } from '@/types/orchestrator';

// Under this repo's native-ESM Jest setup, `jest.mock(path, factory)` does NOT
// intercept static `import`s of the module under test. The ESM-correct API is
// `jest.unstable_mockModule` combined with a dynamic `import()` performed AFTER
// the mocks are registered. This both applies the mock and preserves the full
// jest mock helper surface (.mock, mockResolvedValue, etc.).

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// The constructor (via loadPendingEvaluations) calls findByStatus, and enqueue
// calls create / updateStatus. Mock all of these so no real DB is touched.
const mockCreate = jest.fn();
const mockFindByStatus = jest.fn();
const mockUpdateStatus = jest.fn();

jest.unstable_mockModule('@/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: mockCreate,
    findByStatus: mockFindByStatus,
    updateStatus: mockUpdateStatus,
    findById: jest.fn(),
    delete: jest.fn(),
  },
}));

const { EvaluationQueue } = await import('@/orchestrator/EvaluationQueue');

type NewItem = Omit<QueueItem, 'id' | 'createdAt' | 'retryCount'>;

const makeItem = (overrides: Partial<NewItem> = {}): NewItem => ({
  agentId: 'test-agent',
  benchmarkId: 'test-benchmark',
  configuration: {},
  priority: 'medium',
  maxRetries: 3,
  ...overrides,
});

describe('EvaluationQueue', () => {
  let queue: EvaluationQueueType;

  beforeEach(() => {
    // config has resetMocks/clearMocks, so (re)install implementations each test.
    mockCreate.mockImplementation(async (data: any) => ({
      id: 'db-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    mockFindByStatus.mockResolvedValue({ evaluations: [], total: 0 });
    mockUpdateStatus.mockResolvedValue(true);

    // REAL API: constructor takes a maxConcurrent NUMBER (default 5).
    queue = new EvaluationQueue(5);
  });

  afterEach(() => {
    // Stop the internal processing loop so it does not keep the test alive.
    queue.stop();
  });

  describe('Initialization', () => {
    it('should construct with a numeric maxConcurrent and expose the real API', () => {
      expect(queue).toBeDefined();
      expect(typeof queue.enqueue).toBe('function');
      expect(typeof queue.complete).toBe('function');
      expect(typeof queue.cancel).toBe('function');
      expect(typeof queue.getStatus).toBe('function');
      expect(typeof queue.stop).toBe('function');
    });

    it('should default maxConcurrent to 5 and report it via getStatus', async () => {
      const status = await queue.getStatus();
      expect(status.maxConcurrent).toBe(5);
      expect(status.processing).toBe(true);
    });

    it('should honor a custom maxConcurrent', async () => {
      const customQueue = new EvaluationQueue(10);
      const status = await customQueue.getStatus();
      expect(status.maxConcurrent).toBe(10);
      customQueue.stop();
    });

    it('should attempt to load pending evaluations from the database on construction', () => {
      // The constructor kicks off startProcessing -> loadPendingEvaluations.
      expect(mockFindByStatus).toHaveBeenCalledWith('pending', 1, 100);
    });
  });

  describe('enqueue', () => {
    it('should return a QueueItem with a generated id, createdAt and retryCount', async () => {
      const item = await queue.enqueue(makeItem());

      expect(item).toBeDefined();
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.retryCount).toBe(0);
      expect(item.agentId).toBe('test-agent');
      expect(item.benchmarkId).toBe('test-benchmark');
      expect(item.priority).toBe('medium');
    });

    it('should generate unique ids for each enqueued item', async () => {
      const a = await queue.enqueue(makeItem({ agentId: 'a' }));
      const b = await queue.enqueue(makeItem({ agentId: 'b' }));
      expect(a.id).not.toBe(b.id);
    });

    it('should persist the queued evaluation via EvaluationModel.create', async () => {
      await queue.enqueue(makeItem({ priority: 'high' }));

      expect(mockCreate).toHaveBeenCalled();
      const arg = mockCreate.mock.calls[0][0] as any;
      expect(arg.agentId).toBe('test-agent');
      expect(arg.benchmarkId).toBe('test-benchmark');
      expect(arg.status).toBe('pending');
    });

    it('should emit a "queued" event carrying the new item', async () => {
      const listener = jest.fn();
      queue.on('queued', listener);

      const item = await queue.enqueue(makeItem());

      expect(listener).toHaveBeenCalledTimes(1);
      const emitted = listener.mock.calls[0][0] as QueueItem;
      expect(emitted.id).toBe(item.id);
    });
  });

  describe('Priority ordering (observable behavior)', () => {
    it('should order higher-priority items ahead of lower-priority ones in the queue', async () => {
      // maxConcurrent 0 keeps everything queued (processNext early-returns),
      // so we can observe ordering through getQueuePosition without items
      // being dequeued for processing.
      const idleQueue = new EvaluationQueue(0);

      const low = await idleQueue.enqueue(makeItem({ priority: 'low' }));
      const critical = await idleQueue.enqueue(makeItem({ priority: 'critical' }));
      const medium = await idleQueue.enqueue(makeItem({ priority: 'medium' }));

      // critical (0) should come before medium (2) which comes before low (3).
      const criticalPos = await idleQueue.getQueuePosition(critical.id);
      const mediumPos = await idleQueue.getQueuePosition(medium.id);
      const lowPos = await idleQueue.getQueuePosition(low.id);

      expect(criticalPos).toBeLessThan(mediumPos);
      expect(mediumPos).toBeLessThan(lowPos);

      idleQueue.stop();
    });

    it('should report queue length growing as items are enqueued', async () => {
      const idleQueue = new EvaluationQueue(0);

      expect(await idleQueue.getLength()).toBe(0);
      await idleQueue.enqueue(makeItem());
      await idleQueue.enqueue(makeItem());
      expect(await idleQueue.getLength()).toBe(2);

      idleQueue.stop();
    });
  });

  describe('getStatus / metrics', () => {
    it('should report queued items via getStatus', async () => {
      const idleQueue = new EvaluationQueue(0);
      await idleQueue.enqueue(makeItem({ priority: 'high' }));

      const status = await idleQueue.getStatus();
      expect(status.queueLength).toBe(1);
      expect(status.running).toBe(0);
      expect(Array.isArray(status.queueItems)).toBe(true);
      expect(status.queueItems[0].priority).toBe('high');

      idleQueue.stop();
    });

    it('should expose a healthCheck snapshot', async () => {
      const health = await queue.healthCheck();
      expect(health.status).toBe('healthy');
      expect(typeof health.queueLength).toBe('number');
      expect(health.maxConcurrent).toBe(5);
    });
  });

  describe('cancel / clear', () => {
    it('should cancel a queued item and remove it from the queue', async () => {
      const idleQueue = new EvaluationQueue(0);
      const item = await idleQueue.enqueue(makeItem());

      const cancelled = await idleQueue.cancel(item.id);
      expect(cancelled).toBe(true);
      expect(await idleQueue.getLength()).toBe(0);

      idleQueue.stop();
    });

    it('should return false when cancelling an unknown evaluation', async () => {
      const result = await queue.cancel('does-not-exist');
      expect(result).toBe(false);
    });

    it('should clear all queued items', async () => {
      const idleQueue = new EvaluationQueue(0);
      await idleQueue.enqueue(makeItem());
      await idleQueue.enqueue(makeItem());

      await idleQueue.clear();
      expect(await idleQueue.getLength()).toBe(0);

      idleQueue.stop();
    });
  });

  describe('Error handling', () => {
    it('should propagate database errors from enqueue', async () => {
      mockCreate.mockRejectedValueOnce(new Error('db down'));

      await expect(queue.enqueue(makeItem())).rejects.toThrow('db down');
    });

    it('should not throw when completing an unknown evaluation', async () => {
      await expect(queue.complete('unknown-id', true)).resolves.toBeUndefined();
    });
  });

  describe('Lifecycle', () => {
    it('should mark processing as false after stop()', async () => {
      queue.stop();
      const status = await queue.getStatus();
      expect(status.processing).toBe(false);
    });

    it('should emit a "stopped" event on stop()', () => {
      const listener = jest.fn();
      queue.on('stopped', listener);
      queue.stop();
      expect(listener).toHaveBeenCalled();
    });
  });
});
