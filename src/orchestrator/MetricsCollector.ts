import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { TaskState } from '../types/orchestrator';
import { EvaluationMetrics } from '../types/index';
import { EvaluationModel } from '../database/models/Evaluation';
import { v4 as uuidv4 } from 'uuid';

interface MetricsCollection {
  evaluationId: string;
  timestamp: Date;
  performance: PerformanceMetrics;
  efficiency: EfficiencyMetrics;
  cost: CostMetrics;
  robustness: RobustnessMetrics;
  quality: QualityMetrics;
  system: SystemMetrics;
}

interface PerformanceMetrics {
  taskSuccessRate: number;
  averageTaskTime: number;
  totalExecutionTime: number;
  tasksCompleted: number;
  tasksTotal: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

interface EfficiencyMetrics {
  executionTime: number;
  latencyPerStep: number;
  totalSteps: number;
  throughput: number;
  resourceUtilization: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: number;
}

interface CostMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  costPerTask: number;
  costPerSuccess: number;
  costPerToken: number;
}

interface RobustnessMetrics {
  toolCallErrorRate: number;
  recoveryRate: number;
  errorCount: number;
  retryCount: number;
  timeoutCount: number;
  systemStability: number;
  faultTolerance: number;
}

interface QualityMetrics {
  toolSelectionAccuracy: number;
  parameterAccuracy: number;
  outputQuality: number;
  codeQuality?: number;
  documentationQuality?: number;
  testCoverage?: number;
  securityScore?: number;
  maintainability?: number;
}

interface SystemMetrics {
  evaluationId: string;
  environmentId?: string;
  containerStats?: any;
  processStats: any;
  networkStats: any;
  diskStats: any;
  timestamp: Date;
}

export class MetricsCollector extends EventEmitter {
  private collections: Map<string, MetricsCollection[]>;
  private timers: Map<string, NodeJS.Timeout>;
  private collectionInterval: number;

  constructor(collectionInterval: number = 10000) {
    super();
    this.collections = new Map();
    this.timers = new Map();
    this.collectionInterval = collectionInterval;
  }

  async collectMetrics(evaluationId: string): Promise<Partial<EvaluationMetrics>> {
    try {
      const existingCollection = this.collections.get(evaluationId);
      const collection: MetricsCollection = {
        evaluationId,
        timestamp: new Date(),
        performance: await this.collectPerformanceMetrics(evaluationId),
        efficiency: await this.collectEfficiencyMetrics(evaluationId),
        cost: await this.collectCostMetrics(evaluationId),
        robustness: await this.collectRobustnessMetrics(evaluationId),
        quality: await this.collectQualityMetrics(evaluationId),
        system: await this.collectSystemMetrics(evaluationId)
      };

      // Store collection
      if (!existingCollection) {
        this.collections.set(evaluationId, []);
      }
      this.collections.get(evaluationId)!.push(collection);

      // Keep only last 100 collections
      const collections = this.collections.get(evaluationId)!;
      if (collections.length > 100) {
        collections.splice(0, collections.length - 100);
      }

      // Combine all metrics into final format
      const combinedMetrics: Partial<EvaluationMetrics> = {
        ...collection.performance,
        ...collection.efficiency,
        ...collection.cost,
        ...collection.robustness,
        ...collection.quality
      };

      this.emit('metricsCollected', evaluationId, combinedMetrics);
      return combinedMetrics;

    } catch (error) {
      logger.error(`Failed to collect metrics for evaluation ${evaluationId}:`, error);
      return {};
    }
  }

