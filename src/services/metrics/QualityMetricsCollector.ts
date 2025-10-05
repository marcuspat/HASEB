/**
 * Quality Metrics Collector
 * Tracks tool selection accuracy, parameter accuracy, decision quality, and output quality
 */

import { BaseMetricCollector } from './BaseMetricCollector';
import { BaseMetrics, QualityMetrics, MetricsCollectionContext, MetricValidationError } from '../../types/metrics';
import { logger } from '../../utils/logger';
import { EvaluationModel } from '../../database/models/Evaluation';

interface ToolUsage {
  toolName: string;
  uses: number;
  successRate: number;
  averageExecutionTime: number;
  errors: number;
  lastUsed: Date;
}

interface ParameterValidation {
  correct: number;
  incorrect: number;
  missing: number;
  invalid: number;
  total: number;
}

interface DecisionRecord {
  id: string;
  timestamp: Date;
  context: string;
  options: string[];
  selected: string;
  optimal: string;
  reasoning: string;
  outcome: 'optimal' | 'suboptimal' | 'incorrect';
  confidence: number; // 0-1
}

interface OutputQualityScore {
  timestamp: Date;
  taskId: string;
  relevance: number; // 0-1
  completeness: number; // 0-1
  correctness: number; // 0-1
  clarity: number; // 0-1
  overall: number; // 0-1
  feedback?: string;
}

interface QualityState {
  toolUsage: Map<string, ToolUsage>;
  parameterValidation: ParameterValidation;
  decisions: Map<string, DecisionRecord>;
  outputScores: OutputQualityScore[];
  totalToolUses: number;
  totalSuccessfulToolUses: number;
  totalDecisions: number;
  optimalDecisions: number;
  suboptimalDecisions: number;
  incorrectDecisions: number;
}

export class QualityMetricsCollector extends BaseMetricCollector {
  private state: QualityState;

  constructor(context: MetricsCollectionContext, config?: any) {
    super(context, config);
    this.state = {
      toolUsage: new Map(),
      parameterValidation: {
        correct: 0,
        incorrect: 0,
        missing: 0,
        invalid: 0,
        total: 0,
      },
      decisions: new Map(),
      outputScores: [],
      totalToolUses: 0,
      totalSuccessfulToolUses: 0,
      totalDecisions: 0,
      optimalDecisions: 0,
      suboptimalDecisions: 0,
      incorrectDecisions: 0,
    };
  }

  protected async initialize(): Promise<void> {
    logger.debug('Initializing QualityMetricsCollector');

    // Set up event listeners for quality-related events
    this.on('tool_used', this.handleToolUsed.bind(this));
    this.on('tool_failed', this.handleToolFailed.bind(this));
    this.on('parameter_validated', this.handleParameterValidated.bind(this));
    this.on('decision_made', this.handleDecisionMade.bind(this));
    this.on('output_scored', this.handleOutputScored.bind(this));
  }

