import { BaseExecutionAgent, BaseAgentConfig, TaskExecution, AgentMetrics } from './BaseExecutionAgent';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface GeneralReasoningConfig extends BaseAgentConfig {
  reasoningModel?: string;
  maxReasoningSteps?: number;
  temperature?: number;
  toolsEnabled?: string[];
  useChainOfThought?: boolean;
  useSelfConsistency?: number;
}

export interface ReasoningTask extends TaskExecution {
  domain: 'mathematics' | 'logic' | 'planning' | 'commonsense' | 'scientific' | 'creative';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  context: string;
  question: string;
  expectedAnswer?: any;
  tools?: string[];
  constraints?: string[];
}

export interface ReasoningStep {
  stepNumber: number;
  reasoning: string;
  action?: string;
  observation?: string;
  confidence: number;
  tokensUsed: number;
  executionTime: number;
}

export interface ToolExecution {
  toolName: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  executionTime: number;
  error?: string;
}

export interface ReasoningResult {
  finalAnswer: any;
  confidence: number;
  reasoningSteps: ReasoningStep[];
  toolExecutions: ToolExecution[];
  totalTokens: number;
  totalCost: number;
  executionTime: number;
  selfConsistencyScore?: number;
}

export class General_Reasoning_Agent extends BaseExecutionAgent {
  private reasoningModel: string;
  private maxReasoningSteps: number;
  private temperature: number;
  private toolsEnabled: string[];
  private useChainOfThought: boolean;
  private useSelfConsistency: number;
  private currentTask?: ReasoningTask;
  private reasoningSteps: ReasoningStep[] = [];
  private toolExecutions: ToolExecution[] = [];
  private availableTools: Map<string, Function> = new Map();

  constructor(config: GeneralReasoningConfig) {
    super(config);

    const cfg = config.configuration || {};
    this.reasoningModel = config.reasoningModel ?? cfg.reasoningModel ?? 'gpt-4';
    this.maxReasoningSteps = config.maxReasoningSteps ?? cfg.maxReasoningSteps ?? 10;
    this.temperature = config.temperature ?? cfg.temperature ?? 0.1;
    this.toolsEnabled = config.toolsEnabled ?? cfg.toolsEnabled ?? ['calculator', 'search', 'knowledge_base'];
    this.useChainOfThought = config.useChainOfThought ?? cfg.useChainOfThought ?? true;
    this.useSelfConsistency = config.useSelfConsistency ?? cfg.useSelfConsistency ?? 1;

    this.initializeTools();
  }

  public override getConfiguration(): Record<string, any> {
    return {
      ...this.configuration,
      reasoningModel: this.reasoningModel,
      maxReasoningSteps: this.maxReasoningSteps,
      temperature: this.temperature,
      toolsEnabled: this.toolsEnabled,
      useChainOfThought: this.useChainOfThought,
      useSelfConsistency: this.useSelfConsistency,
    };
  }

  private initializeTools(): void {
    // Initialize available reasoning tools
    this.availableTools.set('calculator', this.calculatorTool.bind(this));
    this.availableTools.set('search', this.searchTool.bind(this));
    this.availableTools.set('knowledge_base', this.knowledgeBaseTool.bind(this));
    this.availableTools.set('python_executor', this.pythonExecutorTool.bind(this));
    this.availableTools.set('data_analyzer', this.dataAnalyzerTool.bind(this));
  }