  async collectPerformanceMetrics(evaluationId: string): Promise<PerformanceMetrics> {
    try {
      const evaluation = await EvaluationModel.findById(evaluationId);
      if (!evaluation) {
        throw new Error(`Evaluation ${evaluationId} not found`);
      }

      // Get task data from database or logs
      const tasks = await this.getTaskData(evaluationId);
      const completedTasks = tasks.filter(task => task.status === 'completed');
      const totalTasks = tasks.length;

      // Calculate success rate
      const taskSuccessRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

      // Calculate average task time
      const taskTimes = completedTasks
        .filter(task => task.duration)
        .map(task => task.duration!);
      const averageTaskTime = taskTimes.length > 0
        ? taskTimes.reduce((sum, time) => sum + time, 0) / taskTimes.length
        : 0;

      // Calculate total execution time
      const totalExecutionTime = evaluation.startTime && evaluation.endTime
        ? new Date(evaluation.endTime).getTime() - new Date(evaluation.startTime).getTime()
        : 0;

      // Calculate accuracy metrics (placeholder implementation)
      const accuracy = await this.calculateAccuracy(completedTasks);
      const precision = await this.calculatePrecision(completedTasks);
      const recall = await this.calculateRecall(completedTasks);
      const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      return {
        taskSuccessRate,
        averageTaskTime,
        totalExecutionTime,
        tasksCompleted: completedTasks.length,
        tasksTotal: totalTasks,
        accuracy,
        precision,
        recall,
        f1Score
      };

    } catch (error) {
      logger.error(`Failed to collect performance metrics for evaluation ${evaluationId}:`, error);
      return {
        taskSuccessRate: 0,
        averageTaskTime: 0,
        totalExecutionTime: 0,
        tasksCompleted: 0,
        tasksTotal: 0,
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };
    }
  }

  async collectEfficiencyMetrics(evaluationId: string): Promise<EfficiencyMetrics> {
    try {
      const evaluation = await EvaluationModel.findById(evaluationId);
      if (!evaluation) {
        throw new Error(`Evaluation ${evaluationId} not found`);
      }

      const tasks = await this.getTaskData(evaluationId);
      const totalExecutionTime = evaluation.startTime && evaluation.endTime
        ? new Date(evaluation.endTime).getTime() - new Date(evaluation.startTime).getTime()
        : 0;

      // Calculate efficiency metrics
      const totalSteps = tasks.reduce((sum, task) => sum + (task.metrics?.stepCount || 1), 0);
      const latencyPerStep = totalSteps > 0 ? totalExecutionTime / totalSteps : 0;
      const throughput = totalExecutionTime > 0 ? (tasks.length * 1000) / totalExecutionTime : 0;

      // Get system resource usage
      const systemMetrics = await this.getSystemResourceUsage(evaluationId);
      const cpuUsage = systemMetrics.cpuUsage || 0;
      const memoryUsage = systemMetrics.memoryUsage || 0;
      const diskUsage = systemMetrics.diskUsage || 0;
      const networkIO = systemMetrics.networkIO || 0;

      // Calculate resource utilization (0-100%)
      const resourceUtilization = (cpuUsage + memoryUsage) / 2;

      return {
        executionTime: totalExecutionTime,
        latencyPerStep,
        totalSteps,
        throughput,
        resourceUtilization,
        cpuUsage,
        memoryUsage,
        diskUsage,
        networkIO
      };

    } catch (error) {
      logger.error(`Failed to collect efficiency metrics for evaluation ${evaluationId}:`, error);
      return {
        executionTime: 0,
        latencyPerStep: 0,
        totalSteps: 0,
        throughput: 0,
        resourceUtilization: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: 0
      };
    }
  }

  async collectCostMetrics(evaluationId: string): Promise<CostMetrics> {
    try {
      const tasks = await this.getTaskData(evaluationId);

      // Calculate token usage
      const totalTokens = tasks.reduce((sum, task) => sum + (task.tokensUsed || 0), 0);
      const inputTokens = tasks.reduce((sum, task) => sum + (task.metrics?.inputTokens || 0), 0);
      const outputTokens = tasks.reduce((sum, task) => sum + (task.metrics?.outputTokens || 0), 0);

      // Calculate estimated cost (using OpenAI pricing as reference)
      const inputCostPerToken = 0.000001; // $0.001 per 1K tokens
      const outputCostPerToken = 0.000002; // $0.002 per 1K tokens
      const estimatedCost = (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);

      const completedTasks = tasks.filter(task => task.status === 'completed');
      const successfulTasks = completedTasks.filter(task => !task.errors || task.errors.length === 0);

      const costPerTask = tasks.length > 0 ? estimatedCost / tasks.length : 0;
      const costPerSuccess = successfulTasks.length > 0 ? estimatedCost / successfulTasks.length : 0;
      const costPerToken = totalTokens > 0 ? estimatedCost / totalTokens : 0;

      return {
        totalTokens,
        inputTokens,
        outputTokens,
        estimatedCost,
        costPerTask,
        costPerSuccess,
        costPerToken
      };

    } catch (error) {
      logger.error(`Failed to collect cost metrics for evaluation ${evaluationId}:`, error);
      return {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        costPerTask: 0,
        costPerSuccess: 0,
        costPerToken: 0
      };
    }
  }

