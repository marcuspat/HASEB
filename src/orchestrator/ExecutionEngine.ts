import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import { TaskState, BenchmarkConfig, BenchmarkTask } from '../types/orchestrator';
import { AgentModel } from '../database/models/Agent';
import { BenchmarkModel } from '../database/models/Benchmark';
import { v4 as uuidv4 } from 'uuid';

interface ExecutionConfig {
  agentId: string;
  environment: any;
  configuration: Record<string, any>;
}

interface TaskExecution {
  taskId: string;
  evaluationId: string;
  process?: ChildProcess;
  startTime: Date;
  timeout?: NodeJS.Timeout;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export class ExecutionEngine extends EventEmitter {
  private activeExecutions: Map<string, TaskExecution>;
  private taskTimeouts: Map<string, NodeJS.Timeout>;
  private maxConcurrentTasks: number;
  private defaultTimeout: number;

  constructor(maxConcurrentTasks: number = 10, defaultTimeout: number = 300000) {
    super();
    this.activeExecutions = new Map();
    this.taskTimeouts = new Map();
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.defaultTimeout = defaultTimeout;
  }

  async loadTasks(benchmarkId: string, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    try {
      const benchmark = await BenchmarkModel.findById(benchmarkId);
      if (!benchmark) {
        throw new Error(`Benchmark ${benchmarkId} not found`);
      }

      // Load tasks based on benchmark type
      const tasks = await this.loadBenchmarkTasks(benchmark, configuration);

      logger.info(`Loaded ${tasks.length} tasks for benchmark ${benchmarkId}`);
      return tasks;

    } catch (error) {
      logger.error(`Failed to load tasks for benchmark ${benchmarkId}:`, error);
      throw error;
    }
  }

  private async loadBenchmarkTasks(benchmark: any, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    const benchmarkType = benchmark.type;
    const dataset = benchmark.dataset;

    switch (benchmarkType) {
      case 'swe-bench':
        return await this.loadSWEBenchTasks(dataset, configuration);
      case 'gaia':
        return await this.loadGAIATasks(dataset, configuration);
      case 'osworld':
        return await this.loadOSWorldTasks(dataset, configuration);
      case 'webarena':
        return await this.loadWebArenaTasks(dataset, configuration);
      case 'agentbench':
        return await this.loadAgentBenchTasks(dataset, configuration);
      default:
        return await this.loadCustomTasks(benchmark, configuration);
    }
  }

  private async loadSWEBenchTasks(dataset: string, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    // Placeholder implementation for SWE-bench tasks
    // In a real implementation, this would load from the actual SWE-bench dataset
    const taskCount = configuration.taskCount || 10;
    const tasks: BenchmarkTask[] = [];

    for (let i = 1; i <= taskCount; i++) {
      tasks.push({
        id: `swe-bench-${i}`,
        type: 'code-generation',
        description: `Fix bug in Python function ${i}`,
        input: {
          repository: `example-repo-${i}`,
          issue_description: `Issue ${i}: Function fails with edge case`,
          files: ['src/utils.py'],
          test_files: ['tests/test_utils.py']
        },
        expectedOutput: {
          fixed_files: ['src/utils.py'],
          test_results: { passed: true, tests_passed: 5, total_tests: 5 }
        },
        difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as any,
        category: 'bug-fix',
        tags: ['python', 'bug-fix', 'testing']
      });
    }

    return tasks;
  }

  private async loadGAIATasks(dataset: string, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    // Placeholder implementation for GAIA tasks
    const taskCount = configuration.taskCount || 10;
    const tasks: BenchmarkTask[] = [];

    for (let i = 1; i <= taskCount; i++) {
      tasks.push({
        id: `gaia-${i}`,
        type: 'reasoning',
        description: `Solve complex reasoning problem ${i}`,
        input: {
          problem: `Complex multi-step reasoning problem ${i}`,
          context: `Additional context for problem ${i}`,
          tools_available: ['calculator', 'search', 'analysis']
        },
        expectedOutput: {
          answer: `Expected answer ${i}`,
          reasoning_steps: ['Step 1', 'Step 2', 'Step 3'],
          confidence: 0.95
        },
        difficulty: ['medium', 'hard', 'expert'][Math.floor(Math.random() * 3)] as any,
        category: 'reasoning',
        tags: ['multi-step', 'analysis', 'problem-solving']
      });
    }

    return tasks;
  }

  private async loadOSWorldTasks(dataset: string, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    // Placeholder implementation for OSWorld tasks
    const taskCount = configuration.taskCount || 10;
    const tasks: BenchmarkTask[] = [];

    for (let i = 1; i <= taskCount; i++) {
      tasks.push({
        id: `osworld-${i}`,
        type: 'gui-automation',
        description: `Complete GUI task ${i}`,
        input: {
          task_description: `Open application and perform action ${i}`,
          application: ['notepad', 'calculator', 'browser'][Math.floor(Math.random() * 3)],
          steps: [`Step 1 for task ${i}`, `Step 2 for task ${i}`],
          expected_screenshots: [`screenshot_before_${i}.png`, `screenshot_after_${i}.png`]
        },
        expectedOutput: {
          success: true,
          actions_taken: ['Action 1', 'Action 2'],
          final_screenshot: `final_screenshot_${i}.png`,
          completion_time: 30
        },
        difficulty: ['easy', 'medium'][Math.floor(Math.random() * 2)] as any,
        category: 'gui-automation',
        tags: ['desktop', 'automation', 'ui']
      });
    }

    return tasks;
  }

  private async loadWebArenaTasks(dataset: string, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    // Placeholder implementation for WebArena tasks
    const taskCount = configuration.taskCount || 10;
    const tasks: BenchmarkTask[] = [];

    for (let i = 1; i <= taskCount; i++) {
      tasks.push({
        id: `webarena-${i}`,
        type: 'web-automation',
        description: `Complete web task ${i}`,
        input: {
          task_description: `Navigate to website and complete task ${i}`,
          starting_url: `https://example-${i}.com`,
          goal: `Specific goal for task ${i}`,
          constraints: [`Constraint ${i}`]
        },
        expectedOutput: {
          success: true,
          final_url: `https://example-${i}.com/success`,
          screenshot: `webarena_screenshot_${i}.png`,
          validation_results: { passed: true }
        },
        difficulty: ['medium', 'hard'][Math.floor(Math.random() * 2)] as any,
        category: 'web-automation',
        tags: ['browser', 'navigation', 'form-filling']
      });
    }

    return tasks;
  }

  private async loadAgentBenchTasks(dataset: string, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    // Placeholder implementation for AgentBench tasks
    const taskCount = configuration.taskCount || 10;
    const tasks: BenchmarkTask[] = [];

    for (let i = 1; i <= taskCount; i++) {
      tasks.push({
        id: `agentbench-${i}`,
        type: 'agent-evaluation',
        description: `Agent evaluation task ${i}`,
        input: {
          scenario: `Evaluation scenario ${i}`,
          capabilities_required: [`capability_${i}`],
          tools_provided: ['tool1', 'tool2'],
          evaluation_criteria: ['accuracy', 'efficiency', 'robustness']
        },
        expectedOutput: {
          task_completion: true,
          performance_score: 0.85,
          tool_usage_efficiency: 0.90,
          error_handling: true
        },
        difficulty: ['easy', 'medium', 'hard', 'expert'][Math.floor(Math.random() * 4)] as any,
        category: 'agent-evaluation',
        tags: ['agent', 'evaluation', 'performance']
      });
    }

    return tasks;
  }

  private async loadCustomTasks(benchmark: any, configuration: Record<string, any>): Promise<BenchmarkTask[]> {
    // Load custom tasks based on benchmark configuration
    const taskCount = configuration.taskCount || 5;
    const tasks: BenchmarkTask[] = [];

    for (let i = 1; i <= taskCount; i++) {
      const testTypes = ['code-generation', 'reasoning', 'gui-automation'];
      const taskType = configuration.testMode
        ? testTypes[(i - 1) % testTypes.length]
        : (benchmark.type || 'custom');
      tasks.push({
        id: `custom-${benchmark.id}-${i}`,
        type: taskType,
        description: `Custom evaluation task ${i}`,
        input: configuration.taskInput || {},
        expectedOutput: configuration.expectedOutput || {},
        difficulty: 'medium',
        category: 'custom',
        tags: ['custom', benchmark.type]
      });
    }

    return tasks;
  }

  async executeTask(evaluationId: string, task: BenchmarkTask, config: ExecutionConfig): Promise<TaskState> {
    const taskId = uuidv4();
    const startTime = new Date();

    try {
      // Check concurrent task limit
      if (this.activeExecutions.size >= this.maxConcurrentTasks) {
        throw new Error('Maximum concurrent tasks limit reached');
      }

      // Create task execution record
      const execution: TaskExecution = {
        taskId,
        evaluationId,
        startTime,
        status: 'running'
      };

      this.activeExecutions.set(taskId, execution);

      // Get agent details
      const agent = await AgentModel.findById(config.agentId);
      if (!agent) {
        throw new Error(`Agent ${config.agentId} not found`);
      }

      // Execute task based on type
      const result = await this.executeTaskByType(task, agent, config, taskId);

      // Clean up
      this.activeExecutions.delete(taskId);
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const taskState: TaskState = {
        id: task.id,
        type: task.type,
        description: task.description,
        input: task.input,
        expectedOutput: task.expectedOutput,
        actualOutput: result.output,
        status: result.success ? 'completed' : 'failed',
        startTime,
        endTime,
        duration,
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0,
        errors: result.errors || [],
        metrics: result.metrics || {}
      };

      logger.info(`Task ${task.id} completed in ${duration}ms`);
      this.emit('taskCompleted', evaluationId, taskState);

      return taskState;

    } catch (error) {
      // Clean up on error
      this.activeExecutions.delete(taskId);
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const taskState: TaskState = {
        id: task.id,
        type: task.type,
        description: task.description,
        input: task.input,
        expectedOutput: task.expectedOutput,
        actualOutput: null,
        status: 'failed',
        startTime,
        endTime,
        duration,
        tokensUsed: 0,
        cost: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        metrics: {}
      };

      logger.error(`Task ${task.id} failed:`, error);
      this.emit('taskFailed', evaluationId, taskState, error);

      return taskState;
    }
  }

  private async simulationDelay(minMs: number, maxMs: number, config: ExecutionConfig): Promise<void> {
    if (config.configuration?.testMode) return;
    await new Promise(resolve => setTimeout(resolve, Math.random() * (maxMs - minMs) + minMs));
  }

  private async executeTaskByType(
    task: BenchmarkTask,
    agent: any,
    config: ExecutionConfig,
    taskId: string
  ): Promise<any> {
    switch (task.type) {
      case 'code-generation':
        return await this.executeCodeGenerationTask(task, agent, config, taskId);
      case 'reasoning':
        return await this.executeReasoningTask(task, agent, config, taskId);
      case 'gui-automation':
        return await this.executeGUIAutomationTask(task, agent, config, taskId);
      case 'web-automation':
        return await this.executeWebAutomationTask(task, agent, config, taskId);
      case 'agent-evaluation':
        return await this.executeAgentEvaluationTask(task, agent, config, taskId);
      default:
        return await this.executeGenericTask(task, agent, config, taskId);
    }
  }

  private async executeCodeGenerationTask(task: BenchmarkTask, agent: any, config: ExecutionConfig, taskId: string): Promise<any> {
    // Simulate code generation task execution
    logger.info(`Executing code generation task ${task.id}`);

    // Set timeout
    const timeout = setTimeout(() => {
      this.cancelTask(taskId, 'Task timeout');
    }, this.defaultTimeout);

    this.taskTimeouts.set(taskId, timeout);

    try {
      // Simulate agent processing time
      await this.simulationDelay(5000, 15000, config);

      // Simulate code generation result
      const success = Math.random() > 0.2; // 80% success rate

      if (success) {
        return {
          success: true,
          output: {
            generated_code: `def solve_problem():\n    # Generated solution for ${task.description}\n    pass`,
            explanation: `Solution generated for ${task.description}`,
            test_results: { passed: true, tests_passed: 3, total_tests: 3 }
          },
          tokensUsed: Math.floor(Math.random() * 1000 + 500),
          cost: Math.random() * 0.01,
          metrics: {
            code_quality: Math.random() * 100,
            test_coverage: Math.random() * 100,
            complexity_score: Math.random() * 10
          }
        };
      } else {
        return {
          success: false,
          output: null,
          errors: ['Code generation failed: Unable to generate valid solution'],
          tokensUsed: Math.floor(Math.random() * 500),
          cost: Math.random() * 0.005
        };
      }
    } finally {
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }
  }

  private async executeReasoningTask(task: BenchmarkTask, agent: any, config: ExecutionConfig, taskId: string): Promise<any> {
    logger.info(`Executing reasoning task ${task.id}`);

    const timeout = setTimeout(() => {
      this.cancelTask(taskId, 'Task timeout');
    }, this.defaultTimeout);

    this.taskTimeouts.set(taskId, timeout);

    try {
      await this.simulationDelay(5000, 20000, config);

      const success = Math.random() > 0.15; // 85% success rate

      if (success) {
        return {
          success: true,
          output: {
            answer: `Solution to ${task.description}`,
            reasoning_steps: [
              'Step 1: Analyze the problem requirements',
              'Step 2: Identify key constraints and variables',
              'Step 3: Apply relevant reasoning framework',
              'Step 4: Verify solution against requirements'
            ],
            confidence: Math.random() * 0.3 + 0.7
          },
          tokensUsed: Math.floor(Math.random() * 1500 + 800),
          cost: Math.random() * 0.015,
          metrics: {
            reasoning_depth: Math.random() * 10,
            logical_coherence: Math.random() * 100,
            solution_accuracy: Math.random() * 100
          }
        };
      } else {
        return {
          success: false,
          output: null,
          errors: ['Reasoning task failed: Unable to reach valid conclusion'],
          tokensUsed: Math.floor(Math.random() * 800),
          cost: Math.random() * 0.008
        };
      }
    } finally {
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }
  }

  private async executeGUIAutomationTask(task: BenchmarkTask, agent: any, config: ExecutionConfig, taskId: string): Promise<any> {
    logger.info(`Executing GUI automation task ${task.id}`);

    const timeout = setTimeout(() => {
      this.cancelTask(taskId, 'Task timeout');
    }, this.defaultTimeout * 2); // GUI tasks take longer

    this.taskTimeouts.set(taskId, timeout);

    try {
      await this.simulationDelay(10000, 40000, config);

      const success = Math.random() > 0.25; // 75% success rate

      if (success) {
        return {
          success: true,
          output: {
            success: true,
            actions_taken: [
              'Launch application',
              'Navigate to required screen',
              'Perform specified actions',
              'Verify results'
            ],
            final_screenshot: `screenshot_${taskId}.png`,
            completion_time: Math.floor(Math.random() * 60 + 20)
          },
          tokensUsed: Math.floor(Math.random() * 800 + 400),
          cost: Math.random() * 0.012,
          metrics: {
            action_accuracy: Math.random() * 100,
            navigation_efficiency: Math.random() * 100,
            error_recovery: Math.random() * 100
          }
        };
      } else {
        return {
          success: false,
          output: null,
          errors: ['GUI automation failed: Unable to complete required actions'],
          tokensUsed: Math.floor(Math.random() * 600),
          cost: Math.random() * 0.008
        };
      }
    } finally {
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }
  }

  private async executeWebAutomationTask(task: BenchmarkTask, agent: any, config: ExecutionConfig, taskId: string): Promise<any> {
    logger.info(`Executing web automation task ${task.id}`);

    const timeout = setTimeout(() => {
      this.cancelTask(taskId, 'Task timeout');
    }, this.defaultTimeout * 2);

    this.taskTimeouts.set(taskId, timeout);

    try {
      await this.simulationDelay(10000, 35000, config);

      const success = Math.random() > 0.2; // 80% success rate

      if (success) {
        return {
          success: true,
          output: {
            success: true,
            final_url: task.input.starting_url + '/success',
            screenshot: `web_screenshot_${taskId}.png`,
            validation_results: {
              passed: true,
              elements_found: ['required_element_1', 'required_element_2'],
              form_submitted: true
            }
          },
          tokensUsed: Math.floor(Math.random() * 1000 + 500),
          cost: Math.random() * 0.015,
          metrics: {
            navigation_success: Math.random() * 100,
            element_interaction: Math.random() * 100,
            form_filling_accuracy: Math.random() * 100
          }
        };
      } else {
        return {
          success: false,
          output: null,
          errors: ['Web automation failed: Unable to complete web task'],
          tokensUsed: Math.floor(Math.random() * 700),
          cost: Math.random() * 0.01
        };
      }
    } finally {
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }
  }

  private async executeAgentEvaluationTask(task: BenchmarkTask, agent: any, config: ExecutionConfig, taskId: string): Promise<any> {
    logger.info(`Executing agent evaluation task ${task.id}`);

    const timeout = setTimeout(() => {
      this.cancelTask(taskId, 'Task timeout');
    }, this.defaultTimeout);

    this.taskTimeouts.set(taskId, timeout);

    try {
      await this.simulationDelay(10000, 30000, config);

      const success = Math.random() > 0.1; // 90% success rate

      if (success) {
        return {
          success: true,
          output: {
            task_completion: true,
            performance_score: Math.random() * 0.3 + 0.7,
            tool_usage_efficiency: Math.random() * 0.3 + 0.7,
            error_handling: Math.random() > 0.3,
            adaptation_score: Math.random() * 100,
            communication_clarity: Math.random() * 100
          },
          tokensUsed: Math.floor(Math.random() * 2000 + 1000),
          cost: Math.random() * 0.02,
          metrics: {
            planning_quality: Math.random() * 100,
            execution_accuracy: Math.random() * 100,
            learning_capability: Math.random() * 100,
            collaboration_score: Math.random() * 100
          }
        };
      } else {
        return {
          success: false,
          output: null,
          errors: ['Agent evaluation failed: Did not meet performance criteria'],
          tokensUsed: Math.floor(Math.random() * 1200),
          cost: Math.random() * 0.012
        };
      }
    } finally {
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }
  }

  private async executeGenericTask(task: BenchmarkTask, agent: any, config: ExecutionConfig, taskId: string): Promise<any> {
    logger.info(`Executing generic task ${task.id}`);

    const timeout = setTimeout(() => {
      this.cancelTask(taskId, 'Task timeout');
    }, this.defaultTimeout);

    this.taskTimeouts.set(taskId, timeout);

    try {
      await this.simulationDelay(5000, 20000, config);

      const success = Math.random() > 0.2;

      if (success) {
        return {
          success: true,
          output: {
            result: `Completed ${task.description}`,
            details: `Task-specific details for ${task.id}`,
            metadata: { task_type: task.type, difficulty: task.difficulty }
          },
          tokensUsed: Math.floor(Math.random() * 1000 + 500),
          cost: Math.random() * 0.01,
          metrics: {
            completion_quality: Math.random() * 100,
            efficiency: Math.random() * 100
          }
        };
      } else {
        return {
          success: false,
          output: null,
          errors: ['Generic task failed: Unable to complete task'],
          tokensUsed: Math.floor(Math.random() * 500),
          cost: Math.random() * 0.005
        };
      }
    } finally {
      const timeout = this.taskTimeouts.get(taskId);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(taskId);
      }
    }
  }

