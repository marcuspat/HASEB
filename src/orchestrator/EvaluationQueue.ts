import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { QueueItem } from '../types/orchestrator';
import { EvaluationModel } from '../database/models/Evaluation';
import { v4 as uuidv4 } from 'uuid';

export class EvaluationQueue extends EventEmitter {
  private queue: QueueItem[];
  private running: Map<string, QueueItem>;
  private completed: Set<string>;
  private failed: Set<string>;
  private maxConcurrent: number;
  private processing: boolean;

  constructor(maxConcurrent: number = 5) {
    super();
    this.queue = [];
    this.running = new Map();
    this.completed = new Set();
    this.failed = new Set();
    this.maxConcurrent = maxConcurrent;
    this.processing = false;

    this.startQueueProcessing();
  }

  async enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<QueueItem> {
    const queueItem: QueueItem = {
      ...item,
      id: uuidv4(),
      createdAt: new Date(),
      retryCount: 0
    };

    // Insert based on priority
    this.insertByPriority(queueItem);

    // Update database
    await EvaluationModel.create({
      agentId: queueItem.agentId,
      benchmarkId: queueItem.benchmarkId,
      status: 'pending',
      configuration: queueItem.configuration,
      logs: [{
        id: uuidv4(),
        timestamp: new Date(),
        level: 'info',
        message: `Evaluation queued with priority ${queueItem.priority}`,
        source: 'queue'
      }],
      metrics: {},
      startTime: new Date(),
      endTime: undefined
    });

    logger.info(`Evaluation ${queueItem.id} queued with priority ${queueItem.priority}`);
    this.emit('queued', queueItem);

    // Try to process if not already running
    this.processNext();

    return queueItem;
  }