  async collectRobustnessMetrics(evaluationId: string): Promise<RobustnessMetrics> {
    try {
      const evaluation = await EvaluationModel.findById(evaluationId);
      if (!evaluation) {
        throw new Error(`Evaluation ${evaluationId} not found`);
      }

      const tasks = await this.getTaskData(evaluationId);
      const logs = evaluation.logs || [];

      // Count errors and retries
      const totalErrors = tasks.reduce((sum, task) => sum + (task.errors?.length || 0), 0);
      const logErrors = logs.filter(log => log.level === 'error').length;
      const errorCount = totalErrors + logErrors;

      // Count retries
      const retryCount = logs.filter(log =>
        log.message.includes('retry') || log.message.includes('Retry')
      ).length;

      // Count timeouts
      const timeoutCount = logs.filter(log =>
        log.message.includes('timeout') || log.message.includes('Timeout')
      ).length;

      const totalTasks = tasks.length;
      const successfulTasks = tasks.filter(task => task.status === 'completed' && (!task.errors || task.errors.length === 0));
      const failedTasks = tasks.filter(task => task.status === 'failed');

      // Calculate robustness metrics
      const toolCallErrorRate = totalTasks > 0 ? (failedTasks.length / totalTasks) * 100 : 0;
      const recoveryRate = failedTasks.length > 0
        ? (successfulTasks.length / (failedTasks.length + successfulTasks.length)) * 100
        : 100;

      // Calculate system stability (inverse of error rate)
      const systemStability = 100 - Math.min(toolCallErrorRate, 100);

      // Calculate fault tolerance (based on recovery success)
      const faultTolerance = recoveryRate;

      return {
        toolCallErrorRate,
        recoveryRate,
        errorCount,
        retryCount,
        timeoutCount,
        systemStability,
        faultTolerance
      };

    } catch (error) {
      logger.error(`Failed to collect robustness metrics for evaluation ${evaluationId}:`, error);
      return {
        toolCallErrorRate: 100,
        recoveryRate: 0,
        errorCount: 0,
        retryCount: 0,
        timeoutCount: 0,
        systemStability: 0,
        faultTolerance: 0
      };
    }
  }

  async collectQualityMetrics(evaluationId: string): Promise<QualityMetrics> {
    try {
      const tasks = await this.getTaskData(evaluationId);

      // Calculate tool selection accuracy
      const toolSelectionAccuracy = await this.calculateToolSelectionAccuracy(tasks);

      // Calculate parameter accuracy
      const parameterAccuracy = await this.calculateParameterAccuracy(tasks);

      // Calculate output quality
      const outputQuality = await this.calculateOutputQuality(tasks);

      // Code-specific quality metrics (if applicable)
      const codeQuality = await this.calculateCodeQuality(tasks);
      const documentationQuality = await this.calculateDocumentationQuality(tasks);
      const testCoverage = await this.calculateTestCoverage(tasks);
      const securityScore = await this.calculateSecurityScore(tasks);
      const maintainability = await this.calculateMaintainability(tasks);

      return {
        toolSelectionAccuracy,
        parameterAccuracy,
        outputQuality,
        codeQuality,
        documentationQuality,
        testCoverage,
        securityScore,
        maintainability
      };

    } catch (error) {
      logger.error(`Failed to collect quality metrics for evaluation ${evaluationId}:`, error);
      return {
        toolSelectionAccuracy: 0,
        parameterAccuracy: 0,
        outputQuality: 0,
        codeQuality: 0,
        documentationQuality: 0,
        testCoverage: 0,
        securityScore: 0,
        maintainability: 0
      };
    }
  }

