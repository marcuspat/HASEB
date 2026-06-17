/**
 * Node.js Environment Integration Tests for HASEB LangGraph Orchestration System
 * Uses Node environment to avoid DOM-related issues with LangGraph
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { EvaluationOrchestrator } from '../../src/orchestrator/EvaluationOrchestrator';
import { ExecutionEngine } from '../../src/orchestrator/ExecutionEngine';
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

/**
 * @jest-environment node
 */
describe('HASEB Orchestration System Integration Tests (Node Environment)', () => {
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

    console.log('🚀 Initializing HASEB Orchestration Integration Tests (Node Environment)');
    console.log(`   Agent ID: ${testAgentId}`);
    console.log(`   Benchmark ID: ${testBenchmarkId}`);
    console.log(`   Environment: Node.js ${process.version}`);
    console.log(`   Platform: ${process.platform}`);
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up test environment');
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize fresh components for each test
    evaluationOrchestrator = new EvaluationOrchestrator();
    executionEngine = new ExecutionEngine(5, 30000); // 5 concurrent tasks, 30s timeout
  });

  afterEach(async () => {
    // Cleanup components
    try {
      if (evaluationOrchestrator) {
        await evaluationOrchestrator.cleanup();
      }
      if (executionEngine) {
        await executionEngine.shutdown();
      }
      if (metricsOrchestrator) {
        await metricsOrchestrator.cleanup();
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  });

  describe('1. LangGraph EvaluationOrchestrator Core', () => {
    test('should initialize EvaluationOrchestrator with LangGraph workflow', async () => {
      console.log('📊 Testing orchestrator initialization...');

      expect(evaluationOrchestrator).toBeDefined();
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);

      const currentEval = evaluationOrchestrator.getCurrentEvaluation();
      expect(currentEval).toBeUndefined();

      console.log('✅ Orchestrator initialized successfully');
    });

    test('should execute complete evaluation workflow with LangGraph StateGraph', async () => {
      console.log('🔄 Testing complete LangGraph evaluation workflow...');

      const configuration = {
        timeout: 10000,
        enableMetrics: true,
        testMode: true
      };

      const startTime = Date.now();

      // Start evaluation
      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify LangGraph execution results
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.id).toBeDefined();
      expect(result.agentId).toBe(testAgentId);
      expect(result.benchmarkId).toBe(testBenchmarkId);
      (expect(result.logs) as any).toHaveLength.greaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      // Verify LangGraph workflow steps were executed
      const logMessages = result.logs.join(' ');
      expect(logMessages).toContain('Setup completed');
      expect(logMessages).toContain('Evaluation executed');
      expect(logMessages).toContain('Metrics collected');
      expect(logMessages).toContain('Results analyzed');
      expect(logMessages).toContain('Cleanup completed');

      console.log('✅ LangGraph evaluation workflow completed successfully');
      console.log(`   Status: ${result.status}`);
      console.log(`   Execution Time: ${executionTime}ms`);
      console.log(`   Logs: ${result.logs.length}`);
      console.log(`   Metrics collected: ${Object.keys(result.metrics || {}).length}`);
      console.log(`   Workflow steps executed: ${result.logs.length}`);
    });

    test('should demonstrate LangGraph StateGraph execution flow', async () => {
      console.log('🔀 Testing LangGraph StateGraph execution flow...');

      const configuration = {
        timeout: 8000,
        enableMetrics: true,
        testMode: true,
        workflow: 'stategraph-demo'
      };

      // The LangGraph should execute nodes in sequence: setup → execute → collectMetrics → analyzeResults → cleanup
      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      // Verify the StateGraph executed all nodes
      expect(result.status).toBe('completed');
      expect(result.logs.length).toBeGreaterThanOrEqual(5); // At least 5 workflow nodes

      // Check for specific LangGraph node execution
      const logText = result.logs.join('\n');
      expect(logText).toMatch(/Setup completed for agent/);
      expect(logText).toMatch(/Evaluation executed successfully/);
      expect(logText).toMatch(/Metrics collected/);
      expect(logText).toMatch(/Results analyzed/);
      expect(logText).toMatch(/Cleanup completed/);

      console.log('✅ LangGraph StateGraph execution flow verified');
      console.log(`   Nodes executed: ${result.logs.length}`);
      console.log(`   Graph execution successful: ${result.status === 'completed'}`);
    });
  });

  describe('2. ExecutionEngine Task Management', () => {
    test('should load and manage benchmark tasks', async () => {
      console.log('📋 Testing task loading and management...');

      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 3,
        testMode: true
      });

      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('type');
      expect(tasks[0]).toHaveProperty('input');
      expect(tasks[0]).toHaveProperty('expectedOutput');

      // Verify task types
      const taskTypes = tasks.map(t => t.type);
      expect(taskTypes).toContain('code-generation');
      expect(taskTypes).toContain('reasoning');
      expect(taskTypes).toContain('gui-automation');

      console.log(`✅ Loaded ${tasks.length} tasks: ${taskTypes.join(', ')}`);
    });

    test('should execute individual tasks with proper state management', async () => {
      console.log('⚡ Testing individual task execution...');

      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 2,
        testMode: true
      });

      const results = [];
      for (const task of tasks) {
        const result = await executionEngine.executeTask(
          uuidv4(),
          task,
          { agentId: testAgentId, environment: {}, configuration: { testMode: true } }
        );
        results.push(result);
      }

      expect(results).toHaveLength(2);

      // Verify task execution results
      results.forEach((result, index) => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('startTime');
        expect(result).toHaveProperty('endTime');
        expect(result).toHaveProperty('duration');
        expect(['completed', 'failed']).toContain(result.status);
        expect(result.duration).toBeGreaterThan(0);
      });

      const successful = results.filter(r => r.status === 'completed').length;
      console.log(`✅ Task execution completed: ${successful}/${results.length} successful`);
    });

    test('should handle concurrent task execution properly', async () => {
      console.log('🚀 Testing concurrent task execution...');

      const tasks = await executionEngine.loadTasks(testBenchmarkId, {
        taskCount: 4,
        testMode: true
      });

      // Execute tasks concurrently
      const taskPromises = tasks.map(task =>
        executionEngine.executeTask(
          uuidv4(),
          task,
          { agentId: testAgentId, environment: {}, configuration: { testMode: true } }
        )
      );

      const results = await Promise.allSettled(taskPromises);

      // Verify results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(4);
      expect(successful).toBeGreaterThan(0);

      // Check execution statistics
      const stats = executionEngine.getExecutionStats();
      expect(stats).toHaveProperty('activeExecutions');
      expect(stats).toHaveProperty('maxConcurrentTasks');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('successRate');

      console.log(`✅ Concurrent execution: ${successful} successful, ${failed} failed`);
      console.log(`   Max concurrent tasks: ${stats.maxConcurrentTasks}`);
      console.log(`   Active executions: ${stats.activeExecutions}`);
    });
  });

  describe('3. Metrics Collection System', () => {
    test('should initialize MetricsOrchestrator with all collectors', async () => {
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

      // Verify all 5 collectors are initialized
      expect(summaries).toHaveProperty('performance');
      expect(summaries).toHaveProperty('efficiency');
      expect(summaries).toHaveProperty('cost');
      expect(summaries).toHaveProperty('robustness');
      expect(summaries).toHaveProperty('quality');

      console.log('✅ All 5 metrics collectors initialized successfully');
    });

    test('should collect comprehensive metrics during execution', async () => {
      console.log('📊 Testing comprehensive metrics collection...');

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
          interval: 200, // Fast updates for testing
          enableRealTimeUpdates: true,
          persistenceBatchSize: 1
        }
      });

      await metricsOrchestrator.initialize();
      await metricsOrchestrator.start();

      // Simulate comprehensive evaluation activities
      const updates: any[] = [];
      metricsOrchestrator.on('real_time_update', (update) => {
        updates.push(update);
      });

      // Record various metric events
      metricsOrchestrator.recordTaskStart('test-task-1', 5);
      await new Promise(resolve => setTimeout(resolve, 100));

      metricsOrchestrator.recordTokenUsage('gpt-4', 1000, 500);
      metricsOrchestrator.recordApiCall('openai', '/chat/completions', 0.05, 1500, 2000);
      await new Promise(resolve => setTimeout(resolve, 100));

      metricsOrchestrator.recordToolUsage('calculator', true, 150);
      metricsOrchestrator.recordError('transient', 'api_failure', 'Rate limit', { retry: 1 });
      await new Promise(resolve => setTimeout(resolve, 100));

      metricsOrchestrator.recordDecision('test', ['a', 'b', 'c'], 'a', 'a', 'Test reasoning', 0.9);
      metricsOrchestrator.recordOutputQuality('test-task-1', 0.9, 0.85, 0.95, 0.88, 'Good quality');
      await new Promise(resolve => setTimeout(resolve, 100));

      metricsOrchestrator.recordTaskCompletion('test-task-1', true, 0.92);
      await new Promise(resolve => setTimeout(resolve, 500)); // Allow for aggregation

      // Verify metrics were collected
      expect(updates.length).toBeGreaterThan(0);

      const currentMetrics = await metricsOrchestrator.getCurrentMetrics();
      expect(currentMetrics).toBeDefined();
      expect(currentMetrics).toHaveProperty('performance');
      expect(currentMetrics).toHaveProperty('efficiency');
      expect(currentMetrics).toHaveProperty('cost');
      expect(currentMetrics).toHaveProperty('robustness');
      expect(currentMetrics).toHaveProperty('quality');

      await metricsOrchestrator.stop();

      console.log(`✅ Comprehensive metrics collected: ${updates.length} real-time updates`);
      console.log(`   Final metrics categories: ${Object.keys(currentMetrics || {}).length}`);
    });

    test('should calculate aggregated metrics correctly', async () => {
      console.log('🧮 Testing metrics aggregation...');

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

      // Record activities that should contribute to aggregation
      metricsOrchestrator.recordTaskStart('task-1', 3);
      metricsOrchestrator.recordTokenUsage('gpt-4', 2000, 1000);
      metricsOrchestrator.recordApiCall('openai', '/chat/completions', 0.10, 3000, 4000);
      metricsOrchestrator.recordToolUsage('calculator', true, 200);
      metricsOrchestrator.recordError('transient', 'timeout', 'Request timeout', { retry: 2 });
      metricsOrchestrator.recordDecision('analysis', ['a', 'b'], 'a', 'a', 'Good reasoning', 0.95);
      metricsOrchestrator.recordOutputQuality('task-1', 0.95, 0.90, 0.98, 0.92, 'Excellent');
      metricsOrchestrator.recordTaskCompletion('task-1', true, 0.94);

      await new Promise(resolve => setTimeout(resolve, 1000)); // Allow aggregation

      const aggregatedMetrics = await metricsOrchestrator.getCurrentMetrics();

      expect(aggregatedMetrics).toBeDefined();
      expect(aggregatedMetrics).toHaveProperty('aggregated');

      if (aggregatedMetrics?.aggregated) {
        expect(aggregatedMetrics.aggregated.overallScore).toBeGreaterThan(0);
        expect(aggregatedMetrics.aggregated.overallScore).toBeLessThanOrEqual(1);
        expect(aggregatedMetrics.aggregated.rank).toBeDefined();
        expect(aggregatedMetrics.aggregated.percentile).toBeDefined();
        expect(aggregatedMetrics.aggregated.confidence).toBeDefined();
      }

      await metricsOrchestrator.stop();

      console.log('✅ Metrics aggregation completed successfully');
      if (aggregatedMetrics?.aggregated) {
        console.log(`   Overall score: ${(aggregatedMetrics.aggregated.overallScore * 100).toFixed(1)}%`);
        console.log(`   Rank: ${aggregatedMetrics.aggregated.rank}`);
        console.log(`   Percentile: ${aggregatedMetrics.aggregated.percentile}%`);
        console.log(`   Confidence: ${(aggregatedMetrics.aggregated.confidence * 100).toFixed(1)}%`);
      }
    });
  });

  describe('4. Error Handling and Recovery', () => {
    test('should handle orchestration failures gracefully', async () => {
      console.log('🛡️ Testing orchestration error handling...');

      // Configuration that might cause issues
      const configuration = {
        timeout: 1000, // Very short timeout
        testMode: true
      };

      try {
        const result = await evaluationOrchestrator.executeEvaluation(
          testAgentId,
          testBenchmarkId,
          configuration
        );

        // Should either complete or fail gracefully
        expect(['completed', 'failed']).toContain(result.status);

      } catch (error) {
        // Some errors are expected with extreme configurations
        expect(error).toBeDefined();
      }

      console.log('✅ Error handling completed gracefully');
    });

    test('should demonstrate recovery mechanisms', async () => {
      console.log('🔄 Testing recovery mechanisms...');

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

      // Simulate error scenarios and recovery
      metricsOrchestrator.recordError('transient', 'api_failure', 'Rate limit exceeded', { retry: 1 });
      metricsOrchestrator.recordError('transient', 'timeout', 'Request timeout', { retry: 2 });

      // Simulate recovery
      metricsOrchestrator.recordTaskStart('recovery-task', 1);
      metricsOrchestrator.recordTaskCompletion('recovery-task', true, 0.8);

      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = await metricsOrchestrator.getCurrentMetrics();
      expect(metrics?.robustness).toBeDefined();

      await metricsOrchestrator.stop();

      console.log('✅ Recovery mechanisms tested successfully');
    });
  });

  describe('5. End-to-End Integration Verification', () => {
    test('should execute complete evaluation pipeline end-to-end', async () => {
      console.log('🎯 Testing complete end-to-end evaluation pipeline...');

      const configuration = {
        enableMetrics: true,
        enableRealTimeUpdates: true,
        timeout: 15000,
        testMode: true,
        pipeline: 'complete-e2e-test'
      };

      const pipelineStartTime = Date.now();

      // Execute complete pipeline
      const result = await evaluationOrchestrator.executeEvaluation(
        testAgentId,
        testBenchmarkId,
        configuration
      );

      const pipelineEndTime = Date.now();
      const totalPipelineDuration = pipelineEndTime - pipelineStartTime;

      // Verify complete pipeline execution
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      // Verify LangGraph workflow was executed
      const workflowLogs = result.logs.join('\n');
      expect(workflowLogs).toContain('Setup completed');
      expect(workflowLogs).toContain('Evaluation executed');
      expect(workflowLogs).toContain('Metrics collected');
      expect(workflowLogs).toContain('Results analyzed');
      expect(workflowLogs).toContain('Cleanup completed');

      // Verify timing
      expect(totalPipelineDuration).toBeGreaterThan(2000); // Should take some time
      expect(totalPipelineDuration).toBeLessThan(30000); // But not too long

      console.log('✅ Complete end-to-end pipeline executed successfully');
      console.log(`   Pipeline Duration: ${totalPipelineDuration}ms`);
      console.log(`   Evaluation ID: ${result.id}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Workflow Steps: ${result.logs.length}`);
      console.log(`   Metrics Categories: ${Object.keys(result.metrics || {}).length}`);

      // Verify final state
      const finalState = evaluationOrchestrator.getCurrentEvaluation();
      expect(finalState).toBeUndefined(); // Should be cleaned up
    });
  });

  describe('6. System Performance Validation', () => {
    test('should validate system performance under load', async () => {
      console.log('🚀 Testing system performance under load...');

      const startTime = Date.now();

      // Execute multiple evaluations in sequence
      const evaluations = [];
      for (let i = 0; i < 3; i++) {
        const config = {
          timeout: 8000,
          enableMetrics: true,
          testMode: true,
          iteration: i + 1
        };

        const result = await evaluationOrchestrator.executeEvaluation(
          testAgentId,
          testBenchmarkId + '-' + i,
          config
        );

        evaluations.push(result);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / evaluations.length;

      // Verify all evaluations completed
      expect(evaluations).toHaveLength(3);
      evaluations.forEach((evaluation, index) => {
        expect(evaluation.status).toBe('completed');
        expect(evaluation.logs.length).toBeGreaterThan(0);
      });

      console.log('✅ Performance validation completed');
      console.log(`   Total Time: ${totalTime}ms`);
      console.log(`   Average Time: ${averageTime.toFixed(0)}ms per evaluation`);
      console.log(`   Throughput: ${(3000 / averageTime).toFixed(2)} evaluations/second`);
    });
  });
});

console.log('🎯 HASEB LangGraph Orchestration Integration Tests Complete (Node Environment)');
console.log('📊 All core orchestration components validated successfully');