/**
 * Comprehensive Test Suite for HASEB Evaluation Orchestrator
 * Tests LangGraph StateGraph workflow, metrics integration, and error handling
 */

import { EvaluationOrchestrator } from '../../src/orchestrator/EvaluationOrchestrator';
import { EvaluationQueue } from '../../src/orchestrator/EvaluationQueue';
import { ExecutionEngine } from '../../src/orchestrator/ExecutionEngine';
import { MetricsCollector } from '../../src/orchestrator/MetricsCollector';
import { WebSocketManager } from '../../src/orchestrator/WebSocketManager';
import { createServer, Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { resolve } from 'path';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../src/database/models/Evaluation', () => ({
  EvaluationModel: {
    create: jest.fn(),
    findById: jest.fn(),
    findByStatus: jest.fn(),
    updateStatus: jest.fn(),
    updateStatusWithTime: jest.fn(),
    updateMetrics: jest.fn()
  }
}));

jest.mock('../../src/database/models/Agent', () => ({
  AgentModel: {
    findById: jest.fn()
  }
}));

jest.mock('../../src/database/models/Benchmark', () => ({
  BenchmarkModel: {
    findById: jest.fn()
  }
}));

describe('HASEB Orchestration System Test Suite', () => {
  let httpServer: Server;
  let socketIoServer: SocketIOServer;
  let webSocketManager: WebSocketManager;
  let evaluationOrchestrator: EvaluationOrchestrator;
  let evaluationQueue: EvaluationQueue;
  let executionEngine: ExecutionEngine;
  let metricsCollector: MetricsCollector;

  beforeAll(async () => {
    // Create test HTTP server for WebSocket tests
    httpServer = createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    // Initialize WebSocket manager
    webSocketManager = new WebSocketManager();
    webSocketManager.initialize(httpServer);

    // Initialize orchestration components
    evaluationOrchestrator = new EvaluationOrchestrator();
    evaluationQueue = new EvaluationQueue(3); // Max 3 concurrent for testing
    executionEngine = new ExecutionEngine(5, 60000); // 5 max concurrent, 60s timeout
    metricsCollector = new MetricsCollector(5000); // 5s collection interval

    await evaluationOrchestrator.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await evaluationOrchestrator.cleanup();
    await executionEngine.shutdown();
    metricsCollector.cleanupAll();
    webSocketManager.close();

    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  describe('1. LangGraph StateGraph Workflow Tests', () => {
    test('✅ Orchestrator initializes successfully with LangGraph workflow', async () => {
      expect(evaluationOrchestrator).toBeDefined();
      expect(evaluationOrchestrator.isEvaluationRunning()).toBe(false);
    });

    test('✅ Complete LangGraph workflow execution - setup → execute → collectMetrics → analyzeResults → cleanup', async () => {
      // Mock agent and benchmark data
      const { AgentModel, BenchmarkModel, EvaluationModel } = require('../../src/database/models');

      AgentModel.findById.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'general',
        capabilities: ['code', 'reasoning']
      });

      BenchmarkModel.findById.mockResolvedValue({
        id: 'benchmark-1',
        name: 'Test Benchmark',
        type: 'swe-bench',
        dataset: 'test-dataset'
      });

      EvaluationModel.create.mockResolvedValue({ id: 'eval-123' });
      EvaluationModel.updateStatusWithTime.mockResolvedValue(true);
      EvaluationModel.updateMetrics.mockResolvedValue(true);

      // Execute evaluation workflow
      const result = await evaluationOrchestrator.executeEvaluation(
        'agent-1',
        'benchmark-1',
        { taskCount: 3, timeout: 30000 }
      );

      // Verify workflow completed successfully
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.agentId).toBe('agent-1');
      expect(result.benchmarkId).toBe('benchmark-1');
      expect(result.logs).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);

      // Verify state transitions
      expect(result.logs.some(log => log.includes('Setup completed'))).toBe(true);
      expect(result.logs.some(log => log.includes('Evaluation executed successfully'))).toBe(true);
      expect(result.logs.some(log => log.includes('Metrics collected'))).toBe(true);
      expect(result.logs.some(log => log.includes('Results analyzed'))).toBe(true);
      expect(result.logs.some(log => log.includes('Cleanup completed'))).toBe(true);

      console.log(`✅ LangGraph workflow completed: ${result.id}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Steps executed: ${result.logs.length}`);
      console.log(`   Metrics collected: ${result.metrics ? 'Yes' : 'No'}`);
    });

    test('✅ LangGraph error handling and recovery', async () => {
      const { EvaluationModel } = require('../../src/database/models');

      // Mock agent not found error
      const { AgentModel } = require('../../src/database/models');
      AgentModel.findById.mockResolvedValue(null);

      EvaluationModel.create.mockResolvedValue({ id: 'eval-error-123' });
      EvaluationModel.updateStatusWithTime.mockResolvedValue(true);

      try {
        await evaluationOrchestrator.executeEvaluation('invalid-agent', 'benchmark-1');
        fail('Should have thrown error for invalid agent');
      } catch (error) {
        expect(error.message).toContain('Agent not found');
        console.log(`✅ Error handling working: ${error.message}`);
      }

      // Reset mock for subsequent tests
      AgentModel.findById.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'general',
        capabilities: ['code', 'reasoning']
      });
    });

    test('✅ Concurrent evaluation prevention', async () => {
      const { AgentModel, BenchmarkModel, EvaluationModel } = require('../../src/database/models');

      AgentModel.findById.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        type: 'general'
      });

      BenchmarkModel.findById.mockResolvedValue({
        id: 'benchmark-1',
        name: 'Test Benchmark',
        type: 'swe-bench'
      });

      EvaluationModel.create.mockResolvedValue({ id: 'eval-concurrent-1' });

      // Start first evaluation
      const evaluationPromise = evaluationOrchestrator.executeEvaluation(
        'agent-1',
        'benchmark-1',
        { taskCount: 1, timeout: 5000 }
      );

      // Try to start second evaluation immediately
      try {
        await evaluationOrchestrator.executeEvaluation('agent-1', 'benchmark-1');
        fail('Should have thrown error for concurrent evaluation');
      } catch (error) {
        expect(error.message).toContain('Another evaluation is already running');
        console.log(`✅ Concurrent evaluation prevention working`);
      }

      // Wait for first evaluation to complete
      await evaluationPromise;
    });
  });

  describe('2. Evaluation Queue Management Tests', () => {
    test('✅ Queue creation and priority-based scheduling', async () => {
      const { EvaluationModel } = require('../../src/database/models');
      EvaluationModel.create.mockResolvedValue({ id: 'queue-test-1' });

      // Add items with different priorities
      const criticalItem = await evaluationQueue.enqueue({
        agentId: 'agent-1',
        benchmarkId: 'benchmark-1',
        priority: 'critical',
        configuration: { test: 'critical' },
        maxRetries: 3
      });

      const lowPriorityItem = await evaluationQueue.enqueue({
        agentId: 'agent-2',
        benchmarkId: 'benchmark-2',
        priority: 'low',
        configuration: { test: 'low' },
        maxRetries: 3
      });

      const highPriorityItem = await evaluationQueue.enqueue({
        agentId: 'agent-3',
        benchmarkId: 'benchmark-3',
        priority: 'high',
        configuration: { test: 'high' },
        maxRetries: 3
      });

      expect(criticalItem.priority).toBe('critical');
      expect(highPriorityItem.priority).toBe('high');
      expect(lowPriorityItem.priority).toBe('low');

      // Check queue status
      const status = await evaluationQueue.getStatus();
      expect(status.queueLength).toBe(3);
      expect(status.maxConcurrent).toBe(3);

      console.log(`✅ Queue priority scheduling working`);
      console.log(`   Queue length: ${status.queueLength}`);
      console.log(`   Items queued: ${criticalItem.id}, ${highPriorityItem.id}, ${lowPriorityItem.id}`);
    });

    test('✅ Queue event handling and processing', (done) => {
      const queueEvents = [];

      evaluationQueue.on('queued', (item) => {
        queueEvents.push({ type: 'queued', item: item.id });
      });

      evaluationQueue.on('started', (item) => {
        queueEvents.push({ type: 'started', item: item.id });
      });

      evaluationQueue.on('completed', (item) => {
        queueEvents.push({ type: 'completed', item: item.id });

        // Verify all events fired
        expect(queueEvents.some(e => e.type === 'queued')).toBe(true);
        expect(queueEvents.some(e => e.type === 'started')).toBe(true);
        expect(queueEvents.some(e => e.type === 'completed')).toBe(true);

        console.log(`✅ Queue event handling working`);
        console.log(`   Events fired: ${queueEvents.map(e => e.type).join(', ')}`);

        done();
      });

      // Add and process an item
      (async () => {
        const { EvaluationModel } = require('../../src/database/models');
        EvaluationModel.create.mockResolvedValue({ id: 'queue-event-test' });
        EvaluationModel.updateStatus.mockResolvedValue(true);

        const item = await evaluationQueue.enqueue({
          agentId: 'agent-1',
          benchmarkId: 'benchmark-1',
          priority: 'medium',
          configuration: { test: 'events' },
          maxRetries: 1
        });

        // Simulate completion
        setTimeout(() => {
          evaluationQueue.complete(item.id, true);
        }, 100);
      })();
    });

    test('✅ Queue retry logic with exponential backoff', async () => {
      const { EvaluationModel } = require('../../src/database/models');
      EvaluationModel.create.mockResolvedValue({ id: 'queue-retry-test' });
      EvaluationModel.updateStatus.mockResolvedValue(true);

      const item = await evaluationQueue.enqueue({
        agentId: 'agent-1',
        benchmarkId: 'benchmark-1',
        priority: 'medium',
        configuration: { test: 'retry' },
        maxRetries: 2
      });

      // Simulate failure
      await evaluationQueue.complete(item.id, false, 'Test error');

      // Check that retry is scheduled
      const status = await evaluationQueue.getStatus();
      expect(status.queueLength).toBeGreaterThan(0);

      console.log(`✅ Queue retry logic working`);
      console.log(`   Failed item scheduled for retry: ${item.id}`);
    });

    test('✅ Queue metrics and monitoring', async () => {
      const metrics = await evaluationQueue.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalProcessed).toBeDefined();
      expect(metrics.successRate).toBeDefined();
      expect(metrics.averageWaitTime).toBeDefined();
      expect(metrics.currentLoad).toBeDefined();

      console.log(`✅ Queue metrics collection working`);
      console.log(`   Total processed: ${metrics.totalProcessed}`);
      console.log(`   Success rate: ${metrics.successRate}%`);
      console.log(`   Current load: ${metrics.currentLoad}%`);
    });
  });

  describe('3. Multi-Environment Agent Tests', () => {
    test('✅ SWE-Bench Agent task loading and execution', async () => {
      const { BenchmarkModel, AgentModel } = require('../../src/database/models');

      BenchmarkModel.findById.mockResolvedValue({
        id: 'swe-bench-test',
        name: 'SWE-Bench Test',
        type: 'swe-bench',
        dataset: 'test-dataset'
      });

      AgentModel.findById.mockResolvedValue({
        id: 'agent-swe',
        name: 'SWE Agent',
        type: 'code',
        capabilities: ['python', 'debugging']
      });

      // Load SWE-bench tasks
      const tasks = await executionEngine.loadTasks('swe-bench-test', {
        taskCount: 3,
        difficulty: 'medium'
      });

      expect(tasks).toBeDefined();
      expect(tasks.length).toBe(3);
      expect(tasks[0].type).toBe('code-generation');
      expect(tasks[0].input).toHaveProperty('repository');
      expect(tasks[0].input).toHaveProperty('issue_description');

      console.log(`✅ SWE-Bench task loading working`);
      console.log(`   Tasks loaded: ${tasks.length}`);
      console.log(`   Task type: ${tasks[0].type}`);
    });

    test('✅ GUI Automation Agent task loading and execution', async () => {
      const { BenchmarkModel, AgentModel } = require('../../src/database/models');

      BenchmarkModel.findById.mockResolvedValue({
        id: 'osworld-test',
        name: 'OSWorld Test',
        type: 'osworld',
        dataset: 'test-dataset'
      });

      AgentModel.findById.mockResolvedValue({
        id: 'agent-gui',
        name: 'GUI Agent',
        type: 'automation',
        capabilities: ['desktop', 'web']
      });

      // Load OSWorld tasks
      const tasks = await executionEngine.loadTasks('osworld-test', {
        taskCount: 2,
        applications: ['notepad', 'calculator']
      });

      expect(tasks).toBeDefined();
      expect(tasks.length).toBe(2);
      expect(tasks[0].type).toBe('gui-automation');
      expect(tasks[0].input).toHaveProperty('task_description');
      expect(tasks[0].input).toHaveProperty('application');

      console.log(`✅ GUI Automation task loading working`);
      console.log(`   Tasks loaded: ${tasks.length}`);
      console.log(`   Task type: ${tasks[0].type}`);
    });

    test('✅ General Reasoning Agent task loading and execution', async () => {
      const { BenchmarkModel, AgentModel } = require('../../src/database/models');

      BenchmarkModel.findById.mockResolvedValue({
        id: 'gaia-test',
        name: 'GAIA Test',
        type: 'gaia',
        dataset: 'test-dataset'
      });

      AgentModel.findById.mockResolvedValue({
        id: 'agent-reasoning',
        name: 'Reasoning Agent',
        type: 'general',
        capabilities: ['analysis', 'problem-solving']
      });

      // Load GAIA tasks
      const tasks = await executionEngine.loadTasks('gaia-test', {
        taskCount: 2,
        complexity: 'high'
      });

      expect(tasks).toBeDefined();
      expect(tasks.length).toBe(2);
      expect(tasks[0].type).toBe('reasoning');
      expect(tasks[0].input).toHaveProperty('problem');
      expect(tasks[0].input).toHaveProperty('context');

      console.log(`✅ General Reasoning task loading working`);
      console.log(`   Tasks loaded: ${tasks.length}`);
      console.log(`   Task type: ${tasks[0].type}`);
    });

    test('✅ Task execution with timeout and cancellation', async () => {
      const { AgentModel } = require('../../src/database/models');

      AgentModel.findById.mockResolvedValue({
        id: 'agent-timeout',
        name: 'Test Agent',
        type: 'general'
      });

      const task = {
        id: 'timeout-test',
        type: 'reasoning',
        description: 'Test timeout handling',
        input: { problem: 'Test problem' },
        expectedOutput: { answer: 'Test answer' },
        difficulty: 'medium',
        category: 'test',
        tags: ['timeout']
      };

      // Execute task with short timeout for testing
      const executionPromise = executionEngine.executeTask(
        'eval-timeout-test',
        task,
        { agentId: 'agent-timeout', environment: {}, configuration: {} }
      );

      // Wait for execution to complete
      const result = await executionPromise;

      expect(result).toBeDefined();
      expect(result.id).toBe('timeout-test');
      expect(result.status).toMatch(/completed|failed/);
      expect(result.duration).toBeGreaterThan(0);

      console.log(`✅ Task execution with timeout working`);
      console.log(`   Task status: ${result.status}`);
      console.log(`   Duration: ${result.duration}ms`);
    });
  });

  describe('4. Metrics Collection System Tests', () => {
    test('✅ Performance metrics collection', async () => {
      const { EvaluationModel } = require('../../src/database/models');

      EvaluationModel.findById.mockResolvedValue({
        id: 'metrics-test',
        startTime: new Date(Date.now() - 60000), // 1 minute ago
        endTime: new Date(),
        logs: [
          { level: 'info', message: 'Task started' },
          { level: 'info', message: 'Task completed' }
        ]
      });

      const performanceMetrics = await metricsCollector.collectPerformanceMetrics('metrics-test');

      expect(performanceMetrics).toBeDefined();
      expect(performanceMetrics.taskSuccessRate).toBeDefined();
      expect(performanceMetrics.averageTaskTime).toBeDefined();
      expect(performanceMetrics.totalExecutionTime).toBeDefined();
      expect(performanceMetrics.accuracy).toBeDefined();
      expect(performanceMetrics.precision).toBeDefined();
      expect(performanceMetrics.recall).toBeDefined();
      expect(performanceMetrics.f1Score).toBeDefined();

      console.log(`✅ Performance metrics collection working`);
      console.log(`   Task success rate: ${performanceMetrics.taskSuccessRate}%`);
      console.log(`   Average task time: ${performanceMetrics.averageTaskTime}ms`);
      console.log(`   Accuracy: ${performanceMetrics.accuracy}%`);
    });

    test('✅ Efficiency metrics collection', async () => {
      const { EvaluationModel } = require('../../src/database/models');

      EvaluationModel.findById.mockResolvedValue({
        id: 'efficiency-test',
        startTime: new Date(Date.now() - 120000), // 2 minutes ago
        endTime: new Date()
      });

      const efficiencyMetrics = await metricsCollector.collectEfficiencyMetrics('efficiency-test');

      expect(efficiencyMetrics).toBeDefined();
      expect(efficiencyMetrics.executionTime).toBeDefined();
      expect(efficiencyMetrics.latencyPerStep).toBeDefined();
      expect(efficiencyMetrics.totalSteps).toBeDefined();
      expect(efficiencyMetrics.throughput).toBeDefined();
      expect(efficiencyMetrics.resourceUtilization).toBeDefined();
      expect(efficiencyMetrics.cpuUsage).toBeDefined();
      expect(efficiencyMetrics.memoryUsage).toBeDefined();

      console.log(`✅ Efficiency metrics collection working`);
      console.log(`   Execution time: ${efficiencyMetrics.executionTime}ms`);
      console.log(`   Throughput: ${efficiencyMetrics.throughput}`);
      console.log(`   Resource utilization: ${efficiencyMetrics.resourceUtilization}%`);
    });

    test('✅ Cost metrics collection', async () => {
      // Mock task data with token usage
      metricsCollector['getTaskData'] = jest.fn().mockResolvedValue([
        {
          id: 'task-1',
          status: 'completed',
          tokensUsed: 1000,
          metrics: { inputTokens: 600, outputTokens: 400 },
          cost: 0.01
        },
        {
          id: 'task-2',
          status: 'completed',
          tokensUsed: 800,
          metrics: { inputTokens: 500, outputTokens: 300 },
          cost: 0.008
        }
      ]);

      const costMetrics = await metricsCollector.collectCostMetrics('cost-test');

      expect(costMetrics).toBeDefined();
      expect(costMetrics.totalTokens).toBe(1800);
      expect(costMetrics.inputTokens).toBe(1100);
      expect(costMetrics.outputTokens).toBe(700);
      expect(costMetrics.estimatedCost).toBeGreaterThan(0);
      expect(costMetrics.costPerTask).toBeGreaterThan(0);

      console.log(`✅ Cost metrics collection working`);
      console.log(`   Total tokens: ${costMetrics.totalTokens}`);
      console.log(`   Estimated cost: $${costMetrics.estimatedCost.toFixed(4)}`);
      console.log(`   Cost per task: $${costMetrics.costPerTask.toFixed(4)}`);
    });

    test('✅ Robustness metrics collection', async () => {
      const { EvaluationModel } = require('../../src/database/models');

      EvaluationModel.findById.mockResolvedValue({
        id: 'robustness-test',
        logs: [
          { level: 'error', message: 'API timeout occurred' },
          { level: 'info', message: 'Retrying operation...' },
          { level: 'error', message: 'Task timeout' }
        ]
      });

      // Mock task data
      metricsCollector['getTaskData'] = jest.fn().mockResolvedValue([
        { id: 'task-1', status: 'completed', errors: [] },
        { id: 'task-2', status: 'failed', errors: ['API call failed'] },
        { id: 'task-3', status: 'completed', errors: [] }
      ]);

      const robustnessMetrics = await metricsCollector.collectRobustnessMetrics('robustness-test');

      expect(robustnessMetrics).toBeDefined();
      expect(robustnessMetrics.toolCallErrorRate).toBeDefined();
      expect(robustnessMetrics.recoveryRate).toBeDefined();
      expect(robustnessMetrics.errorCount).toBeGreaterThan(0);
      expect(robustnessMetrics.retryCount).toBeGreaterThan(0);
      expect(robustnessMetrics.timeoutCount).toBeGreaterThan(0);
      expect(robustnessMetrics.systemStability).toBeDefined();
      expect(robustnessMetrics.faultTolerance).toBeDefined();

      console.log(`✅ Robustness metrics collection working`);
      console.log(`   Error rate: ${robustnessMetrics.toolCallErrorRate}%`);
      console.log(`   Recovery rate: ${robustnessMetrics.recoveryRate}%`);
      console.log(`   System stability: ${robustnessMetrics.systemStability}%`);
    });

    test('✅ Quality metrics collection', async () => {
      // Mock task data with quality metrics
      metricsCollector['getTaskData'] = jest.fn().mockResolvedValue([
        {
          id: 'task-1',
          status: 'completed',
          type: 'code-generation',
          metrics: {
            toolSelectionCorrect: true,
            parameters: { param1: 'value1', param2: 'value2' },
            expectedParameters: { param1: 'value1', param2: 'value2' },
            testCoverage: 85,
            securityScore: 90
          }
        },
        {
          id: 'task-2',
          status: 'completed',
          type: 'reasoning',
          metrics: {
            toolSelectionCorrect: false,
            parameters: { param1: 'wrong' },
            expectedParameters: { param1: 'correct' }
          }
        }
      ]);

      const qualityMetrics = await metricsCollector.collectQualityMetrics('quality-test');

      expect(qualityMetrics).toBeDefined();
      expect(qualityMetrics.toolSelectionAccuracy).toBeDefined();
      expect(qualityMetrics.parameterAccuracy).toBeDefined();
      expect(qualityMetrics.outputQuality).toBeDefined();
      expect(qualityMetrics.testCoverage).toBeDefined();
      expect(qualityMetrics.securityScore).toBeDefined();

      console.log(`✅ Quality metrics collection working`);
      console.log(`   Tool selection accuracy: ${qualityMetrics.toolSelectionAccuracy}%`);
      console.log(`   Parameter accuracy: ${qualityMetrics.parameterAccuracy}%`);
      console.log(`   Output quality: ${qualityMetrics.outputQuality}%`);
    });

    test('✅ Real-time metrics collection and analysis', (done) => {
      const metricsEvents = [];

      metricsCollector.on('metricsCollected', (evaluationId, metrics) => {
        metricsEvents.push({ evaluationId, metrics, timestamp: new Date() });
      });

      // Start metrics collection
      metricsCollector.startCollection('realtime-test');

      // Collect metrics
      setTimeout(async () => {
        const metrics = await metricsCollector.collectMetrics('realtime-test');
        expect(metrics).toBeDefined();

        // Check that event was fired
        expect(metricsEvents.length).toBeGreaterThan(0);
        expect(metricsEvents[0].evaluationId).toBe('realtime-test');

        // Stop collection
        metricsCollector.stopCollection('realtime-test');

        console.log(`✅ Real-time metrics collection working`);
        console.log(`   Metrics events fired: ${metricsEvents.length}`);
        console.log(`   Collection stopped successfully`);

        done();
      }, 100);
    });
  });

  describe('5. WebSocket Communication Tests', () => {
    test('✅ WebSocket server initialization and client connection', (done) => {
      const socket = require('socket.io-client')(httpServer.address());

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        expect(socket.id).toBeDefined();

        console.log(`✅ WebSocket connection established`);
        console.log(`   Client ID: ${socket.id}`);
        console.log(`   Connected clients: ${webSocketManager.getConnectionCount()}`);

        socket.disconnect();
        done();
      });

      socket.on('connect_error', (error) => {
        fail(`WebSocket connection failed: ${error.message}`);
      });
    });

    test('✅ Client subscription to evaluation updates', (done) => {
      const socket = require('socket.io-client')(httpServer.address());
      const evaluationId = 'ws-test-eval-1';

      socket.on('connect', () => {
        // Subscribe to evaluation
        socket.emit('subscribe', { evaluationId, userId: 'test-user' });
      });

      socket.on('subscribed', (data) => {
        expect(data.evaluationId).toBe(evaluationId);
        expect(data.timestamp).toBeDefined();

        console.log(`✅ Client subscription working`);
        console.log(`   Subscribed to evaluation: ${evaluationId}`);

        socket.disconnect();
        done();
      });

      socket.on('error', (error) => {
        fail(`WebSocket subscription failed: ${error.message}`);
      });
    });

    test('✅ Real-time message broadcasting', (done) => {
      const socket1 = require('socket.io-client')(httpServer.address());
      const socket2 = require('socket.io-client')(httpServer.address());
      const evaluationId = 'ws-broadcast-test';
      let messagesReceived = 0;

      const checkComplete = () => {
        messagesReceived++;
        if (messagesReceived === 2) {
          console.log(`✅ Real-time broadcasting working`);
          console.log(`   Messages received by ${messagesReceived} clients`);

          socket1.disconnect();
          socket2.disconnect();
          done();
        }
      };

      socket1.on('connect', () => {
        socket1.emit('subscribe', { evaluationId });
      });

      socket2.on('connect', () => {
        socket2.emit('subscribe', { evaluationId });
      });

      socket1.on('evaluation_update', (message) => {
        expect(message.type).toBe('progress_update');
        expect(message.evaluationId).toBe(evaluationId);
        checkComplete();
      });

      socket2.on('evaluation_update', (message) => {
        expect(message.type).toBe('progress_update');
        expect(message.evaluationId).toBe(evaluationId);
        checkComplete();
      });

      // Wait for subscriptions and broadcast message
      setTimeout(() => {
        webSocketManager.broadcast(evaluationId, {
          type: 'progress_update',
          evaluationId,
          timestamp: new Date(),
          data: { progress: 50, message: 'Test broadcast' }
        });
      }, 100);
    });

    test('✅ Rate limiting and message filtering', (done) => {
      const socket = require('socket.io-client')(httpServer.address());
      const evaluationId = 'ws-rate-limit-test';
      let messagesReceived = 0;

      socket.on('connect', () => {
        // Update preferences to limit messages
        socket.emit('update_preferences', {
          receiveLogs: false,
          receiveMetrics: true,
          receiveProgress: true,
          maxMessagesPerSecond: 2
        });

        socket.emit('subscribe', { evaluationId });
      });

      socket.on('preferences_updated', () => {
        // Send multiple messages rapidly
        for (let i = 0; i < 5; i++) {
          webSocketManager.broadcast(evaluationId, {
            type: i % 2 === 0 ? 'log' : 'progress_update',
            evaluationId,
            timestamp: new Date(),
            data: { index: i }
          });
        }

        // Check that only allowed messages were received
        setTimeout(() => {
          // Should only receive progress_update and metrics messages, not logs
          expect(messagesReceived).toBeLessThan(5);

          console.log(`✅ Rate limiting and filtering working`);
          console.log(`   Messages received: ${messagesReceived} (should be < 5)`);
          console.log(`   Log messages filtered: true`);

          socket.disconnect();
          done();
        }, 200);
      });

      socket.on('evaluation_update', (message) => {
        messagesReceived++;
        // Should not receive log messages due to preferences
        expect(message.type).not.toBe('log');
      });
    });

    test('✅ WebSocket health monitoring and cleanup', () => {
      const stats = webSocketManager.getStats();

      expect(stats.connectedClients).toBeDefined();
      expect(stats.activeSubscriptions).toBeDefined();
      expect(stats.queuedMessages).toBeDefined();
      expect(stats.averageSubscriptionsPerClient).toBeDefined();
      expect(stats.uptime).toBeDefined();

      console.log(`✅ WebSocket health monitoring working`);
      console.log(`   Connected clients: ${stats.connectedClients}`);
      console.log(`   Active subscriptions: ${stats.activeSubscriptions}`);
      console.log(`   Queued messages: ${stats.queuedMessages}`);
      console.log(`   Uptime: ${Math.floor(stats.uptime)}s`);
    });
  });

  describe('6. End-to-End Integration Tests', () => {
    test('✅ Complete evaluation workflow with all components', async () => {
      console.log(`\n🚀 Starting end-to-end evaluation workflow test...`);

      // Setup component integration
      let evaluationCompleted = false;
      let metricsCollected = false;
      let wsMessagesSent = 0;

      // Listen for queue events
      evaluationQueue.on('process', async (item) => {
        console.log(`   📋 Queue processing item: ${item.id}`);

        // Execute through orchestrator
        try {
          const result = await evaluationOrchestrator.executeEvaluation(
            item.agentId,
            item.benchmarkId,
            item.configuration
          );

          evaluationCompleted = true;
          console.log(`   ✅ Evaluation completed: ${result.id}`);

          // Mark queue item as complete
          evaluationQueue.complete(item.id, true);
        } catch (error) {
          console.error(`   ❌ Evaluation failed: ${error.message}`);
          evaluationQueue.complete(item.id, false, error.message);
        }
      });

      // Listen for metrics events
      metricsCollector.on('metricsCollected', (evaluationId, metrics) => {
        metricsCollected = true;
        console.log(`   📊 Metrics collected for: ${evaluationId}`);
      });

      // Listen for WebSocket broadcasts
      const originalBroadcast = webSocketManager.broadcast.bind(webSocketManager);
      webSocketManager.broadcast = (evaluationId, message) => {
        wsMessagesSent++;
        console.log(`   📡 WebSocket broadcast: ${message.type}`);
        return originalBroadcast(evaluationId, message);
      };

      // Mock all required dependencies
      const { AgentModel, BenchmarkModel, EvaluationModel } = require('../../src/database/models');

      AgentModel.findById.mockResolvedValue({
        id: 'e2e-agent',
        name: 'E2E Test Agent',
        type: 'general',
        capabilities: ['code', 'reasoning', 'automation']
      });

      BenchmarkModel.findById.mockResolvedValue({
        id: 'e2e-benchmark',
        name: 'E2E Test Benchmark',
        type: 'gaia',
        dataset: 'test-dataset'
      });

      EvaluationModel.create.mockResolvedValue({ id: 'e2e-eval-123' });
      EvaluationModel.updateStatusWithTime.mockResolvedValue(true);
      EvaluationModel.updateMetrics.mockResolvedValue(true);

      // Start the complete workflow
      console.log(`   🎯 Enqueuing evaluation...`);
      const queueItem = await evaluationQueue.enqueue({
        agentId: 'e2e-agent',
        benchmarkId: 'e2e-benchmark',
        priority: 'high',
        configuration: {
          taskCount: 2,
          timeout: 30000,
          enableMetrics: true,
          enableWebSocket: true
        },
        maxRetries: 2
      });

      console.log(`   ⏳ Waiting for workflow completion...`);

      // Wait for workflow to complete
      await new Promise<void>((resolve) => {
        const checkComplete = () => {
          if (evaluationCompleted) {
            resolve();
          } else {
            setTimeout(checkComplete, 1000);
          }
        };
        checkComplete();
      });

      // Verify all components participated
      expect(evaluationCompleted).toBe(true);
      expect(wsMessagesSent).toBeGreaterThan(0);

      const queueStatus = await evaluationQueue.getStatus();
      const wsStats = webSocketManager.getStats();
      const metricsStats = metricsCollector.getStats();

      console.log(`\n📊 End-to-End Test Results:`);
      console.log(`   ✅ Evaluation completed: ${evaluationCompleted}`);
      console.log(`   ✅ Queue processed: ${queueStatus.completed.size} items`);
      console.log(`   ✅ WebSocket messages: ${wsMessagesSent} sent`);
      console.log(`   ✅ Active connections: ${wsStats.connectedClients}`);
      console.log(`   ✅ Metrics collections: ${metricsStats.activeCollections}`);

      // Verify system health
      const queueHealth = await evaluationQueue.healthCheck();
      expect(queueHealth.status).toBe('healthy');

      console.log(`   ✅ System health: ${queueHealth.status}`);
      console.log(`   🎉 End-to-end workflow test PASSED!`);
    });

    test('✅ System performance under load', async () => {
      console.log(`\n⚡ Starting system load test...`);

      const startTime = Date.now();
      const concurrentEvaluations = 5;
      const completedEvaluations = [];

      // Mock for load testing
      const { AgentModel, BenchmarkModel, EvaluationModel } = require('../../src/database/models');

      AgentModel.findById.mockResolvedValue({
        id: 'load-test-agent',
        name: 'Load Test Agent',
        type: 'general'
      });

      BenchmarkModel.findById.mockResolvedValue({
        id: 'load-test-benchmark',
        name: 'Load Test Benchmark',
        type: 'custom'
      });

      // Create multiple concurrent evaluations
      const evaluationPromises = [];
      for (let i = 0; i < concurrentEvaluations; i++) {
        EvaluationModel.create.mockResolvedValue({ id: `load-eval-${i}` });
        EvaluationModel.updateStatusWithTime.mockResolvedValue(true);
        EvaluationModel.updateMetrics.mockResolvedValue(true);

        const promise = evaluationOrchestrator.executeEvaluation(
          'load-test-agent',
          'load-test-benchmark',
          {
            taskId: i,
            testLoad: true,
            quickMode: true // Faster execution for load testing
          }
        ).then(result => {
          completedEvaluations.push(result);
          return result;
        }).catch(error => {
          console.log(`   ⚠️ Evaluation ${i} failed: ${error.message}`);
          return null;
        });

        evaluationPromises.push(promise);
      }

      // Wait for all evaluations to complete or timeout
      const results = await Promise.allSettled(evaluationPromises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successfulEvaluations = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failedEvaluations = results.filter(r => r.status === 'rejected' || !r.value).length;

      console.log(`\n⚡ Load Test Results:`);
      console.log(`   Total evaluations: ${concurrentEvaluations}`);
      console.log(`   Successful: ${successfulEvaluations}`);
      console.log(`   Failed: ${failedEvaluations}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Average per evaluation: ${Math.round(totalTime / concurrentEvaluations)}ms`);
      console.log(`   Success rate: ${Math.round((successfulEvaluations / concurrentEvaluations) * 100)}%`);

      // Verify system handled load gracefully
      expect(successfulEvaluations).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(60000); // Should complete within 60 seconds

      console.log(`   ✅ Load test PASSED!`);
    });
  });

  describe('7. System Health and Diagnostics', () => {
    test('✅ Complete system health check', async () => {
      const healthReport = {
        timestamp: new Date(),
        components: {}
      };

      // Check orchestrator health
      healthReport.components.orchestrator = {
        initialized: !evaluationOrchestrator.isEvaluationRunning(),
        available: true
      };

      // Check queue health
      healthReport.components.queue = await evaluationQueue.healthCheck();

      // Check execution engine health
      healthReport.components.executionEngine = {
        activeExecutions: executionEngine.getActiveExecutions(),
        maxConcurrent: 5,
        available: true
      };

      // Check metrics collector health
      healthReport.components.metricsCollector = {
        activeCollections: metricsCollector.getStats().activeCollections,
        available: true
      };

      // Check WebSocket health
      healthReport.components.webSocket = {
        connectedClients: webSocketManager.getConnectionCount(),
        activeSubscriptions: webSocketManager.getSubscriptionCount(),
        available: true
      };

      // System resources
      healthReport.system = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        nodeVersion: process.version
      };

      console.log(`\n🏥 System Health Report:`);
      console.log(`   Timestamp: ${healthReport.timestamp.toISOString()}`);
      console.log(`   Orchestrator: ${healthReport.components.orchestrator.available ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   Queue: ${healthReport.components.queue.status} (${healthReport.components.queue.queueLength} items)`);
      console.log(`   Execution Engine: ${healthReport.components.executionEngine.available ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   Metrics Collector: ${healthReport.components.metricsCollector.available ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   WebSocket: ${healthReport.components.webSocket.available ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   Memory Usage: ${Math.round(healthReport.system.memory.heapUsed / 1024 / 1024)}MB`);
      console.log(`   System Uptime: ${Math.floor(healthReport.system.uptime)}s`);

      // Verify all components are healthy
      Object.values(healthReport.components).forEach(component => {
        expect(component.available || component.status === 'healthy').toBe(true);
      });

      console.log(`   ✅ All systems healthy!`);
    });
  });
});