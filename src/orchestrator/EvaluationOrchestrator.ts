/**
 * Evaluation Orchestrator with Metrics Integration
 * Coordinates evaluation execution with comprehensive metrics collection
 */

import { StateGraph, CompiledGraph } from '@langchain/langgraph';
import { logger } from '../utils/logger';
import { MetricsOrchestrator } from '../services/metrics/index';
import { MetricsCollectionContext } from '../types/metrics';
import { EvaluationModel } from '../database/models/Evaluation';
import { BenchmarkModel } from '../database/models/Benchmark';
import { AgentModel } from '../database/models/Agent';

interface EvaluationState {
  id: string;
  agentId: string;
  benchmarkId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  configuration: Record<string, any>;
  results?: any;
  errors?: string[];
  metrics?: any;
  logs: string[];
}

interface LangGraphNodes {
  setup: (state: EvaluationState) => Promise<EvaluationState>;
  execute: (state: EvaluationState) => Promise<EvaluationState>;
  collectMetrics: (state: EvaluationState) => Promise<EvaluationState>;
  analyzeResults: (state: EvaluationState) => Promise<EvaluationState>;
  cleanup: (state: EvaluationState) => Promise<EvaluationState>;
}

export class EvaluationOrchestrator {
  private metricsOrchestrator?: MetricsOrchestrator;
  private graph?: CompiledGraph<EvaluationState>;
  private isRunning: boolean = false;
  private currentEvaluation?: EvaluationState;

  constructor() {
    // Metrics orchestrator will be initialized per evaluation
  }

  /**
   * Initialize the orchestrator
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing EvaluationOrchestrator with metrics integration');

      this.graph = this.buildEvaluationGraph();

      logger.info('EvaluationOrchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EvaluationOrchestrator:', error);
      throw error;
    }
  }

  /**
   * Execute an evaluation with comprehensive metrics collection
   */
  public async executeEvaluation(
    agentId: string,
    benchmarkId: string,
    configuration: Record<string, any> = {}
  ): Promise<EvaluationState> {
    if (this.isRunning) {
      throw new Error('Another evaluation is already running');
    }

    try {
      this.isRunning = true;

      // Create evaluation state
      this.currentEvaluation = {
        id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId,
        benchmarkId,
        status: 'pending',
        configuration,
        logs: [],
      };

      logger.info(`Starting evaluation ${this.currentEvaluation.id}`, {
        agentId,
        benchmarkId,
      });

      // Create metrics collection context
      const metricsContext: MetricsCollectionContext = {
        evaluationId: this.currentEvaluation.id,
        agentId,
        benchmarkId,
        sessionId: this.currentEvaluation.id,
        startTime: new Date(),
        configuration,
        environment: {
          platform: process.platform,
          version: process.version,
          resources: {
            cpu: 'unknown', // Would be detected
            memory: 'unknown',
            storage: 'unknown',
          },
        },
      };

      // Initialize metrics collection for this evaluation
      this.metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await this.metricsOrchestrator.initialize();

      // Start metrics collection
      await this.metricsOrchestrator.start();

      // Update evaluation status
      this.currentEvaluation.status = 'running';
      this.currentEvaluation.startTime = new Date();

      // Save evaluation to database
      await EvaluationModel.create({
        agentId,
        benchmarkId,
        status: 'running',
        configuration,
        logs: [],
        metrics: undefined,
        startTime: this.currentEvaluation.startTime,
      });

      // Execute the evaluation graph
      const finalState = await this.graph!.invoke(this.currentEvaluation);

      // Stop metrics collection
      await this.metricsOrchestrator.stop();

      // Get final metrics
      const finalMetrics = await this.metricsOrchestrator.getCurrentMetrics();

      // Update evaluation with results and metrics
      finalState.endTime = new Date();
      finalState.metrics = finalMetrics;
      finalState.status = finalState.errors && finalState.errors.length > 0 ? 'failed' : 'completed';

      // Save final evaluation
      await EvaluationModel.updateStatusWithTime(
        finalState.id,
        finalState.status,
        finalState.startTime,
        finalState.endTime
      );

      if (finalMetrics) {
        await EvaluationModel.updateMetrics(finalState.id, finalMetrics);
      }

      logger.info(`Evaluation ${finalState.id} completed`, {
        status: finalState.status,
        duration: finalState.endTime.getTime() - finalState.startTime.getTime(),
      });

      return finalState;

    } catch (error) {
      logger.error('Evaluation execution failed:', error);

      if (this.currentEvaluation) {
        this.currentEvaluation.status = 'failed';
        this.currentEvaluation.endTime = new Date();
        this.currentEvaluation.errors = [error instanceof Error ? error.message : String(error)];

        // Update evaluation with error
        await EvaluationModel.updateStatusWithTime(
          this.currentEvaluation.id,
          'failed',
          this.currentEvaluation.startTime,
          this.currentEvaluation.endTime
        );
      }

      throw error;

    } finally {
      this.isRunning = false;
      this.currentEvaluation = undefined;

      // Cleanup metrics orchestrator
      try {
        if (this.metricsOrchestrator) {
          await this.metricsOrchestrator.cleanup();
        }
      } catch (cleanupError) {
        logger.error('Failed to cleanup metrics orchestrator:', cleanupError);
      }
    }
  }