  cancelTask(taskId: string, reason?: string): boolean {
    const execution = this.activeExecutions.get(taskId);
    if (!execution) {
      return false;
    }

    // Kill the process if it exists
    if (execution.process) {
      execution.process.kill('SIGTERM');
    }

    // Clear timeout
    const timeout = this.taskTimeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.taskTimeouts.delete(taskId);
    }

    // Update status
    execution.status = 'cancelled';
    this.activeExecutions.delete(taskId);

    logger.info(`Task ${taskId} cancelled: ${reason || 'No reason provided'}`);
    this.emit('taskCancelled', execution.evaluationId, taskId, reason);

    return true;
  }

  getActiveExecutions(): number {
    return this.activeExecutions.size;
  }

  getExecutionStats(): any {
    return {
      activeExecutions: this.activeExecutions.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      averageExecutionTime: 15000, // Placeholder
      successRate: 0.85, // Placeholder
      activeTimeouts: this.taskTimeouts.size
    };
  }

  cancelAllTasks(reason?: string): number {
    let cancelledCount = 0;
    for (const taskId of this.activeExecutions.keys()) {
      if (this.cancelTask(taskId, reason)) {
        cancelledCount++;
      }
    }
    return cancelledCount;
  }

  updateConfig(maxConcurrentTasks?: number, defaultTimeout?: number): void {
    if (maxConcurrentTasks !== undefined) {
      this.maxConcurrentTasks = maxConcurrentTasks;
    }
    if (defaultTimeout !== undefined) {
      this.defaultTimeout = defaultTimeout;
    }

    logger.info(`ExecutionEngine config updated: maxConcurrent=${this.maxConcurrentTasks}, timeout=${this.defaultTimeout}ms`);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down ExecutionEngine...');

    // Cancel all active tasks
    const cancelledCount = this.cancelAllTasks('Engine shutdown');
    logger.info(`Cancelled ${cancelledCount} active tasks during shutdown`);

    // Clear all timeouts
    for (const timeout of this.taskTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.taskTimeouts.clear();

    logger.info('ExecutionEngine shutdown complete');
  }
}