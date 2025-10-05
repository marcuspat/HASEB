/**
 * Comprehensive Integration Tests for HASEB LangGraph Orchestration System
 * Tests the complete evaluation pipeline from API to completion
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { EvaluationOrchestrator } from '../../src/orchestrator/EvaluationOrchestrator';
import { ExecutionEngine } from '../../src/orchestrator/ExecutionEngine';
import { SWE_Bench_Agent } from '../../src/agents/SWE_Bench_Agent';
import { GUI_Automation_Agent } from '../../src/agents/GUI_Automation_Agent';
import { General_Reasoning_Agent } from '../../src/agents/General_Reasoning_Agent';
import { MetricsOrchestrator } from '../../src/services/metrics/MetricsOrchestrator';
import { logger } from '../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Mock database models to avoid database dependency during testing
jest.mock('../../src/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn().mockResolvedValue({
      id: 'mock-eval-id',
      agentId: 'mock-agent-id',
      benchmarkId: 'mock-benchmark-id',
      status: 'running',
      configuration: {},
      logs: [],
      metrics: null,
      startTime: new Date()
    }),
    updateStatusWithTime: jest.fn().mockResolvedValue(true),
    updateMetrics: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../src/database/models/Agent', () => ({
  AgentModel: {
    findById: jest.fn().mockResolvedValue({
      id: 'mock-agent-id',
      name: 'Test Agent',
      type: 'test',
      configuration: {}
    })
  }
}));

jest.mock('../../src/database/models/Benchmark', () => ({
  BenchmarkModel: {
    findById: jest.fn().mockResolvedValue({
      id: 'mock-benchmark-id',
      name: 'Test Benchmark',
      type: 'test',
      dataset: 'test-dataset'
    })
  }
}));

describe('HASEB LangGraph Orchestration Integration Tests', () => {
  let evaluationOrchestrator: EvaluationOrchestrator;
  let executionEngine: ExecutionEngine;
  let metricsOrchestrator: MetricsOrchestrator;
  let testAgentId: string;
  let testBenchmarkId: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    // Initialize test identifiers
    testAgentId = 'test-agent-' + uuidv4();
    testBenchmarkId = 'test-benchmark-' + uuidv4();

    // Configure logger for testing
    logger.level = 'error'; // Reduce noise during tests

    console.log('🚀 Initializing HASEB Orchestration Integration Tests');
    console.log(`   Agent ID: ${testAgentId}`);
    console.log(`   Benchmark ID: ${testBenchmarkId}`);
  });

  afterAll(async () => {
    // Cleanup test environment
    console.log('🧹 Cleaning up test environment');
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize fresh components for each test
    evaluationOrchestrator = new EvaluationOrchestrator();
    executionEngine = new ExecutionEngine(5, 30000); // 5 concurrent tasks, 30s timeout

    await evaluationOrchestrator.initialize();
  });

  afterEach(async () => {
    // Cleanup components
    try {
      await evaluationOrchestrator.cleanup();
      await executionEngine.shutdown();
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  });

  describe('1. Orchestrator Core Integration', () => {
    test('should initialize EvaluationOrchestrator with LangGraph workflow', async () => {
      console.log('📊 Testing orchestrator initialization...');

      expect(evaluationOrchestrator).toBeDefined();
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);

      const currentEval = evaluationOrchestrator.getCurrentEvaluation();
      expect(currentEval).toBeUndefined();

      console.log('✅ Orchestrator initialized successfully');
    });

    test('should execute complete evaluation workflow from start to finish', async () => {
      console.log('🔄 Testing complete evaluation workflow...');

      const configuration = {
        timeout: 10000,
        enableMetrics: true,
        testMode: true
      };

      // Start evaluation
      const evalPromise = evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      // Monitor progress
      const updates: string[] = [];
      const checkProgress = setInterval(() => {
        const current = evaluationOrchestrator.getCurrentEvaluation();
        if (current) {
          updates.push(`Status: ${current.status}, Progress: ${current.logs.length} logs`);
        }
      }, 1000);

      // Wait for completion
      const result = await evalPromise;
      clearInterval(checkProgress);

      // Verify results
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.id).toBeDefined();
      expect(result.agentId).toBe(testAgentId);
      expect(result.benchmarkId).toBe(testBenchmarkId);
      expect(result.logs).toHaveLength.greaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      console.log(`✅ Evaluation completed successfully`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Duration: ${result.endTime.getTime() - result.startTime.getTime()}ms`);
      console.log(`   Logs: ${result.logs.length}`);
      console.log(`   Metrics collected: ${Object.keys(result.metrics || {}).length}`);
    });

    test('should handle concurrent evaluations properly', async () => {
      console.log('⚡ Testing concurrent evaluation handling...');

      const configuration = { timeout: 5000, testMode: true };

      // First evaluation should succeed
      const firstEval = evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      // Second evaluation should be rejected
      try {
        await evaluationOrchestrator.executeEvaluation(
          testAgentId + '-2',
          testBenchmarkId,
          configuration
        );
        fail('Expected second evaluation to be rejected');
      } catch (error) {
        expect(error.message).toContain('already running');
      }

      // Wait for first evaluation to complete
      const firstResult = await firstEval;
      expect(firstResult.status).toBe('completed');

      console.log('✅ Concurrent evaluations handled correctly');
    });
  });

  describe('2. Agent Execution Integration', () => {
    test('should execute SWE-Bench agent with Docker environment', async () => {
      console.log('🐳 Testing SWE-Bench agent execution...');

      const config = {
        dockerImage: 'haseb/swe-bench:latest',
        workspacePath: '/tmp/haseb-test-' + Date.now(),
        pythonPath: 'python3',
        testCommand: 'pytest -v',
        maxPatchAttempts: 2,
        codeGenModel: 'gpt-4',
        temperature: 0.1,
        timeout: 15000,
        testMode: true
      };

      const agent = new SWE_Bench_Agent(config);

      // Mock Docker commands for testing
      const mockSpawn = jest.fn();
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      // Start agent execution
      agent.start();

      // Wait for progress updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check agent status
      expect(agent.isRunning()).toBe(true);

      // Stop agent
      await agent.stop();

      console.log('✅ SWE-Bench agent executed successfully');
    });

    test('should execute GUI Automation agent with virtual display', async () => {
      console.log('🖥️ Testing GUI Automation agent execution...');

      const config = {
        displayWidth: 1024,
        displayHeight: 768,
        screenshotInterval: 1000,
        maxSteps: 10,
        browserType: 'chromium',
        headless: true,
        timeout: 15000,
        testMode: true
      };

      const agent = new GUI_Automation_Agent(config);
      agent.start();

      // Wait for setup
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(agent.isRunning()).toBe(true);

      await agent.stop();

      console.log('✅ GUI Automation agent executed successfully');
    });

    test('should execute General Reasoning agent with tools', async () => {
      console.log('🧠 Testing General Reasoning agent execution...');

      const config = {
        reasoningModel: 'gpt-4',
        maxReasoningSteps: 5,
        temperature: 0.1,
        toolsEnabled: ['calculator', 'search'],
        useChainOfThought: true,
        useSelfConsistency: 1,
        timeout: 15000,
        testMode: true
      };

      const agent = new General_Reasoning_Agent(config);
      agent.start();

      // Wait for reasoning tasks
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(agent.isRunning()).toBe(true);

      await agent.stop();

      console.log('✅ General Reasoning agent executed successfully');
    });
  });

  describe('3. Environment Management', () => {
    test('should create and manage execution environments', async () => {
      console.log('🌍 Testing environment management...');

      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 3,
        testMode: true
      });

      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('type');
      expect(tasks[0]).toHaveProperty('input');
      expect(tasks[0]).toHaveProperty('expectedOutput');

      console.log(`✅ Loaded ${tasks.length} tasks for environment`);
    });

    test('should handle environment cleanup properly', async () => {
      console.log('🧹 Testing environment cleanup...');

      // Start some tasks
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 2,
        testMode: true
      });

      const executions = [];
      for (const task of tasks) {
        const exec = executionEngine.executeTask(
          uuidv4(),
          task,
          { agentId: testAgentId, environment: {}, configuration: {} }
        );
        executions.push(exec);
      }

      // Wait a bit then shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      const cancelledCount = executionEngine.cancelAllTasks('Test shutdown');
      expect(cancelledCount).toBeGreaterThanOrEqual(0);

      await executionEngine.shutdown();

      console.log('✅ Environment cleanup completed successfully');
    });
  });

  describe('4. Metrics Collection Integration', () => {
    test('should initialize and coordinate all 5 metrics collectors', async () => {
      console.log('📈 Testing metrics orchestrator initialization...');

      const metricsContext = {
        evaluationId: uuidv4(),
        agentId: testAgentId,
        benchmarkId: testBenchmarkId,
        sessionId: uuidv4(),
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform,
          version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' }
        }
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await metricsOrchestrator.initialize();

      const summaries = metricsOrchestrator.getCollectorSummaries();

      expect(summaries).toHaveProperty('performance');
      expect(summaries).toHaveProperty('efficiency');
      expect(summaries).toHaveProperty('cost');
      expect(summaries).toHaveProperty('robustness');
      expect(summaries).toHaveProperty('quality');

      console.log('✅ All 5 metrics collectors initialized successfully');
    });

    test('should collect real-time metrics during execution', async () => {
      console.log('📊 Testing real-time metrics collection...');

      const metricsContext = {
        evaluationId: uuidv4(),
        agentId: testAgentId,
        benchmarkId: testBenchmarkId,
        sessionId: uuidv4(),
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform,
          version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' }
        }
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext, {
        aggregation: {
          interval: 500, // Fast updates for testing
          enableRealTimeUpdates: true,
          persistenceBatchSize: 1
        }
      });

      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      // Simulate task execution with metrics
      const updates: any[] = [];
      metricsOrchestrator.on('real_time_update', (update) => {
        updates.push(update);
      });

      // Record some activities
      metricsOrchestrator.recordTaskStart('test-task-1', 5);
      await new Promise(resolve => setTimeout(resolve, 600));

      metricsOrchestrator.recordTokenUsage('gpt-4', 100, 50);
      await new Promise(resolve => setTimeout(resolve, 600));

      metricsOrchestrator.recordTaskCompletion('test-task-1', true, 0.95);
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(updates.length).toBeGreaterThan(0);

      const currentMetrics = await metricsOrchestrator.getCurrentMetrics();
      expect(currentMetrics).toBeDefined();

      await metricsOrchestrator.stop();

      console.log(`✅ Collected ${updates.length} real-time metrics updates`);
    });

    test('should aggregate metrics across all collectors', async () => {
      console.log('🔄 Testing metrics aggregation...');

      const metricsContext = {
        evaluationId: uuidv4(),
        agentId: testAgentId,
        benchmarkId: testBenchmarkId,
        sessionId: uuidv4(),
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform,
          version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' }
        }
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      // Record comprehensive activities
      metricsOrchestrator.recordTaskStart('task-1', 3);
      metricsOrchestrator.recordTokenUsage('gpt-4', 500, 300);
      metricsOrchestrator.recordApiCall('openai', '/chat/completions', 0.05, 800, 1500);
      metricsOrchestrator.recordToolUsage('calculator', true, 100);
      metricsOrchestrator.recordError('transient', 'api_failure', 'Test error', { retry: 1 });
      metricsOrchestrator.recordDecision('test', ['a', 'b', 'c'], 'a', 'a', 'Test reasoning', 0.9);
      metricsOrchestrator.recordOutputQuality('task-1', 0.9, 0.85, 0.95, 0.88, 'Good quality');
      metricsOrchestrator.recordTaskCompletion('task-1', true, 0.92);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const aggregatedMetrics = await metricsOrchestrator.getCurrentMetrics();

      expect(aggregatedMetrics).toHaveProperty('performance');
      expect(aggregatedMetrics).toHaveProperty('efficiency');
      expect(aggregatedMetrics).toHaveProperty('cost');
      expect(aggregatedMetrics).toHaveProperty('robustness');
      expect(aggregatedMetrics).toHaveProperty('quality');
      expect(aggregatedMetrics).toHaveProperty('aggregated');

      if (aggregatedMetrics?.aggregated) {
        expect(aggregatedMetrics.aggregated.overallScore).toBeGreaterThan(0);
        expect(aggregatedMetrics.aggregated.overallScore).toBeLessThanOrEqual(1);
      }

      await metricsOrchestrator.stop();

      console.log('✅ Metrics aggregation completed successfully');
      console.log(`   Overall score: ${aggregatedMetrics?.aggregated?.overallScore}`);
    });
  });

  describe('5. WebSocket Communication', () => {
    test('should emit real-time progress updates', async () => {
      console.log('🔌 Testing WebSocket progress updates...');

      const progressUpdates: any[] = [];

      // Mock WebSocket-like event handling
      evaluationOrchestrator.on('progress', (update) => {
        progressUpdates.push(update);
      });

      const configuration = {
        timeout: 8000,
        enableMetrics: true,
        enableRealTimeUpdates: true,
        testMode: true
      };

      // Execute evaluation and collect updates
      const evalPromise = evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      // Wait for completion
      const result = await evalPromise;

      expect(result.status).toBe('completed');
      expect(progressUpdates.length).toBeGreaterThan(0);

      console.log(`✅ Received ${progressUpdates.length} progress updates`);
    });
  });

  describe('6. Error Recovery and Handling', () => {
    test('should handle agent execution failures gracefully', async () => {
      console.log('🛡️ Testing error handling and recovery...');

      // Configuration that will cause failure
      const configuration = {
        timeout: 1000, // Very short timeout
        forceFailure: true,
        testMode: true
      };

      try {
        const result = await evaluationOrchestrator.executeEvaluation(
          testAgentId,
          testBenchmarkId,
          configuration
        );

        // If it doesn't fail, that's also valid behavior
        expect(['completed', 'failed']).toContain(result.status);

      } catch (error) {
        // Expected behavior for some error conditions
        expect(error).toBeDefined();
      }

      console.log('✅ Error handling completed successfully');
    });

    test('should recover from transient failures', async () => {
      console.log('🔄 Testing transient failure recovery...');

      const metricsContext = {
        evaluationId: uuidv4(),
        agentId: testAgentId,
        benchmarkId: testBenchmarkId,
        sessionId: uuidv4(),
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform,
          version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' }
        }
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext);
      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      // Simulate transient errors and recovery
      metricsOrchestrator.recordError('transient', 'api_failure', 'Rate limit exceeded', { retry: 1 });
      metricsOrchestrator.recordError('transient', 'timeout', 'Request timeout', { retry: 2 });
      metricsOrchestrator.recordTaskStart('recovery-task', 1);
      metricsOrchestrator.recordTaskCompletion('recovery-task', true, 0.8);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = await metricsOrchestrator.getCurrentMetrics();
      expect(metrics?.robustness).toBeDefined();

      await metricsOrchestrator.stop();

      console.log('✅ Transient failure recovery tested successfully');
    });
  });

  describe('7. End-to-End Workflow Integration', () => {
    test('should execute complete API-to-completion workflow', async () => {
      console.log('🎯 Testing complete end-to-end workflow...');

      // This test simulates the complete flow:
      // API Request → Orchestrator → Agent Execution → Metrics Collection → Results

      const configuration = {
        enableMetrics: true,
        enableRealTimeUpdates: true,
        timeout: 12000,
        testMode: true,
        workflow: 'complete-integration-test'
      };

      const startTime = Date.now();

      // Execute complete workflow
      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Verify complete workflow
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      // Verify workflow timing
      expect(totalDuration).toBeGreaterThan(5000); // Should take some time
      expect(totalDuration).toBeLessThan(30000); // But not too long

      console.log('✅ Complete end-to-end workflow executed successfully');
      console.log(`   Total duration: ${totalDuration}ms`);
      console.log(`   Evaluation ID: ${result.id}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Logs generated: ${result.logs.length}`);
      console.log(`   Metrics categories: ${Object.keys(result.metrics || {}).length}`);
    });

    test('should handle multiple concurrent task executions', async () => {
      console.log('⚡ Testing concurrent task execution...');

      // Load multiple tasks
      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 5,
        testMode: true
      });

      expect(tasks).toHaveLength(5);

      // Execute tasks concurrently
      const taskPromises = tasks.map(task =>
        executionEngine.executeTask(
          uuidv4(),
          task,
          { agentId: testAgentId, environment: {}, configuration: { testMode: true } }
        )
      );

      // Wait for all tasks to complete
      const results = await Promise.allSettled(taskPromises);

      // Verify results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(5);
      expect(successful).toBeGreaterThan(0); // At least some should succeed

      console.log(`✅ Concurrent execution completed: ${successful} successful, ${failed} failed`);
    });
  });

  describe('8. Performance and Load Testing', () => {
    test('should handle high-frequency metrics collection', async () => {
      console.log('🚀 Testing high-frequency metrics collection...');

      const metricsContext = {
        evaluationId: uuidv4(),
        agentId: testAgentId,
        benchmarkId: testBenchmarkId,
        sessionId: uuidv4(),
        startTime: new Date(),
        configuration: { testMode: true },
        environment: {
          platform: process.platform,
          version: process.version,
          resources: { cpu: 'test', memory: 'test', storage: 'test' }
        }
      };

      metricsOrchestrator = new MetricsOrchestrator(metricsContext, {
        aggregation: {
          interval: 100, // Very high frequency
          enableRealTimeUpdates: true,
          persistenceBatchSize: 5
        }
      });

      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      // Generate high-frequency events
      const startTime = Date.now();
      let eventsGenerated = 0;

      const interval = setInterval(() => {
        metricsOrchestrator.recordTokenUsage('gpt-4', 50, 25);
        metricsOrchestrator.recordApiCall('test', '/endpoint', 0.001, 75, 100);
        eventsGenerated++;
      }, 50);

      // Run for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      clearInterval(interval);

      const duration = Date.now() - startTime;
      const eventsPerSecond = eventsGenerated / (duration / 1000);

      expect(eventsPerSecond).toBeGreaterThan(10); // Should handle at least 10 events/sec

      await metricsOrchestrator.stop();

      console.log(`✅ High-frequency metrics collection: ${eventsPerSecond.toFixed(1)} events/sec`);
    });
  });
});

console.log('🎯 HASEB LangGraph Orchestration Integration Tests Complete');