  /**
   * Get current evaluation status
   */
  public getCurrentEvaluation(): EvaluationState | undefined {
    return this.currentEvaluation;
  }

  /**
   * Check if orchestrator is running
   */
  public isEvaluationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Validate that an evaluation task can run: both the agent and the benchmark
   * must exist. Throws a descriptive error otherwise. Returns the resolved
   * agent/benchmark pair on success.
   */
  public async validateTask(
    agentId: string,
    benchmarkId: string
  ): Promise<{ agent: any; benchmark: any }> {
    if (!agentId) {
      throw new Error('agentId is required');
    }
    if (!benchmarkId) {
      throw new Error('benchmarkId is required');
    }

    const [agent, benchmark] = await Promise.all([
      AgentModel.findById(agentId),
      BenchmarkModel.findById(benchmarkId),
    ]);

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    if (!benchmark) {
      throw new Error(`Benchmark not found: ${benchmarkId}`);
    }

    return { agent, benchmark };
  }

  /**
   * Gracefully shut down the orchestrator. Stops any in-flight evaluation and
   * releases the metrics collection resources. Safe to call multiple times.
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down EvaluationOrchestrator');

    try {
      if (this.metricsOrchestrator) {
        try {
          await this.metricsOrchestrator.stop();
        } catch (stopError) {
          logger.error('Error stopping metrics orchestrator during shutdown:', stopError);
        }
        await this.metricsOrchestrator.cleanup();
        this.metricsOrchestrator = undefined;
      }
    } catch (error) {
      logger.error('Error during EvaluationOrchestrator shutdown:', error);
    } finally {
      this.isRunning = false;
      this.currentEvaluation = undefined;
      logger.info('EvaluationOrchestrator shutdown complete');
    }
  }

  /**
   * Build the LangGraph evaluation workflow
   */
  private buildEvaluationGraph(): CompiledGraph<EvaluationState> {
    const nodes: LangGraphNodes = {
      setup: async (state: EvaluationState): Promise<EvaluationState> => {
        logger.debug(`Setting up evaluation ${state.id}`);

        // Validate and resolve agent and benchmark details
        const { agent, benchmark } = await this.validateTask(state.agentId, state.benchmarkId);

        // Record evaluation setup in metrics
        if (this.metricsOrchestrator) {
          this.metricsOrchestrator.recordTaskStart('evaluation_setup');
        }

        state.logs.push(`Setup completed for agent: ${agent.name}, benchmark: ${benchmark.name}`);

        return state;
      },

      execute: async (state: EvaluationState): Promise<EvaluationState> => {
        logger.debug(`Executing evaluation ${state.id}`);

        // Record task start
        if (this.metricsOrchestrator) {
          this.metricsOrchestrator.recordTaskStart('evaluation_execution');
        }

        try {
          // This would contain the actual evaluation logic
          // For demonstration, we'll simulate an evaluation

          // Simulate different steps
          await this.simulateEvaluationStep('load_benchmark_data', 1000);
          await this.simulateEvaluationStep('run_agent_tasks', 3000);
          await this.simulateEvaluationStep('validate_results', 500);

          // Record task completion
          if (this.metricsOrchestrator) {
            this.metricsOrchestrator.recordTaskCompletion('evaluation_execution', true, 0.92);
          }

          state.logs.push('Evaluation executed successfully');

          return state;

        } catch (error) {
          // Record task failure
          if (this.metricsOrchestrator) {
            this.metricsOrchestrator.recordTaskFailure('evaluation_execution', error instanceof Error ? error.message : String(error));
          }

          state.errors = state.errors || [];
          state.errors.push(error instanceof Error ? error.message : String(error));
          state.logs.push(`Evaluation failed: ${error}`);

          return state;
        }
      },

      collectMetrics: async (state: EvaluationState): Promise<EvaluationState> => {
        logger.debug(`Collecting metrics for evaluation ${state.id}`);

        // Get current metrics from orchestrator
        if (this.metricsOrchestrator) {
          const currentMetrics = await this.metricsOrchestrator.getCurrentMetrics();

          if (currentMetrics) {
            state.metrics = currentMetrics;
            state.logs.push('Metrics collected successfully');
          } else {
            state.logs.push('Warning: No metrics available');
          }
        }

        return state;
      },

      analyzeResults: async (state: EvaluationState): Promise<EvaluationState> => {
        logger.debug(`Analyzing results for evaluation ${state.id}`);

        // Record decision making
        if (this.metricsOrchestrator) {
          this.metricsOrchestrator.recordDecision(
            'result_analysis',
            ['accept', 'reject', 'review'],
            'accept',
            'accept',
            'Results meet success criteria',
            0.85
          );

          // Record output quality
          this.metricsOrchestrator.recordOutputQuality(
            state.id,
            0.9, // relevance
            0.85, // completeness
            0.88, // correctness
            0.92, // clarity
            'High quality results with minor improvements needed'
          );
        }

        state.logs.push('Results analyzed successfully');

        return state;
      },

      cleanup: async (state: EvaluationState): Promise<EvaluationState> => {
        logger.debug(`Cleaning up evaluation ${state.id}`);

        // Record final task completion
        if (this.metricsOrchestrator) {
          this.metricsOrchestrator.recordTaskCompletion('evaluation_cleanup', true);
        }

        state.logs.push('Cleanup completed successfully');

        return state;
      },
    };

    // Build the graph with edges
    const graph = new StateGraph<EvaluationState>({
      channels: {},
    });

    // Add nodes
    Object.entries(nodes).forEach(([name, node]) => {
      graph.addNode(name, node);
    });

    // Add edges (sequential execution)
    graph.addEdge('setup', 'execute');
    graph.addEdge('execute', 'collectMetrics');
    graph.addEdge('collectMetrics', 'analyzeResults');
    graph.addEdge('analyzeResults', 'cleanup');

    // Set entry point
    graph.setEntryPoint('setup');

    return graph.compile();
  }