  async collectSystemMetrics(evaluationId: string): Promise<SystemMetrics> {
    try {
      const processStats = this.getProcessStats();
      const networkStats = await this.getNetworkStats();
      const diskStats = await this.getDiskStats();

      return {
        evaluationId,
        containerStats: await this.getContainerStats(evaluationId),
        processStats,
        networkStats,
        diskStats,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`Failed to collect system metrics for evaluation ${evaluationId}:`, error);
      return {
        evaluationId,
        processStats: {},
        networkStats: {},
        diskStats: {},
        timestamp: new Date()
      };
    }
  }

  async analyzeResults(evaluationId: string, data: {
    tasks: TaskState[];
    metrics: any;
    configuration: any;
  }): Promise<any> {
    try {
      const analysis = {
        summary: await this.generateSummary(evaluationId, data),
        insights: await this.generateInsights(evaluationId, data),
        recommendations: await this.generateRecommendations(evaluationId, data),
        comparison: await this.generateComparison(evaluationId, data),
        trends: await this.generateTrends(evaluationId, data)
      };

      this.emit('analysisCompleted', evaluationId, analysis);
      return analysis;

    } catch (error) {
      logger.error(`Failed to analyze results for evaluation ${evaluationId}:`, error);
      return {};
    }
  }

  private async getTaskData(evaluationId: string): Promise<TaskState[]> {
    try {
      // This would typically query the tasks table
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      logger.error(`Failed to get task data for evaluation ${evaluationId}:`, error);
      return [];
    }
  }

  private async calculateAccuracy(tasks: TaskState[]): Promise<number> {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    if (completedTasks.length === 0) return 0;

    const accurateTasks = completedTasks.filter(task => {
      // Compare actual output with expected output
      return this.compareOutputs(task.actualOutput, task.expectedOutput);
    });

    return (accurateTasks.length / completedTasks.length) * 100;
  }

  private async calculatePrecision(tasks: TaskState[]): Promise<number> {
    // Precision calculation based on relevant outputs vs total outputs
    const completedTasks = tasks.filter(task => task.status === 'completed');
    if (completedTasks.length === 0) return 0;

    let totalPrecision = 0;
    for (const task of completedTasks) {
      // Calculate precision for individual task
      const taskPrecision = this.calculateTaskPrecision(task);
      totalPrecision += taskPrecision;
    }

    return totalPrecision / completedTasks.length;
  }

  private async calculateRecall(tasks: TaskState[]): Promise<number> {
    // Recall calculation based on found relevant items vs total relevant items
    const completedTasks = tasks.filter(task => task.status === 'completed');
    if (completedTasks.length === 0) return 0;

    let totalRecall = 0;
    for (const task of completedTasks) {
      // Calculate recall for individual task
      const taskRecall = this.calculateTaskRecall(task);
      totalRecall += taskRecall;
    }

    return totalRecall / completedTasks.length;
  }

  private async calculateToolSelectionAccuracy(tasks: TaskState[]): Promise<number> {
    // Calculate how accurately tools were selected for tasks
    const completedTasks = tasks.filter(task => task.status === 'completed' && task.metrics?.selectedTool);
    if (completedTasks.length === 0) return 0;

    const accurateToolSelections = completedTasks.filter(task => {
      return task.metrics!.toolSelectionCorrect;
    });

    return (accurateToolSelections.length / completedTasks.length) * 100;
  }

  private async calculateParameterAccuracy(tasks: TaskState[]): Promise<number> {
    // Calculate accuracy of parameters used in tool calls
    const completedTasks = tasks.filter(task => task.status === 'completed' && task.metrics?.parameters);
    if (completedTasks.length === 0) return 0;

    let totalParameterAccuracy = 0;
    for (const task of completedTasks) {
      const parameters = task.metrics!.parameters;
      const expectedParameters = task.metrics?.expectedParameters || {};

      const accurateParams = Object.keys(parameters).filter(key => {
        return parameters[key] === expectedParameters[key];
      });

      const paramAccuracy = Object.keys(parameters).length > 0
        ? (accurateParams.length / Object.keys(parameters).length) * 100
        : 0;

      totalParameterAccuracy += paramAccuracy;
    }

    return totalParameterAccuracy / completedTasks.length;
  }