  protected async executeTasks(): Promise<void> {
    try {
      this.log('Starting General Reasoning execution');

      // Load reasoning tasks
      const tasks = await this.loadReasoningTasks();
      this.log(`Loaded ${tasks.length} reasoning tasks`);

      this.updateProgress(5, 'Reasoning environment setup complete');

      let completedTasks = 0;
      for (const task of tasks) {
        if (!this._running) break;

        this.currentTask = task;
        this.reasoningSteps = [];
        this.toolExecutions = [];

        this.log(`Processing reasoning task ${task.taskId}: ${task.domain} - ${task.difficulty}`);

        const result = await this.processReasoningTask(task);

        if (result.success) {
          completedTasks++;
          this.recordTaskCompletion(true, result.tokensUsed, result.cost);
          this.log(`Reasoning task ${task.taskId} completed successfully`);
        } else {
          this.recordTaskCompletion(false, result.tokensUsed, result.cost);
          this.log(`Reasoning task ${task.taskId} failed: ${result.error}`);

          if (result.errorRecovered) {
            this.recordErrorRecovery();
          }
        }

        const progress = 5 + (completedTasks / tasks.length) * 90;
        this.updateProgress(progress, `Completed ${completedTasks}/${tasks.length} reasoning tasks`);
      }

      this.updateProgress(100, `General Reasoning execution complete. ${completedTasks}/${tasks.length} tasks successful`);
      this.log(`General Reasoning execution completed: ${completedTasks}/${tasks.length} tasks successful`);

    } catch (error) {
      this.log(`General Reasoning execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async loadReasoningTasks(): Promise<ReasoningTask[]> {
    try {
      // For demo purposes, create sample reasoning tasks
      // In real implementation, this would load from GAIA/AgentBench datasets
      const tasks: ReasoningTask[] = [
        {
          taskId: 'reasoning-math-1',
          type: 'mathematical-reasoning',
          input: {
            problem: 'A train travels 300 miles in 4 hours. If it increases speed by 25%, how long will it take to travel 450 miles?',
            domain: 'mathematics'
          },
          expectedOutput: { answer: 5.76, unit: 'hours' },
          metadata: { difficulty: 'medium' },
          domain: 'mathematics',
          difficulty: 'medium',
          context: 'A train is traveling at a constant speed and then changes its speed.',
          question: 'A train travels 300 miles in 4 hours. If it increases speed by 25%, how long will it take to travel 450 miles?',
          expectedAnswer: { time: 5.76, unit: 'hours' },
          tools: ['calculator'],
          constraints: ['Assume constant acceleration', 'Ignore external factors']
        },
        {
          taskId: 'reasoning-logic-1',
          type: 'logical-reasoning',
          input: {
            problem: 'All A are B. Some B are C. Which of the following must be true?',
            domain: 'logic'
          },
          expectedOutput: { answer: 'Some A are C', certainty: 'cannot_be_determined' },
          metadata: { difficulty: 'hard' },
          domain: 'logic',
          difficulty: 'hard',
          context: 'Logical syllogism with quantifiers',
          question: 'Given the statements: "All A are B" and "Some B are C", what can we definitively conclude about the relationship between A and C?',
          expectedAnswer: { conclusion: 'Insufficient information to determine' },
          tools: [],
          constraints: ['Use only the given information', 'Avoid assumptions not supported by premises']
        },
        {
          taskId: 'reasoning-planning-1',
          type: 'planning-reasoning',
          input: {
            problem: 'Plan a route to visit 5 cities with minimal travel distance',
            domain: 'planning'
          },
          expectedOutput: { route: ['A', 'C', 'B', 'E', 'D'], distance: 1000 },
          metadata: { difficulty: 'expert' },
          domain: 'planning',
          difficulty: 'expert',
          context: 'Traveling salesman problem with 5 cities',
          question: 'Given 5 cities with known distances between them, find the optimal route that visits each city exactly once and returns to the starting city with minimal total distance.',
          expectedAnswer: { optimalRoute: [], minimalDistance: 0 },
          tools: ['calculator', 'data_analyzer'],
          constraints: ['Visit each city exactly once', 'Return to starting city']
        }
      ];

      return tasks;

    } catch (error) {
      this.log(`Failed to load reasoning tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async processReasoningTask(task: ReasoningTask): Promise<{
    success: boolean;
    tokensUsed: number;
    cost: number;
    error?: string;
    errorRecovered?: boolean;
  }> {
    const startTime = Date.now();
    let totalTokens = 0;
    let totalCost = 0;

    try {
      this.log(`Processing ${task.domain} reasoning task`);

      // Analyze task requirements
      const taskAnalysis = await this.analyzeTask(task);
      totalTokens += taskAnalysis.tokensUsed;
      totalCost += taskAnalysis.cost;

      // Generate reasoning plan
      const reasoningPlan = await this.generateReasoningPlan(task, taskAnalysis);
      totalTokens += reasoningPlan.tokensUsed;
      totalCost += reasoningPlan.cost;

      // Execute reasoning steps
      const reasoningResult = await this.executeReasoning(task, reasoningPlan);
      totalTokens += reasoningResult.tokensUsed;
      totalCost += reasoningResult.cost;

      // Validate answer
      const validationResult = await this.validateAnswer(task, reasoningResult.finalAnswer);
      totalTokens += validationResult.tokensUsed;
      totalCost += validationResult.cost;

      const executionTime = Date.now() - startTime;
      this.recordStepExecution(executionTime);

      if (validationResult.correct) {
        return {
          success: true,
          tokensUsed: totalTokens,
          cost: totalCost
        };
      } else {
        // Try self-consistency if enabled
        if (this.useSelfConsistency > 1) {
          const consistencyResult = await this.trySelfConsistency(task, reasoningPlan);
          totalTokens += consistencyResult.tokensUsed;
          totalCost += consistencyResult.cost;

          if (consistencyResult.consensus) {
            return {
              success: true,
              tokensUsed: totalTokens,
              cost: totalCost
            };
          }
        }

        return {
          success: false,
          tokensUsed: totalTokens,
          cost: totalCost,
          error: `Answer validation failed: ${validationResult.reason}`,
          errorRecovered: this.maxReasoningSteps > reasoningPlan.steps.length
        };
      }

    } catch (error) {
      return {
        success: false,
        tokensUsed: totalTokens,
        cost: totalCost,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorRecovered: true
      };
    }
  }

  private async analyzeTask(task: ReasoningTask): Promise<{
    analysis: string;
    requiredTools: string[];
    complexity: number;
    tokensUsed: number;
    cost: number;
  }> {
    const startTime = Date.now();

    // Simulate LLM call for task analysis
    await new Promise(resolve => setTimeout(resolve, 1000));

    const analysis = `
Task Analysis:
- Domain: ${task.domain}
- Difficulty: ${task.difficulty}
- Required Tools: ${task.tools?.join(', ') || 'None'}
- Constraints: ${task.constraints?.join(', ') || 'None'}
- Context: ${task.context}

This problem requires step-by-step reasoning and careful attention to the constraints.
`;

    const requiredTools = task.tools || [];
    const complexity = this.calculateComplexity(task);

    const executionTime = Date.now() - startTime;
    const tokensUsed = this.estimateTokens(analysis);
    const cost = this.estimateCost(tokensUsed);

    this.recordStepExecution(executionTime);

    return {
      analysis,
      requiredTools,
      complexity,
      tokensUsed,
      cost
    };
  }

  private calculateComplexity(task: ReasoningTask): number {
    let complexity = 1;

    // Increase complexity based on difficulty
    switch (task.difficulty) {
      case 'easy': complexity = 1; break;
      case 'medium': complexity = 2; break;
      case 'hard': complexity = 3; break;
      case 'expert': complexity = 4; break;
    }

    // Increase complexity based on domain
    switch (task.domain) {
      case 'mathematics': complexity *= 1.2; break;
      case 'logic': complexity *= 1.3; break;
      case 'planning': complexity *= 1.5; break;
      case 'scientific': complexity *= 1.4; break;
      case 'creative': complexity *= 1.6; break;
    }

    // Increase complexity based on number of tools
    if (task.tools && task.tools.length > 0) {
      complexity *= (1 + task.tools.length * 0.1);
    }

    return Math.round(complexity * 10) / 10;
  }

  private async generateReasoningPlan(task: ReasoningTask, analysis: any): Promise<{
    steps: string[];
    tools: string[];
    tokensUsed: number;
    cost: number;
  }> {
    const startTime = Date.now();

    // Simulate LLM call for reasoning plan generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const steps = this.generateReasoningSteps(task);
    const tools = analysis.requiredTools;

    const executionTime = Date.now() - startTime;
    const tokensUsed = this.estimateTokens(steps.join('\n'));
    const cost = this.estimateCost(tokensUsed);

    this.recordStepExecution(executionTime);

    return {
      steps,
      tools,
      tokensUsed,
      cost
    };
  }

  private generateReasoningSteps(task: ReasoningTask): string[] {
    // Generate domain-specific reasoning steps
    switch (task.domain) {
      case 'mathematics':
        return [
          'Understand the problem and identify given information',
          'Identify the mathematical concepts and formulas needed',
          'Set up the mathematical equations',
          'Solve the equations step by step',
          'Verify the answer makes sense in context'
        ];

      case 'logic':
        return [
          'Identify the premises and conclusions',
          'Represent the logical relationships',
          'Apply logical rules of inference',
          'Check for logical fallacies',
          'Reach a logically sound conclusion'
        ];

      case 'planning':
        return [
          'Define the goal and constraints',
          'Identify all possible actions/states',
          'Develop a planning strategy',
          'Execute the plan step by step',
          'Verify the plan achieves the goal'
        ];

      default:
        return [
          'Understand the problem context',
          'Break down the problem into smaller parts',
          'Analyze each part systematically',
          'Synthesize the results',
          'Verify the final answer'
        ];
    }
  }

  private async executeReasoning(task: ReasoningTask, plan: any): Promise<{
    finalAnswer: any;
    reasoningSteps: ReasoningStep[];
    toolExecutions: ToolExecution[];
    tokensUsed: number;
    cost: number;
  }> {
    let totalTokens = 0;
    let totalCost = 0;
    const reasoningSteps: ReasoningStep[] = [];
    const toolExecutions: ToolExecution[] = [];

    for (let i = 0; i < plan.steps.length && i < this.maxReasoningSteps; i++) {
      const stepStartTime = Date.now();

      this.log(`Executing reasoning step ${i + 1}: ${plan.steps[i]}`);

      // Generate reasoning for this step
      const stepReasoning = await this.generateStepReasoning(task, plan.steps[i], reasoningSteps);

      // Determine if tool execution is needed
      let toolExecution: ToolExecution | undefined;
      if (plan.tools.length > 0) {
        const toolToUse = plan.tools[i % plan.tools.length];
        if (this.availableTools.has(toolToUse)) {
          const toolFunction = this.availableTools.get(toolToUse)!;
          toolExecution = await this.executeTool(toolToUse, toolFunction, stepReasoning);
          toolExecutions.push(toolExecution);
        }
      }

      const executionTime = Date.now() - stepStartTime;
      const stepTokens = this.estimateTokens(stepReasoning);
      const stepCost = this.estimateCost(stepTokens);

      totalTokens += stepTokens;
      totalCost += stepCost;

      const reasoningStep: ReasoningStep = {
        stepNumber: i + 1,
        reasoning: stepReasoning,
        action: toolExecution?.toolName,
        observation: toolExecution?.result ? JSON.stringify(toolExecution.result) : undefined,
        confidence: this.calculateStepConfidence(stepReasoning, toolExecution),
        tokensUsed: stepTokens,
        executionTime
      };

      reasoningSteps.push(reasoningStep);
      this.recordStepExecution(executionTime);
    }

    // Generate final answer
    const finalAnswer = await this.generateFinalAnswer(task, reasoningSteps, toolExecutions);
    const finalTokens = this.estimateTokens(JSON.stringify(finalAnswer));
    const finalCost = this.estimateCost(finalTokens);

    totalTokens += finalTokens;
    totalCost += finalCost;

    return {
      finalAnswer,
      reasoningSteps,
      toolExecutions,
      tokensUsed: totalTokens,
      cost: totalCost
    };
  }

  private async generateStepReasoning(
    task: ReasoningTask,
    step: string,
    previousSteps: ReasoningStep[]
  ): Promise<string> {
    // Simulate LLM call for step reasoning
    await new Promise(resolve => setTimeout(resolve, 800));

    const context = previousSteps.map(s => s.reasoning).join('\n');
    const reasoning = `
Step: ${step}

Context from previous steps:
${context}

Current step reasoning:
${this.generateStepContent(task, step, previousSteps)}
`;

    return reasoning;
  }

  private generateStepContent(task: ReasoningTask, step: string, previousSteps: ReasoningStep[]): string {
    // Generate domain-specific step content
    if (task.domain === 'mathematics') {
      if (step.includes('Understand')) {
        return `Given: ${task.question}
We need to find the time taken when speed increases by 25%.`;
      } else if (step.includes('Solve')) {
        return `Original speed = 300 miles / 4 hours = 75 mph
New speed = 75 * 1.25 = 93.75 mph
Time for 450 miles = 450 / 93.75 = 4.8 hours`;
      }
    }

    return `Executing step: ${step}`;
  }

  private async executeTool(toolName: string, toolFunction: Function, context: string): Promise<ToolExecution> {
    const startTime = Date.now();

    try {
      this.log(`Executing tool: ${toolName}`);

      // Parse tool parameters from context
      const parameters = this.parseToolParameters(toolName, context);

      // Execute the tool
      const result = await toolFunction(parameters);

      const executionTime = Date.now() - startTime;

      return {
        toolName,
        parameters,
        result,
        success: true,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        toolName,
        parameters: {},
        result: null,
        success: false,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private parseToolParameters(toolName: string, context: string): Record<string, any> {
    // Simple parameter parsing - in real implementation, use NLP/LLM
    switch (toolName) {
      case 'calculator':
        return {
          expression: this.extractMathExpression(context)
        };
      case 'search':
        return {
          query: this.extractSearchQuery(context)
        };
      default:
        return {};
    }
  }

  private extractMathExpression(context: string): string {
    // Extract mathematical expressions from context
    const mathRegex = /[\d+\-*/().]+/g;
    const matches = context.match(mathRegex);
    return matches?.[0] || '75 * 1.25';
  }

  private extractSearchQuery(context: string): string {
    // Extract search queries from context
    const words = context.split(' ').slice(0, 5);
    return words.join(' ');
  }

  private calculateStepConfidence(reasoning: string, toolExecution?: ToolExecution): number {
    let confidence = 0.8; // Base confidence

    // Increase confidence if tool execution succeeded
    if (toolExecution && toolExecution.success) {
      confidence += 0.1;
    }

    // Adjust based on reasoning quality (simple heuristic)
    if (reasoning.length > 100) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  private async generateFinalAnswer(
    task: ReasoningTask,
    reasoningSteps: ReasoningStep[],
    toolExecutions: ToolExecution[]
  ): Promise<any> {
    // Simulate LLM call for final answer synthesis
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate domain-specific final answer
    if (task.domain === 'mathematics') {
      return {
        answer: 4.8,
        unit: 'hours',
        reasoning: 'The train increases speed by 25% from 75 mph to 93.75 mph. At this new speed, it takes 450/93.75 = 4.8 hours to travel 450 miles.',
        confidence: 0.95
      };
    } else if (task.domain === 'logic') {
      return {
        answer: 'Insufficient information to determine relationship between A and C',
        reasoning: 'From "All A are B" and "Some B are C", we cannot conclude anything definitive about the relationship between A and C.',
        confidence: 0.9
      };
    }

    return {
      answer: 'Final answer based on reasoning steps',
      confidence: 0.8
    };
  }

  private async validateAnswer(task: ReasoningTask, answer: any): Promise<{
    correct: boolean;
    reason: string;
    tokensUsed: number;
    cost: number;
  }> {
    // Simple validation logic
    let correct = false;
    let reason = '';

    if (task.expectedAnswer) {
      if (typeof task.expectedAnswer === 'object') {
        // Compare objects
        correct = this.compareAnswers(task.expectedAnswer, answer);
        reason = correct ? 'Answer matches expected result' : 'Answer does not match expected result';
      } else {
        // Compare simple values
        correct = answer === task.expectedAnswer;
        reason = correct ? 'Exact match' : 'No match';
      }
    } else {
      // If no expected answer, check if answer is reasonable
      correct = answer !== null && answer !== undefined;
      reason = correct ? 'Reasonable answer provided' : 'Invalid answer';
    }

    const tokensUsed = this.estimateTokens(JSON.stringify(answer));
    const cost = this.estimateCost(tokensUsed);

    return {
      correct,
      reason,
      tokensUsed,
      cost
    };
  }

  private compareAnswers(expected: any, actual: any): boolean {
    // Simple answer comparison - in real implementation, use more sophisticated comparison
    if (typeof expected === 'number' && typeof actual === 'object' && actual.answer !== undefined) {
      return Math.abs(expected - actual.answer) < 0.01; // Allow small numerical differences
    }

    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  private async trySelfConsistency(task: ReasoningTask, plan: any): Promise<{
    consensus: boolean;
    tokensUsed: number;
    cost: number;
  }> {
    let totalTokens = 0;
    let totalCost = 0;
    const answers: any[] = [];

    // Generate multiple reasoning paths
    for (let i = 0; i < this.useSelfConsistency; i++) {
      const reasoningResult = await this.executeReasoning(task, plan);
      answers.push(reasoningResult.finalAnswer);
      totalTokens += reasoningResult.tokensUsed;
      totalCost += reasoningResult.cost;
    }

    // Check for consensus
    const consensus = this.checkConsensus(answers);

    return {
      consensus,
      tokensUsed: totalTokens,
      cost: totalCost
    };
  }

  private checkConsensus(answers: any[]): boolean {
    if (answers.length < 2) return true;

    // Simple consensus check - do answers agree?
    const firstAnswer = answers[0];
    return answers.every(answer =>
      JSON.stringify(firstAnswer) === JSON.stringify(answer)
    );
  }

  // Tool implementations
  private async calculatorTool(parameters: Record<string, any>): Promise<any> {
    try {
      const expression = parameters.expression || '75 * 1.25';
      // Simple calculator evaluation - in real implementation, use proper math parser
      const result = eval(expression);
      return { expression, result };
    } catch (error) {
      throw new Error(`Calculator error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchTool(parameters: Record<string, any>): Promise<any> {
    try {
      const query = parameters.query || '';
      // Mock search results
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        query,
        results: [
          { title: 'Mock result 1', snippet: 'This is a mock search result' },
          { title: 'Mock result 2', snippet: 'Another mock search result' }
        ]
      };
    } catch (error) {
      throw new Error(`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async knowledgeBaseTool(parameters: Record<string, any>): Promise<any> {
    try {
      const query = parameters.query || '';
      // Mock knowledge base lookup
      await new Promise(resolve => setTimeout(resolve, 300));

      return {
        query,
        knowledge: 'Mock knowledge base entry for: ' + query,
        confidence: 0.8
      };
    } catch (error) {
      throw new Error(`Knowledge base error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async pythonExecutorTool(parameters: Record<string, any>): Promise<any> {
    try {
      const code = parameters.code || '';
      // Mock Python execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        code,
        output: 'Mock Python execution output',
        executionTime: 0.5
      };
    } catch (error) {
      throw new Error(`Python executor error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async dataAnalyzerTool(parameters: Record<string, any>): Promise<any> {
    try {
      const data = parameters.data || [];
      // Mock data analysis
      await new Promise(resolve => setTimeout(resolve, 800));

      return {
        dataPoints: data.length,
        analysis: 'Mock data analysis results',
        insights: ['Insight 1', 'Insight 2']
      };
    } catch (error) {
      throw new Error(`Data analyzer error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateCost(tokens: number): number {
    return tokens * 0.00001;
  }
}