  protected async gatherMetrics(eventData?: any): Promise<Partial<QualityMetrics> | null> {
    const currentTime = new Date();

    // Calculate tool selection accuracy
    const toolUsage: QualityMetrics['toolUsage'] = {};
    let totalToolSuccesses = 0;
    let totalToolUses = 0;

    for (const [toolName, usage] of this.state.toolUsage.entries()) {
      toolUsage[toolName] = {
        uses: usage.uses,
        successRate: Math.round(usage.successRate * 10000) / 10000,
        averageExecutionTime: Math.round(usage.averageExecutionTime),
        errors: usage.errors,
      };
      totalToolSuccesses += usage.uses * usage.successRate;
      totalToolUses += usage.uses;
    }

    const toolSelectionAccuracy = totalToolUses > 0 ? totalToolSuccesses / totalToolUses : 0;

    // Calculate parameter accuracy
    const parameterAccuracy = this.state.parameterValidation.total > 0
      ? this.state.parameterValidation.correct / this.state.parameterValidation.total
      : 0;

    // Calculate decision quality
    const decisionQuality = this.state.totalDecisions > 0
      ? (this.state.optimalDecisions + 0.5 * this.state.suboptimalDecisions) / this.state.totalDecisions
      : 0;

    // Calculate output quality
    const outputQuality = this.calculateOutputQuality();

    // Parameter validation breakdown
    const parameterValidation = { ...this.state.parameterValidation };

    // Decision tracking
    const decisionTracking = {
      total: this.state.totalDecisions,
      optimal: this.state.optimalDecisions,
      suboptimal: this.state.suboptimalDecisions,
      incorrect: this.state.incorrectDecisions,
    };

    return {
      timestamp: currentTime,
      evaluationId: this.context.evaluationId,
      agentId: this.context.agentId,
      benchmarkId: this.context.benchmarkId,
      sessionId: this.context.sessionId,
      toolSelectionAccuracy: Math.round(toolSelectionAccuracy * 10000) / 10000,
      parameterAccuracy: Math.round(parameterAccuracy * 10000) / 10000,
      decisionQuality: Math.round(decisionQuality * 10000) / 10000,
      outputQuality: Math.round(outputQuality * 10000) / 10000,
      toolUsage,
      parameterValidation,
      decisionTracking,
      outputScoring: this.calculateOutputScoring(),
    };
  }

  protected validateMetrics(metrics: Partial<BaseMetrics>): MetricValidationError[] {
    const errors: MetricValidationError[] = [];
    const qualityMetrics = metrics as QualityMetrics;

    if (qualityMetrics.toolSelectionAccuracy !== undefined &&
        (qualityMetrics.toolSelectionAccuracy < 0 || qualityMetrics.toolSelectionAccuracy > 1)) {
      errors.push({
        field: 'toolSelectionAccuracy',
        value: qualityMetrics.toolSelectionAccuracy,
        expected: '0-1 decimal',
        actual: String(qualityMetrics.toolSelectionAccuracy),
        severity: 'error',
      });
    }

    if (qualityMetrics.parameterAccuracy !== undefined &&
        (qualityMetrics.parameterAccuracy < 0 || qualityMetrics.parameterAccuracy > 1)) {
      errors.push({
        field: 'parameterAccuracy',
        value: qualityMetrics.parameterAccuracy,
        expected: '0-1 decimal',
        actual: String(qualityMetrics.parameterAccuracy),
        severity: 'error',
      });
    }

    if (qualityMetrics.decisionQuality !== undefined &&
        (qualityMetrics.decisionQuality < 0 || qualityMetrics.decisionQuality > 1)) {
      errors.push({
        field: 'decisionQuality',
        value: qualityMetrics.decisionQuality,
        expected: '0-1 decimal',
        actual: String(qualityMetrics.decisionQuality),
        severity: 'error',
      });
    }

    return errors;
  }