  private insertByPriority(item: QueueItem): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const itemPriority = priorityOrder[item.priority];

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority];
      if (itemPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, item);
  }

  private async startQueueProcessing(): Promise<void> {
    this.processing = true;
    logger.info('Evaluation queue processing started');

    // Process any items that might be in the database
    await this.loadPendingEvaluations();

    // Start the processing loop
    this.processLoop();
  }

  private async loadPendingEvaluations(): Promise<void> {
    try {
      const { evaluations } = await EvaluationModel.findByStatus('pending', 1, 100);

      for (const evaluation of evaluations) {
        const queueItem: QueueItem = {
          id: evaluation.id,
          agentId: evaluation.agentId,
          benchmarkId: evaluation.benchmarkId,
          configuration: evaluation.configuration,
          priority: 'medium', // Default priority for loaded items
          createdAt: evaluation.createdAt as any,
          retryCount: 0,
          maxRetries: 3
        };

        this.queue.push(queueItem);
        logger.info(`Loaded pending evaluation ${evaluation.id} from database`);
      }

    } catch (error) {
      logger.error('Failed to load pending evaluations:', error);
    }
  }

  private async processLoop(): Promise<void> {
    while (this.processing) {
      await this.processNext();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
    }
  }

  private async processNext(): Promise<void> {
    // Check if we can process more items
    if (this.running.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get next item from queue
    const item = this.queue.shift();
    if (!item) {
      return;
    }

    // Start processing
    await this.startProcessing(item);
  }

  private async startProcessing(item: QueueItem): Promise<void> {
    try {
      // Add to running map
      this.running.set(item.id, item);

      // Update database status
      await EvaluationModel.updateStatus(item.id, 'running');

      logger.info(`Started processing evaluation ${item.id}`);
      this.emit('started', item);

      // Emit event for orchestrator to handle
      this.emit('process', item);

    } catch (error) {
      logger.error(`Failed to start processing evaluation ${item.id}:`, error);
      await this.handleProcessingError(item, error);
    }
  }

  async complete(evaluationId: string, success: boolean, error?: string): Promise<void> {
    const item = this.running.get(evaluationId);
    if (!item) {
      logger.warn(`Evaluation ${evaluationId} not found in running queue`);
      return;
    }

    // Remove from running
    this.running.delete(evaluationId);

    if (success) {
      this.completed.add(evaluationId);
      logger.info(`Evaluation ${evaluationId} completed successfully`);
      this.emit('completed', item);
    } else {
      this.failed.add(evaluationId);
      logger.error(`Evaluation ${evaluationId} failed: ${error}`);
      this.emit('failed', { item, error });

      // Handle retry logic
      await this.handleRetry(item, error);
    }

    // Try to process next item
    setImmediate(() => this.processNext());
  }

  private async handleRetry(item: QueueItem, error?: string): Promise<void> {
    item.retryCount++;

    if (item.retryCount <= item.maxRetries) {
      logger.info(`Retrying evaluation ${item.id} (attempt ${item.retryCount}/${item.maxRetries})`);

      // Add back to queue with delay
      setTimeout(() => {
        this.insertByPriority(item);
        this.emit('retry', item);
      }, 5000 * item.retryCount); // Exponential backoff
    } else {
      logger.error(`Maximum retry attempts reached for evaluation ${item.id}`);
      await EvaluationModel.updateStatus(item.id, 'failed');
      this.emit('maxRetriesReached', item);
    }
  }

  private async handleProcessingError(item: QueueItem, error: any): Promise<void> {
    this.running.delete(item.id);
    await this.handleRetry(item, error.message);
  }

  async pause(evaluationId: string): Promise<boolean> {
    const item = this.running.get(evaluationId);
    if (!item) {
      return false;
    }

    // Remove from running and add back to front of queue
    this.running.delete(evaluationId);
    this.queue.unshift(item);

    logger.info(`Evaluation ${evaluationId} paused`);
    this.emit('paused', item);

    return true;
  }

  async cancel(evaluationId: string): Promise<boolean> {
    // Check running
    const runningItem = this.running.get(evaluationId);
    if (runningItem) {
      this.running.delete(evaluationId);
      logger.info(`Evaluation ${evaluationId} cancelled while running`);
      this.emit('cancelled', runningItem);
      return true;
    }

    // Check queue
    const queueIndex = this.queue.findIndex(item => item.id === evaluationId);
    if (queueIndex !== -1) {
      const item = this.queue.splice(queueIndex, 1)[0];
      logger.info(`Evaluation ${evaluationId} cancelled from queue`);
      this.emit('cancelled', item);
      return true;
    }

    return false;
  }

  async getQueuePosition(evaluationId: string): Promise<number> {
    return this.queue.findIndex(item => item.id === evaluationId) + 1;
  }

  async getStatus(): Promise<any> {
    return {
      queueLength: this.queue.length,
      running: this.running.size,
      completed: this.completed.size,
      failed: this.failed.size,
      maxConcurrent: this.maxConcurrent,
      processing: this.processing,
      queueItems: this.queue.map(item => ({
        id: item.id,
        agentId: item.agentId,
        benchmarkId: item.benchmarkId,
        priority: item.priority,
        createdAt: item.createdAt,
        retryCount: item.retryCount,
        position: this.queue.findIndex(i => i.id === item.id) + 1
      })),
      runningItems: Array.from(this.running.values()).map(item => ({
        id: item.id,
        agentId: item.agentId,
        benchmarkId: item.benchmarkId,
        priority: item.priority,
        createdAt: item.createdAt,
        retryCount: item.retryCount,
        startTime: new Date() // This should be tracked more accurately
      }))
    };
  }

  async getLength(): Promise<number> {
    return this.queue.length;
  }

  async updatePriority(evaluationId: string, newPriority: QueueItem['priority']): Promise<boolean> {
    // Check if item is in queue
    const queueIndex = this.queue.findIndex(item => item.id === evaluationId);
    if (queueIndex !== -1) {
      const item = this.queue.splice(queueIndex, 1)[0];
      item.priority = newPriority;
      this.insertByPriority(item);

      logger.info(`Updated priority for evaluation ${evaluationId} to ${newPriority}`);
      this.emit('priorityUpdated', { item, newPriority });
      return true;
    }

    return false;
  }

  async clear(): Promise<void> {
    // Cancel all running evaluations
    for (const [evaluationId] of this.running.entries()) {
      await this.cancel(evaluationId);
    }

    // Clear queue
    this.queue = [];
    this.completed.clear();
    this.failed.clear();

    logger.info('Evaluation queue cleared');
    this.emit('cleared');
  }

  async getMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const completedLastHour = Array.from(this.completed).filter(id => {
      // This would need actual timestamps to be accurate
      return true; // Placeholder
    }).length;

    const completedLastDay = Array.from(this.completed).filter(id => {
      // This would need actual timestamps to be accurate
      return true; // Placeholder
    }).length;

    return {
      totalProcessed: this.completed.size + this.failed.size,
      successRate: this.completed.size / (this.completed.size + this.failed.size) * 100,
      averageWaitTime: this.calculateAverageWaitTime(),
      completedLastHour,
      completedLastDay,
      currentLoad: this.running.size / this.maxConcurrent * 100
    };
  }

  private calculateAverageWaitTime(): number {
    if (this.queue.length === 0) return 0;

    // Simple estimation based on queue position and average processing time
    const averageProcessingTime = 30 * 60 * 1000; // 30 minutes
    return this.queue.reduce((total, item, index) => {
      return total + (index * averageProcessingTime);
    }, 0) / this.queue.length;
  }

  setMaxConcurrent(maxConcurrent: number): void {
    this.maxConcurrent = maxConcurrent;
    logger.info(`Max concurrent evaluations set to ${maxConcurrent}`);
    this.emit('maxConcurrentUpdated', maxConcurrent);

    // Try to process more items if limit increased
    this.processNext();
  }

  stop(): void {
    this.processing = false;
    logger.info('Evaluation queue processing stopped');
    this.emit('stopped');
  }

  // Health check
  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      processing: this.processing,
      queueLength: this.queue.length,
      runningEvaluations: this.running.size,
      maxConcurrent: this.maxConcurrent,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}