  /**
   * Simulate an evaluation step with metrics recording
   */
  private async simulateEvaluationStep(stepName: string, duration: number): Promise<void> {
    // Record step start
    if (this.metricsOrchestrator) {
      this.metricsOrchestrator.recordStepStart(stepName);
    }

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, duration));

    // Record some example metrics during the step
    if (this.metricsOrchestrator && Math.random() > 0.8) {
      // Simulate a token usage event
      this.metricsOrchestrator.recordTokenUsage(
        'gpt-4',
        Math.floor(Math.random() * 1000) + 500,
        Math.floor(Math.random() * 500) + 200
      );
    }

    if (this.metricsOrchestrator && Math.random() > 0.9) {
      // Simulate an API call
      this.metricsOrchestrator.recordApiCall(
        'openai',
        '/chat/completions',
        Math.random() * 0.1 + 0.01,
        Math.floor(Math.random() * 100) + 50,
        Math.random() * 1000 + 200
      );
    }

    if (this.metricsOrchestrator && Math.random() > 0.95) {
      // Simulate an error
      this.metricsOrchestrator.recordError(
        'transient',
        'api_failure',
        'Temporary API failure',
        { step: stepName }
      );
    }

    // Record step completion
    if (this.metricsOrchestrator) {
      this.metricsOrchestrator.recordStepCompletion(stepName);
    }
  }

  /**
   * Get metrics summary for the current evaluation
   */
  public async getMetricsSummary(): Promise<any> {
    if (!this.metricsOrchestrator) {
      return null;
    }

    return this.metricsOrchestrator.getCollectorSummaries();
  }

  /**
   * Force metrics collection for current step
   */
  public async collectMetrics(): Promise<void> {
    if (this.metricsOrchestrator && this.currentEvaluation) {
      await this.metricsOrchestrator.collectMetrics();
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.metricsOrchestrator) {
        await this.metricsOrchestrator.cleanup();
      }
    } catch (error) {
      logger.error('Failed to cleanup EvaluationOrchestrator:', error);
    }
  }
}