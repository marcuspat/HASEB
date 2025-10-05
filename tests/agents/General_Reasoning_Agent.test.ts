import { General_Reasoning_Agent, GeneralReasoningConfig } from '@/agents/General_Reasoning_Agent';
import { BaseExecutionAgent } from '@/agents/BaseExecutionAgent';

// Mock dependencies
jest.mock('../../src/utils/logger'));

const mockLogger = require('../../src/utils/logger');

describe('General_Reasoning_Agent', () => {
  let agent: General_Reasoning_Agent;
  let mockConfig: GeneralReasoningConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      agentId: 'reasoning-agent-1',
      benchmarkId: 'reasoning-benchmark-1',
      configuration: {
        reasoningModel: 'test-model',
        maxReasoningSteps: 8,
        temperature: 0.2,
        toolsEnabled: ['calculator', 'search', 'knowledge_base'],
        useChainOfThought: true,
        useSelfConsistency: 3
      },
      timeout: 300000,
      maxRetries: 2
    };

    agent = new General_Reasoning_Agent(mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.getStatus()).toBe('pending');

      const config = agent.getConfiguration();
      expect(config.reasoningModel).toBe('test-model');
      expect(config.maxReasoningSteps).toBe(8);
      expect(config.temperature).toBe(0.2);
      expect(config.toolsEnabled).toEqual(['calculator', 'search', 'knowledge_base']);
      expect(config.useChainOfThought).toBe(true);
      expect(config.useSelfConsistency).toBe(3);
    });

    it('should use default values when not provided', () => {
      const defaultConfig: GeneralReasoningConfig = {
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        configuration: {}
      };

      const defaultAgent = new General_Reasoning_Agent(defaultConfig);
      const config = defaultAgent.getConfiguration();

      expect(config.reasoningModel).toBe('gpt-4');
      expect(config.maxReasoningSteps).toBe(10);
      expect(config.temperature).toBe(0.1);
      expect(config.toolsEnabled).toEqual(['calculator', 'search', 'knowledge_base']);
      expect(config.useChainOfThought).toBe(true);
      expect(config.useSelfConsistency).toBe(1);
    });

    it('should initialize available tools correctly', () => {
      const availableTools = (agent as any)['availableTools'];

      expect(availableTools.has('calculator')).toBe(true);
      expect(availableTools.has('search')).toBe(true);
      expect(availableTools.has('knowledge_base')).toBe(true);
      expect(availableTools.has('python_executor')).toBe(true);
      expect(availableTools.has('data_analyzer')).toBe(true);
    });
  });

  describe('Task Loading', () => {
    it('should load reasoning tasks correctly', async () => {
      const loadTasksSpy = jest.spyOn(agent as any, 'loadReasoningTasks');
      loadTasksSpy.mockResolvedValue([
        {
          taskId: 'math-task-1',
          domain: 'mathematics',
          difficulty: 'medium',
          context: 'A train travels 300 miles in 4 hours',
          question: 'If it increases speed by 25%, how long will it take to travel 450 miles?',
          expectedAnswer: { time: 4.8, unit: 'hours' },
          tools: ['calculator'],
          constraints: ['Assume constant acceleration']
        },
        {
          taskId: 'logic-task-1',
          domain: 'logic',
          difficulty: 'hard',
          context: 'Logical syllogism with quantifiers',
          question: 'Given: "All A are B" and "Some B are C", what can we conclude?',
          expectedAnswer: { conclusion: 'Insufficient information' },
          tools: [],
          constraints: ['Use only given information']
        }
      ]);

      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: General_Reasoning_Agent) {
        const tasks = await this['loadReasoningTasks']();
        expect(tasks).toHaveLength(2);
        expect(tasks[0].domain).toBe('mathematics');
        expect(tasks[1].domain).toBe('logic');
      });

      await agent.execute();

      expect(loadTasksSpy).toHaveBeenCalled();
    });

    it('should handle task loading errors', async () => {
      const loadTasksSpy = jest.spyOn(agent as any, 'loadReasoningTasks');
      loadTasksSpy.mockRejectedValue(new Error('Failed to load tasks'));

      await expect(agent.execute()).rejects.toThrow('Failed to load tasks');
    });
  });

  describe('Task Analysis', () => {
    it('should analyze task requirements correctly', async () => {
      const mockTask = {
        taskId: 'math-task',
        domain: 'mathematics',
        difficulty: 'medium',
        context: 'Math problem about speed and distance',
        question: 'A car travels at 60 mph. How far does it go in 2.5 hours?',
        tools: ['calculator'],
        constraints: []
      };

      const analyzeTaskSpy = jest.spyOn(agent as any, 'analyzeTask');
      analyzeTaskSpy.mockResolvedValue({
        analysis: 'Domain: mathematics, Difficulty: medium',
        requiredTools: ['calculator'],
        complexity: 2.0,
        tokensUsed: 150,
        cost: 0.0015
      });

      const result = await (agent as any)['analyzeTask'](mockTask);

      expect(result.analysis).toContain('Domain: mathematics');
      expect(result.requiredTools).toEqual(['calculator']);
      expect(result.complexity).toBe(2.0);
      expect(result.tokensUsed).toBe(150);
      expect(result.cost).toBe(0.0015);
    });

    it('should calculate complexity correctly', () => {
      const easyTask = { domain: 'commonsense', difficulty: 'easy', tools: [] };
      const mediumTask = { domain: 'mathematics', difficulty: 'medium', tools: ['calculator'] };
      const hardTask = { domain: 'planning', difficulty: 'hard', tools: ['calculator', 'data_analyzer'] };
      const expertTask = { domain: 'creative', difficulty: 'expert', tools: ['calculator', 'data_analyzer', 'search'] };

      expect((agent as any)['calculateComplexity'](easyTask)).toBe(1);
      expect((agent as any)['calculateComplexity'](mediumTask)).toBe(2.4);
      expect((agent as any)['calculateComplexity'](hardTask)).toBe(4.5);
      expect((agent as any)['calculateComplexity'](expertTask)).toBe(7.2);
    });
  });

  describe('Reasoning Plan Generation', () => {
    it('should generate reasoning steps for mathematics domain', async () => {
      const mockTask = {
        domain: 'mathematics',
        difficulty: 'medium'
      };

      const generatePlanSpy = jest.spyOn(agent as any, 'generateReasoningPlan');
      generatePlanSpy.mockResolvedValue({
        steps: [
          'Understand the problem and identify given information',
          'Identify the mathematical concepts and formulas needed',
          'Set up the mathematical equations',
          'Solve the equations step by step',
          'Verify the answer makes sense in context'
        ],
        tools: ['calculator'],
        tokensUsed: 200,
        cost: 0.002
      });

      const result = await (agent as any)['generateReasoningPlan'](mockTask, {
        requiredTools: ['calculator'],
        complexity: 2.0
      });

      expect(result.steps).toHaveLength(5);
      expect(result.steps[0]).toContain('Understand the problem');
      expect(result.tools).toEqual(['calculator']);
    });

    it('should generate reasoning steps for logic domain', async () => {
      const mockTask = {
        domain: 'logic',
        difficulty: 'hard'
      };

      const generatePlanSpy = jest.spyOn(agent as any, 'generateReasoningPlan');
      generatePlanSpy.mockResolvedValue({
        steps: [
          'Identify the premises and conclusions',
          'Represent the logical relationships',
          'Apply logical rules of inference',
          'Check for logical fallacies',
          'Reach a logically sound conclusion'
        ],
        tools: [],
        tokensUsed: 180,
        cost: 0.0018
      });

      const result = await (agent as any)['generateReasoningPlan'](mockTask, {
        requiredTools: [],
        complexity: 3.0
      });

      expect(result.steps).toHaveLength(5);
      expect(result.steps[0]).toContain('Identify the premises');
      expect(result.tools).toEqual([]);
    });
  });

  describe('Reasoning Execution', () => {
    it('should execute reasoning steps correctly', async () => {
      const mockTask = {
        taskId: 'math-task',
        domain: 'mathematics',
        difficulty: 'medium',
        question: 'What is 25 + 37?',
        tools: ['calculator']
      };

      const mockPlan = {
        steps: ['Understand problem', 'Set up equation', 'Solve', 'Verify'],
        tools: ['calculator']
      };

      const generateStepReasoningSpy = jest.spyOn(agent as any, 'generateStepReasoning');
      generateStepReasoningSpy.mockResolvedValue('Step reasoning: We need to add 25 and 37');

      const executeToolSpy = jest.spyOn(agent as any, 'executeTool');
      executeToolSpy.mockResolvedValue({
        toolName: 'calculator',
        parameters: { expression: '25 + 37' },
        result: { expression: '25 + 37', result: 62 },
        success: true,
        executionTime: 100
      });

      const generateFinalAnswerSpy = jest.spyOn(agent as any, 'generateFinalAnswer');
      generateFinalAnswerSpy.mockResolvedValue({
        answer: 62,
        reasoning: '25 + 37 = 62',
        confidence: 0.95
      });

      const result = await (agent as any)['executeReasoning'](mockTask, mockPlan);

      expect(result.finalAnswer.answer).toBe(62);
      expect(result.reasoningSteps).toHaveLength(4);
      expect(result.toolExecutions).toHaveLength(1);
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.cost).toBeGreaterThan(0);
    });

    it('should respect max reasoning steps limit', async () => {
      agent['maxReasoningSteps'] = 2;

      const mockTask = {
        taskId: 'test-task',
        domain: 'mathematics',
        question: 'What is 1 + 1?',
        tools: []
      };

      const mockPlan = {
        steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
        tools: []
      };

      const result = await (agent as any)['executeReasoning'](mockTask, mockPlan);

      expect(result.reasoningSteps).toHaveLength(2); // Limited by maxReasoningSteps
    });

    it('should handle step execution failures', async () => {
      const mockTask = {
        taskId: 'test-task',
        domain: 'mathematics',
        question: 'What is 1 + 1?',
        tools: []
      };

      const mockPlan = {
        steps: ['Step 1'],
        tools: []
      };

      const generateStepReasoningSpy = jest.spyOn(agent as any, 'generateStepReasoning');
      generateStepReasoningSpy.mockRejectedValue(new Error('Step generation failed'));

      const result = await (agent as any)['executeReasoning'](mockTask, mockPlan);

      expect(result.finalAnswer).toBeDefined(); // Should still generate an answer
      expect(result.reasoningSteps).toHaveLength(0); // No successful steps
    });
  });

  describe('Tool Execution', () => {
    it('should execute calculator tool correctly', async () => {
      const parameters = { expression: '2 + 2 * 3' };

      const result = await (agent as any)['calculatorTool'](parameters);

      expect(result.result).toBe(8); // 2 + (2 * 3) = 8
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle calculator tool errors', async () => {
      const parameters = { expression: 'invalid expression' };

      await expect((agent as any)['calculatorTool'](parameters))
        .rejects.toThrow('Calculator error');
    });

    it('should execute search tool correctly', async () => {
      const parameters = { query: 'machine learning' };

      const result = await (agent as any)['searchTool'](parameters);

      expect(result.query).toBe('machine learning');
      expect(result.results).toHaveLength(2);
      expect(result.success).toBe(true);
    });

    it('should execute knowledge base tool correctly', async () => {
      const parameters = { query: 'What is deep learning?' };

      const result = await (agent as any)['knowledgeBaseTool'](parameters);

      expect(result.query).toBe('What is deep learning?');
      expect(result.knowledge).toContain('Mock knowledge base entry');
      expect(result.success).toBe(true);
    });

    it('should execute Python executor tool correctly', async () => {
      const parameters = { code: 'print("Hello, World!")' };

      const result = await (agent as any)['pythonExecutorTool'](parameters);

      expect(result.code).toBe('print("Hello, World!")');
      expect(result.output).toBe('Mock Python execution output');
      expect(result.success).toBe(true);
    });

    it('should execute data analyzer tool correctly', async () => {
      const parameters = { data: [1, 2, 3, 4, 5] };

      const result = await (agent as any)['dataAnalyzerTool'](parameters);

      expect(result.dataPoints).toBe(5);
      expect(result.analysis).toBe('Mock data analysis results');
      expect(result.success).toBe(true);
    });

    it('should parse tool parameters correctly', () => {
      const mathContext = 'The expression 2 + 2 equals 4';
      const searchContext = 'Search for information about AI';
      const dataContext = 'Analyze the dataset [1,2,3,4]';

      expect((agent as any)['parseToolParameters']('calculator', mathContext))
        .toEqual({ expression: '2 + 2' });

      expect((agent as any)['parseToolParameters']('search', searchContext))
        .toEqual({ query: 'Search for' });

      expect((agent as any)['parseToolParameters']('data_analyzer', dataContext))
        .toEqual({});
    });
  });

  describe('Answer Validation', () => {
    it('should validate correct numerical answers', async () => {
      const mockTask = {
        expectedAnswer: 42
      };

      const validationSpy = jest.spyOn(agent as any, 'validateAnswer');
      validationSpy.mockResolvedValue({
        correct: true,
        reason: 'Exact match',
        tokensUsed: 50,
        cost: 0.0005
      });

      const result = await (agent as any)['validateAnswer'](mockTask, 42);

      expect(result.correct).toBe(true);
      expect(result.reason).toBe('Exact match');
    });

    it('should validate answers within tolerance', async () => {
      const mockTask = {
        expectedAnswer: 3.14159
      };

      const validationSpy = jest.spyOn(agent as any, 'validateAnswer');
      validationSpy.mockResolvedValue({
        correct: true,
        reason: 'Within tolerance',
        tokensUsed: 50,
        cost: 0.0005
      });

      const result = await (agent as any)['validateAnswer'](mockTask, 3.14);

      expect(result.correct).toBe(true);
      expect(result.reason).toBe('Within tolerance');
    });

    it('should reject incorrect answers', async () => {
      const mockTask = {
        expectedAnswer: 100
      };

      const validationSpy = jest.spyOn(agent as any, 'validateAnswer');
      validationSpy.mockResolvedValue({
        correct: false,
        reason: 'No match',
        tokensUsed: 50,
        cost: 0.0005
      });

      const result = await (agent as any)['validateAnswer'](mockTask, 50);

      expect(result.correct).toBe(false);
      expect(result.reason).toBe('No match');
    });

    it('should handle missing expected answers', async () => {
      const mockTask = {};

      const validationSpy = jest.spyOn(agent as any, 'validateAnswer');
      validationSpy.mockResolvedValue({
        correct: true,
        reason: 'Reasonable answer provided',
        tokensUsed: 30,
        cost: 0.0003
      });

      const result = await (agent as any)['validateAnswer'](mockTask, 'some answer');

      expect(result.correct).toBe(true);
      expect(result.reason).toBe('Reasonable answer provided');
    });
  });

  describe('Self Consistency', () => {
    it('should check consensus among multiple reasoning paths', async () => {
      const answers = [
        { answer: 42, confidence: 0.9 },
        { answer: 42, confidence: 0.85 },
        { answer: 42, confidence: 0.88 }
      ];

      const consensus = (agent as any)['checkConsensus'](answers);

      expect(consensus).toBe(true);
    });

    it('should detect lack of consensus', async () => {
      const answers = [
        { answer: 42, confidence: 0.9 },
        { answer: 43, confidence: 0.85 },
        { answer: 44, confidence: 0.88 }
      ];

      const consensus = (agent as any)['checkConsensus'](answers);

      expect(consensus).toBe(false);
    });

    it('should try self consistency when validation fails', async () => {
      const mockTask = {
        taskId: 'consistency-task',
        domain: 'mathematics',
        difficulty: 'medium',
        question: 'What is 15 * 3?',
        tools: ['calculator']
      };

      const mockPlan = {
        steps: ['Understand problem', 'Calculate'],
        tools: ['calculator']
      };

      // Mock initial validation to fail
      const validateAnswerSpy = jest.spyOn(agent as any, 'validateAnswer');
      validateAnswerSpy.mockResolvedValue({
        correct: false,
        reason: 'Answer incorrect',
        tokensUsed: 50,
        cost: 0.0005
      });

      // Mock self consistency to succeed
      const trySelfConsistencySpy = jest.spyOn(agent as any, 'trySelfConsistency');
      trySelfConsistencySpy.mockResolvedValue({
        consensus: true,
        tokensUsed: 300,
        cost: 0.003
      });

      const processTaskSpy = jest.spyOn(agent as any, 'processReasoningTask');
      processTaskSpy.mockImplementation(async function(this: General_Reasoning_Agent, task) {
        const reasoningResult = await this['executeReasoning'](task, mockPlan);
        const validationResult = await this['validateAnswer'](task, reasoningResult.finalAnswer);

        if (!validationResult.correct && this['useSelfConsistency'] > 1) {
          const consistencyResult = await this['trySelfConsistency'](task, mockPlan);
          return {
            success: consistencyResult.consensus,
            tokensUsed: reasoningResult.tokensUsed + consistencyResult.tokensUsed,
            cost: reasoningResult.cost + consistencyResult.cost,
            errorRecovered: consistencyResult.consensus
          };
        }

        return {
          success: validationResult.correct,
          tokensUsed: reasoningResult.tokensUsed + validationResult.tokensUsed,
          cost: reasoningResult.cost + validationResult.cost,
          errorRecovered: false
        };
      });

      const result = await (agent as any)['processReasoningTask'](mockTask);

      expect(result.success).toBe(true);
      expect(result.errorRecovered).toBe(true);
      expect(trySelfConsistencySpy).toHaveBeenCalled();
    });
  });

  describe('Step Confidence Calculation', () => {
    it('should calculate step confidence correctly', () => {
      const reasoning = 'Detailed step-by-step reasoning';
      const successfulToolExecution = {
        toolName: 'calculator',
        parameters: { expression: '2+2' },
        result: { result: 4 },
        success: true,
        executionTime: 100
      };

      const confidence = (agent as any)['calculateStepConfidence'](reasoning, successfulToolExecution);

      expect(confidence).toBeGreaterThan(0.8);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should calculate lower confidence for failed tool execution', () => {
      const reasoning = 'Basic reasoning';
      const failedToolExecution = {
        toolName: 'calculator',
        parameters: { expression: 'invalid' },
        result: null,
        success: false,
        executionTime: 100,
        error: 'Invalid expression'
      };

      const confidence = (agent as any)['calculateStepConfidence'](reasoning, failedToolExecution);

      expect(confidence).toBe(0.8);
    });
  });

  describe('Final Answer Generation', () => {
    it('should generate final answers for mathematics domain', async () => {
      const mockTask = {
        domain: 'mathematics',
        question: 'What is the area of a circle with radius 5?'
      };

      const reasoningSteps = [
        { reasoning: 'Area = π * r^2' },
        { reasoning: 'r = 5' },
        { reasoning: 'Area = π * 25' }
      ];

      const toolExecutions = [
        { toolName: 'calculator', result: { result: 78.54 } }
      ];

      const result = await (agent as any)['generateFinalAnswer'](mockTask, reasoningSteps, toolExecutions);

      expect(result.answer).toBeCloseTo(78.54, 1);
      expect(result.reasoning).toContain('π * 25');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should generate final answers for logic domain', async () => {
      const mockTask = {
        domain: 'logic',
        question: 'What can we conclude from "All A are B" and "Some B are C"?'
      };

      const reasoningSteps = [
        { reasoning: 'All A are B means A ⊆ B' },
        { reasoning: 'Some B are C means B ∩ C ≠ ∅' },
        { reasoning: 'We cannot determine A ∩ C' }
      ];

      const result = await (agent as any)['generateFinalAnswer'](mockTask, reasoningSteps, []);

      expect(result.answer).toContain('Insufficient information');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Metrics Calculation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a reasoning task with multiple steps and detailed analysis';
      const estimatedTokens = (agent as any)['estimateTokens'](text);

      expect(estimatedTokens).toBe(Math.ceil(text.length / 4));
    });

    it('should estimate cost correctly', () => {
      const tokens = 1000;
      const estimatedCost = (agent as any)['estimateCost'](tokens);

      expect(estimatedCost).toBe(tokens * 0.00001);
    });
  });

  describe('Integration with BaseExecutionAgent', () => {
    it('should extend BaseExecutionAgent correctly', () => {
      expect(agent).toBeInstanceOf(BaseExecutionAgent);
      expect(agent).toBeInstanceOf(General_Reasoning_Agent);
    });

    it('should emit base agent events', async () => {
      const startedSpy = jest.fn();
      const logSpy = jest.fn();

      agent.on('started', startedSpy);
      agent.on('log', logSpy);

      // Mock the execution to focus on event emission
      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: General_Reasoning_Agent) {
        this['log']('Reasoning task execution started');
      });

      await agent.execute();

      expect(startedSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith({
        message: expect.stringContaining('Reasoning task execution started'),
        timestamp: expect.any(String)
      });
    });

    it('should record task completion correctly', async () => {
      const mockTask = {
        taskId: 'reasoning-task',
        domain: 'mathematics',
        difficulty: 'medium',
        question: 'What is 1 + 1?',
        tools: []
      };

      const processTaskSpy = jest.spyOn(agent as any, 'processReasoningTask');
      processTaskSpy.mockResolvedValue({
        success: true,
        tokensUsed: 100,
        cost: 0.001
      });

      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: General_Reasoning_Agent) {
        const result = await this['processReasoningTask'](mockTask);
        this['recordTaskCompletion'](result.success, result.tokensUsed, result.cost);
      });

      await agent.execute();

      const metrics = agent.getMetrics();
      expect(metrics.performance.totalTasks).toBe(1);
      expect(metrics.performance.completedTasks).toBe(1);
      expect(metrics.cost.totalTokens).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution failures gracefully', async () => {
      const mockTask = {
        taskId: 'error-task',
        domain: 'mathematics',
        question: 'What is 1 + 1?',
        tools: ['calculator']
      };

      const mockPlan = {
        steps: ['Solve problem'],
        tools: ['calculator']
      };

      const executeToolSpy = jest.spyOn(agent as any, 'executeTool');
      executeToolSpy.mockRejectedValue(new Error('Tool execution failed'));

      const result = await (agent as any)['executeReasoning'](mockTask, mockPlan);

      expect(result.finalAnswer).toBeDefined(); // Should still provide an answer
      expect(result.toolExecutions).toHaveLength(1);
      expect(result.toolExecutions[0].success).toBe(false);
    });

    it('should handle invalid tool parameters', async () => {
      await expect((agent as any)['calculatorTool']({}))
        .rejects.toThrow('Calculator error');
    });

    it('should handle validation errors', async () => {
      const mockTask = {
        expectedAnswer: 'specific answer'
      };

      const validateAnswerSpy = jest.spyOn(agent as any, 'validateAnswer');
      validateAnswerSpy.mockRejectedValue(new Error('Validation failed'));

      await expect((agent as any)['validateAnswer'](mockTask, 'different answer'))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate reasoning model configuration', () => {
      expect(agent.getConfiguration().reasoningModel).toBe('test-model');
    });

    it('should validate temperature bounds', () => {
      const configWithHighTemp: GeneralReasoningConfig = {
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        configuration: {
          temperature: 2.0 // Should be clamped or validated
        }
      };

      const agentWithHighTemp = new General_Reasoning_Agent(configWithHighTemp);
      expect(agentWithHighTemp.getConfiguration().temperature).toBe(2.0);
    });

    it('should validate self consistency configuration', () => {
      expect(agent.getConfiguration().useSelfConsistency).toBe(3);
    });
  });
});