  private async calculateOutputQuality(tasks: TaskState[]): Promise<number> {
    // Calculate overall output quality
    const completedTasks = tasks.filter(task => task.status === 'completed');
    if (completedTasks.length === 0) return 0;

    let totalQuality = 0;
    for (const task of completedTasks) {
      const quality = this.assessOutputQuality(task.actualOutput, task.expectedOutput);
      totalQuality += quality;
    }

    return totalQuality / completedTasks.length;
  }

  private async calculateCodeQuality(tasks: TaskState[]): Promise<number> {
    // Calculate code quality for code generation tasks
    const codeTasks = tasks.filter(task =>
      task.status === 'completed' &&
      (task.type.includes('code') || task.type.includes('programming'))
    );

    if (codeTasks.length === 0) return 0;

    let totalCodeQuality = 0;
    for (const task of codeTasks) {
      const codeQuality = this.assessCodeQuality(task.actualOutput);
      totalCodeQuality += codeQuality;
    }

    return totalCodeQuality / codeTasks.length;
  }

  private async calculateDocumentationQuality(tasks: TaskState[]): Promise<number> {
    // Calculate documentation quality
    const docTasks = tasks.filter(task =>
      task.status === 'completed' &&
      (task.type.includes('documentation') || task.type.includes('docs'))
    );

    if (docTasks.length === 0) return 0;

    let totalDocQuality = 0;
    for (const task of docTasks) {
      const docQuality = this.assessDocumentationQuality(task.actualOutput);
      totalDocQuality += docQuality;
    }

    return totalDocQuality / docTasks.length;
  }

  private async calculateTestCoverage(tasks: TaskState[]): Promise<number> {
    // Calculate test coverage for code generation tasks
    const codeTasks = tasks.filter(task =>
      task.status === 'completed' &&
      task.type.includes('code') &&
      task.metrics?.testsGenerated
    );

    if (codeTasks.length === 0) return 0;

    let totalCoverage = 0;
    for (const task of codeTasks) {
      const coverage = task.metrics!.testCoverage || 0;
      totalCoverage += coverage;
    }

    return totalCoverage / codeTasks.length;
  }

  private async calculateSecurityScore(tasks: TaskState[]): Promise<number> {
    // Calculate security score for generated code
    const codeTasks = tasks.filter(task =>
      task.status === 'completed' &&
      task.type.includes('code')
    );

    if (codeTasks.length === 0) return 0;

    let totalSecurityScore = 0;
    for (const task of codeTasks) {
      const securityScore = this.assessSecurity(task.actualOutput);
      totalSecurityScore += securityScore;
    }

    return totalSecurityScore / codeTasks.length;
  }

  private async calculateMaintainability(tasks: TaskState[]): Promise<number> {
    // Calculate maintainability score for generated code
    const codeTasks = tasks.filter(task =>
      task.status === 'completed' &&
      task.type.includes('code')
    );

    if (codeTasks.length === 0) return 0;

    let totalMaintainability = 0;
    for (const task of codeTasks) {
      const maintainability = this.assessMaintainability(task.actualOutput);
      totalMaintainability += maintainability;
    }

    return totalMaintainability / codeTasks.length;
  }

  // Helper methods for quality assessment
  private compareOutputs(actual: any, expected: any): boolean {
    if (!actual || !expected) return false;
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  private calculateTaskPrecision(task: TaskState): number {
    // Placeholder implementation
    return task.metrics?.precision || 0;
  }

  private calculateTaskRecall(task: TaskState): number {
    // Placeholder implementation
    return task.metrics?.recall || 0;
  }

  private assessOutputQuality(actual: any, expected: any): number {
    // Placeholder implementation - would use NLP or other metrics
    return Math.random() * 100;
  }

  private assessCodeQuality(code: any): number {
    // Placeholder implementation - would use code analysis tools
    return Math.random() * 100;
  }

  private assessDocumentationQuality(docs: any): number {
    // Placeholder implementation
    return Math.random() * 100;
  }

  private assessSecurity(code: any): number {
    // Placeholder implementation - would use security analysis tools
    return Math.random() * 100;
  }

  private assessMaintainability(code: any): number {
    // Placeholder implementation - would use code analysis metrics
    return Math.random() * 100;
  }

  private getProcessStats(): any {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  private async getNetworkStats(): Promise<any> {
    // Placeholder implementation
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0
    };
  }

  private async getDiskStats(): Promise<any> {
    // Placeholder implementation
    return {
      totalSpace: 0,
      freeSpace: 0,
      usedSpace: 0
    };
  }

  private async getContainerStats(evaluationId: string): Promise<any> {
    // Placeholder implementation for Docker container stats
    return {};
  }

  private async getSystemResourceUsage(evaluationId: string): Promise<any> {
    // Placeholder implementation
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkIO: Math.random() * 1000
    };
  }