  protected async persistMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await EvaluationModel.updateMetrics(this.context.evaluationId, {
          quality: metrics as QualityMetrics,
        } as any);
      }, 'persist_quality_metrics');

      logger.debug('Quality metrics persisted successfully');
    } catch (error) {
      logger.error('Failed to persist quality metrics:', error);
      throw error;
    }
  }

  /**
   * Record tool usage
   */
  public recordToolUsage(
    toolName: string,
    success: boolean,
    executionTime: number,
    context?: Record<string, any>
  ): void {
    let usage = this.state.toolUsage.get(toolName);

    if (!usage) {
      usage = {
        toolName,
        uses: 0,
        successRate: 0,
        averageExecutionTime: 0,
        errors: 0,
        lastUsed: new Date(),
      };
      this.state.toolUsage.set(toolName, usage);
    }

    // Update usage statistics
    const oldUses = usage.uses;
    const oldSuccessRate = usage.successRate;
    const oldAvgTime = usage.averageExecutionTime;

    usage.uses++;
    usage.lastUsed = new Date();

    if (success) {
      this.state.totalSuccessfulToolUses++;
    } else {
      usage.errors++;
    }

    // Update rolling averages
    usage.successRate = (oldSuccessRate * oldUses + (success ? 1 : 0)) / usage.uses;
    usage.averageExecutionTime = (oldAvgTime * oldUses + executionTime) / usage.uses;

    this.state.totalToolUses++;

    logger.debug(`Tool usage recorded: ${toolName}`, {
      success,
      executionTime,
      uses: usage.uses,
      successRate: Math.round(usage.successRate * 10000) / 10000,
    });

    this.emit('tool_used', { toolName, success, executionTime, context });
  }

  /**
   * Record parameter validation
   */
  public recordParameterValidation(
    validity: 'correct' | 'incorrect' | 'missing' | 'invalid'
  ): void {
    this.state.parameterValidation[validity]++;
    this.state.parameterValidation.total++;

    logger.debug(`Parameter validation recorded: ${validity}`, {
      total: this.state.parameterValidation.total,
    });

    this.emit('parameter_validated', { validity });
  }

  /**
   * Record decision making
   */
  public recordDecision(
    context: string,
    options: string[],
    selected: string,
    optimal: string,
    reasoning: string,
    confidence: number = 0.5
  ): string {
    const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let outcome: 'optimal' | 'suboptimal' | 'incorrect';
    if (selected === optimal) {
      outcome = 'optimal';
      this.state.optimalDecisions++;
    } else if (options.includes(selected)) {
      outcome = 'suboptimal';
      this.state.suboptimalDecisions++;
    } else {
      outcome = 'incorrect';
      this.state.incorrectDecisions++;
    }

    const decision: DecisionRecord = {
      id: decisionId,
      timestamp: new Date(),
      context,
      options: [...options],
      selected,
      optimal,
      reasoning,
      outcome,
      confidence: Math.max(0, Math.min(1, confidence)),
    };

    this.state.decisions.set(decisionId, decision);
    this.state.totalDecisions++;

    logger.debug(`Decision recorded: ${decisionId}`, {
      context,
      outcome,
      confidence: Math.round(confidence * 100) / 100,
    });

    this.emit('decision_made', {
      decisionId,
      context,
      outcome,
      confidence,
    });

    return decisionId;
  }

  /**
   * Record output quality score
   */
  public recordOutputQuality(
    taskId: string,
    relevance: number,
    completeness: number,
    correctness: number,
    clarity: number,
    feedback?: string
  ): void {
    const overall = (relevance + completeness + correctness + clarity) / 4;

    const outputScore: OutputQualityScore = {
      timestamp: new Date(),
      taskId,
      relevance: Math.max(0, Math.min(1, relevance)),
      completeness: Math.max(0, Math.min(1, completeness)),
      correctness: Math.max(0, Math.min(1, correctness)),
      clarity: Math.max(0, Math.min(1, clarity)),
      overall: Math.max(0, Math.min(1, overall)),
      feedback,
    };

    this.state.outputScores.push(outputScore);

    logger.debug(`Output quality recorded for task: ${taskId}`, {
      overall: Math.round(outputScore.overall * 100) / 100,
    });

    this.emit('output_scored', { taskId, overall: outputScore.overall });
  }

  /**
   * Calculate overall output quality
   */
  private calculateOutputQuality(): number {
    if (this.state.outputScores.length === 0) {
      return 0;
    }

    const totalScore = this.state.outputScores.reduce((sum, score) => sum + score.overall, 0);
    return totalScore / this.state.outputScores.length;
  }

  /**
   * Calculate output scoring breakdown
   */
  private calculateOutputScoring(): QualityMetrics['outputScoring'] {
    if (this.state.outputScores.length === 0) {
      return {
        relevance: 0,
        completeness: 0,
        correctness: 0,
        clarity: 0,
      };
    }

    const scores = this.state.outputScores;
    const relevance = scores.reduce((sum, s) => sum + s.relevance, 0) / scores.length;
    const completeness = scores.reduce((sum, s) => sum + s.completeness, 0) / scores.length;
    const correctness = scores.reduce((sum, s) => sum + s.correctness, 0) / scores.length;
    const clarity = scores.reduce((sum, s) => sum + s.clarity, 0) / scores.length;

    return {
      relevance: Math.round(relevance * 10000) / 10000,
      completeness: Math.round(completeness * 10000) / 10000,
      correctness: Math.round(correctness * 10000) / 10000,
      clarity: Math.round(clarity * 10000) / 10000,
    };
  }

  /**
   * Get current quality summary
   */
  public getQualitySummary(): {
    toolSelectionAccuracy: number;
    parameterAccuracy: number;
    decisionQuality: number;
    outputQuality: number;
    totalToolsUsed: number;
    totalDecisions: number;
    totalOutputsScored: number;
  } {
    const toolSelectionAccuracy = this.state.totalToolUses > 0
      ? this.state.totalSuccessfulToolUses / this.state.totalToolUses
      : 0;

    const parameterAccuracy = this.state.parameterValidation.total > 0
      ? this.state.parameterValidation.correct / this.state.parameterValidation.total
      : 0;

    const decisionQuality = this.state.totalDecisions > 0
      ? (this.state.optimalDecisions + 0.5 * this.state.suboptimalDecisions) / this.state.totalDecisions
      : 0;

    const outputQuality = this.calculateOutputQuality();

    return {
      toolSelectionAccuracy: Math.round(toolSelectionAccuracy * 10000) / 10000,
      parameterAccuracy: Math.round(parameterAccuracy * 10000) / 10000,
      decisionQuality: Math.round(decisionQuality * 10000) / 10000,
      outputQuality: Math.round(outputQuality * 10000) / 10000,
      totalToolsUsed: this.state.totalToolUses,
      totalDecisions: this.state.totalDecisions,
      totalOutputsScored: this.state.outputScores.length,
    };
  }

  /**
   * Get tool usage statistics
   */
  public getToolUsageStats(): Array<{
    toolName: string;
    uses: number;
    successRate: number;
    averageExecutionTime: number;
    errors: number;
  }> {
    return Array.from(this.state.toolUsage.values()).map(usage => ({
      toolName: usage.toolName,
      uses: usage.uses,
      successRate: Math.round(usage.successRate * 10000) / 10000,
      averageExecutionTime: Math.round(usage.averageExecutionTime),
      errors: usage.errors,
    }));
  }

  /**
   * Get decision breakdown
   */
  public getDecisionBreakdown(): {
    total: number;
    optimal: number;
    suboptimal: number;
    incorrect: number;
    optimalRate: number;
  } {
    const optimalRate = this.state.totalDecisions > 0
      ? this.state.optimalDecisions / this.state.totalDecisions
      : 0;

    return {
      total: this.state.totalDecisions,
      optimal: this.state.optimalDecisions,
      suboptimal: this.state.suboptimalDecisions,
      incorrect: this.state.incorrectDecisions,
      optimalRate: Math.round(optimalRate * 10000) / 10000,
    };
  }

  // Event handlers
  private handleToolUsed(data: {
    toolName: string;
    success: boolean;
    executionTime: number;
    context?: Record<string, any>;
  }): void {
    // Tool usage already recorded in recordToolUsage method
  }

  private handleToolFailed(data: {
    toolName: string;
    error: string;
    executionTime: number;
  }): void {
    this.recordToolUsage(data.toolName, false, data.executionTime, { error: data.error });
  }

  private handleParameterValidated(data: { validity: 'correct' | 'incorrect' | 'missing' | 'invalid' }): void {
    // Parameter validation already recorded in recordParameterValidation method
  }

  private handleDecisionMade(data: {
    decisionId: string;
    context: string;
    outcome: 'optimal' | 'suboptimal' | 'incorrect';
    confidence: number;
  }): void {
    // Decision already recorded in recordDecision method
  }

  private handleOutputScored(data: { taskId: string; overall: number }): void {
    // Output quality already recorded in recordOutputQuality method
  }
}