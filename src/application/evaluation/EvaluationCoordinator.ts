import { db } from '../../database/connection';
import { logger } from '../../utils/logger';
import { EvaluationQueue } from '../../orchestrator/EvaluationQueue';
import { EvaluationEventEmitter } from '../../infrastructure/events/EvaluationEventEmitter';
import { ScoringService } from '../scoring/ScoringService';
import { ExecutionJobModel } from '../../database/models/ExecutionJobModel';
import { BenchmarkTaskModel } from '../../database/models/BenchmarkTaskModel';
import { EvaluationModel } from '../../database/models/Evaluation';
import { BenchmarkHarness } from '../../domain/benchmark/BenchmarkHarness';
import { MockHarness } from '../../harnesses/MockHarness';
import { SWEBenchHarness } from '../../harnesses/SWEBenchHarness';

const TASK_TIMEOUT_MS = 300000;

/**
 * Drives an evaluation end to end: runs each execution job through the harness,
 * persists results, scores the run, updates the leaderboard, and emits live
 * Socket.io events (ADR-011). Subscribes to the EvaluationQueue's `process`
 * event so queued work is picked up.
 */
export class EvaluationCoordinator {
  private readonly scoring = new ScoringService();

  constructor(
    private readonly queue: EvaluationQueue,
    private readonly events: EvaluationEventEmitter
  ) {
    // Honor the queue seam: anything pushed onto the queue is processed here.
    this.queue.on('process', (item: any) => {
      const evaluationId = item?.configuration?.evaluationId ?? item?.id;
      const agentId = item?.agentId;
      const benchmarkId = item?.benchmarkId;
      if (evaluationId && agentId && benchmarkId) {
        void this.run(evaluationId, agentId, benchmarkId, item?.id);
      }
    });
  }

  private createHarness(): BenchmarkHarness {
    return process.env.USE_MOCK_HARNESS === 'true' ? new MockHarness(0.7) : new SWEBenchHarness();
  }

  /**
   * Process every pending job for an evaluation, then score it.
   * @param queueItemId optional id to free the queue slot on completion.
   */
  async run(evaluationId: string, agentId: string, benchmarkId: string, queueItemId?: string): Promise<void> {
    const harness = this.createHarness();
    this.events.started(evaluationId);
    await EvaluationModel.updateStatus(evaluationId, 'running').catch(() => undefined);

    try {
      const jobs = await ExecutionJobModel.findByEvaluation(evaluationId);

      // No jobs (e.g. a legacy/empty evaluation): complete without scoring so we
      // don't create a 0/0 leaderboard entry.
      if (jobs.length === 0) {
        await EvaluationModel.updateStatus(evaluationId, 'completed').catch(() => undefined);
        this.events.evaluationCompleted(evaluationId, { resolveRate: 0, totalTasks: 0, resolvedTasks: 0 });
        if (queueItemId) {
          await this.queue.complete(queueItemId, true).catch(() => undefined);
        }
        return;
      }

      for (const job of jobs) {
        const task = await BenchmarkTaskModel.findById(job.benchmark_task_id);
        if (!task) {
          continue;
        }

        await ExecutionJobModel.markRunning(job.id);
        this.events.taskStarted(evaluationId, task.id);

        const result = await harness.executeTask(task, job.agent_patch ?? '', TASK_TIMEOUT_MS);
        const status = result.errorMessage?.includes('timed out')
          ? 'timeout'
          : result.passed
            ? 'completed'
            : 'failed';

        await ExecutionJobModel.saveResult(job.id, status, result);
        this.events.taskCompleted(evaluationId, task.id, result.passed, result.executionTimeMs);
      }

      // All jobs done -> score and update the leaderboard.
      const score = await this.scoring.computeAndSave(evaluationId, agentId, benchmarkId);
      await this.scoring.updateLeaderboard(score);

      await EvaluationModel.updateStatus(evaluationId, 'completed').catch(() => undefined);
      this.events.evaluationCompleted(evaluationId, {
        resolveRate: score.resolveRate,
        totalTasks: score.totalTasks,
        resolvedTasks: score.resolvedTasks,
      });

      if (queueItemId) {
        await this.queue.complete(queueItemId, true).catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Evaluation ${evaluationId} failed:`, error);
      await EvaluationModel.updateStatus(evaluationId, 'failed').catch(() => undefined);
      this.events.evaluationFailed(evaluationId, message);
      if (queueItemId) {
        await this.queue.complete(queueItemId, false, message).catch(() => undefined);
      }
    }
  }

  /** Mark queued and kick off processing (used by the submit endpoint). */
  async start(evaluationId: string, agentId: string, benchmarkId: string): Promise<void> {
    this.events.queued(evaluationId, agentId);
    // Fire-and-forget; clients watch progress over websockets.
    void this.run(evaluationId, agentId, benchmarkId);
  }
}