  private async generateSummary(evaluationId: string, data: any): Promise<any> {
    // Generate summary of evaluation results
    return {
      overallScore: Math.random() * 100,
      keyMetrics: {
        successRate: data.metrics.taskSuccessRate || 0,
        efficiency: data.metrics.executionTime || 0,
        cost: data.metrics.estimatedCost || 0
      }
    };
  }

  private async generateInsights(evaluationId: string, data: any): Promise<string[]> {
    // Generate insights from evaluation data
    return [
      "Task completion rate is above average",
      "Response times are within acceptable ranges",
      "Cost efficiency could be improved"
    ];
  }

  private async generateRecommendations(evaluationId: string, data: any): Promise<string[]> {
    // Generate recommendations for improvement
    return [
      "Consider optimizing tool selection for better accuracy",
      "Review error handling mechanisms",
      "Implement caching for improved performance"
    ];
  }

  private async generateComparison(evaluationId: string, data: any): Promise<any> {
    // Generate comparison with previous evaluations or benchmarks
    return {
      compareToPrevious: {
        successRate: Math.random() * 20 - 10, // +/- 10%
        efficiency: Math.random() * 20 - 10,
        cost: Math.random() * 20 - 10
      },
      compareToBenchmark: {
        successRate: Math.random() * 100,
        efficiency: Math.random() * 100,
        cost: Math.random() * 100
      }
    };
  }

  private async generateTrends(evaluationId: string, data: any): Promise<any> {
    // Generate trend analysis
    return {
      performanceTrend: 'improving',
      costTrend: 'stable',
      qualityTrend: 'improving'
    };
  }

  startCollection(evaluationId: string): void {
    if (this.timers.has(evaluationId)) {
      return; // Already collecting
    }

    const timer = setInterval(async () => {
      try {
        await this.collectMetrics(evaluationId);
      } catch (error) {
        logger.error(`Error in metrics collection for ${evaluationId}:`, error);
      }
    }, this.collectionInterval);

    this.timers.set(evaluationId, timer);
    logger.info(`Started metrics collection for evaluation ${evaluationId}`);
  }

  stopCollection(evaluationId: string): void {
    const timer = this.timers.get(evaluationId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(evaluationId);
      logger.info(`Stopped metrics collection for evaluation ${evaluationId}`);
    }
  }

  getMetricsHistory(evaluationId: string): MetricsCollection[] {
    return this.collections.get(evaluationId) || [];
  }

  async exportMetrics(evaluationId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const collections = this.getMetricsHistory(evaluationId);

    if (format === 'json') {
      return JSON.stringify(collections, null, 2);
    } else {
      // Convert to CSV
      const headers = ['timestamp', 'taskSuccessRate', 'executionTime', 'estimatedCost', 'toolCallErrorRate'];
      const rows = collections.map(collection => [
        collection.timestamp.toISOString(),
        collection.performance.taskSuccessRate,
        collection.efficiency.executionTime,
        collection.cost.estimatedCost,
        collection.robustness.toolCallErrorRate
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }

  cleanup(evaluationId: string): void {
    this.stopCollection(evaluationId);
    this.collections.delete(evaluationId);
  }

  async cleanupAll(): Promise<void> {
    for (const evaluationId of this.timers.keys()) {
      this.cleanup(evaluationId);
    }
  }

  getStats(): any {
    return {
      activeCollections: this.timers.size,
      totalCollections: Array.from(this.collections.values())
        .reduce((total, collections) => total + collections.length, 0),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}