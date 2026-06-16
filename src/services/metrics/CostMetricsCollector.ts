/**
 * Cost Metrics Collector
 * Tracks LLM token usage, API costs, and resource costs
 */

import { BaseMetricCollector } from './BaseMetricCollector';
import { BaseMetrics, CostMetrics, MetricsCollectionContext, MetricValidationError } from '../../types/metrics';
import { logger } from '../../utils/logger';
import { EvaluationModel } from '../../database/models/Evaluation';

interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
}

interface ApiCall {
  apiName: string;
  endpoint: string;
  calls: number;
  cost: number;
  tokens?: number;
  responseTime: number;
  timestamp: Date;
}

interface ResourceUsage {
  type: 'compute' | 'storage' | 'network';
  amount: number;
  unit: string;
  cost: number;
  timestamp: Date;
}

interface CostState {
  tokenUsages: TokenUsage[];
  apiCalls: Map<string, ApiCall[]>;
  resourceUsages: ResourceUsage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalTokenCost: number;
  totalApiCost: number;
  totalResourceCost: number;
  modelCosts: Map<string, number>;
  tasksCompleted: number;
}

// Default pricing (can be overridden via configuration)
const DEFAULT_PRICING = {
  'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
};

const DEFAULT_RESOURCE_PRICING = {
  compute: 0.01, // per vCPU-hour
  storage: 0.000023, // per GB-month
  network: 0.09, // per GB
};

export class CostMetricsCollector extends BaseMetricCollector {
  private state: CostState;
  private pricing: Record<string, { input: number; output: number }>;
  private resourcePricing: typeof DEFAULT_RESOURCE_PRICING;

  constructor(context: MetricsCollectionContext, config?: any) {
    super(context, config);
    this.state = {
      tokenUsages: [],
      apiCalls: new Map(),
      resourceUsages: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalTokenCost: 0,
      totalApiCost: 0,
      totalResourceCost: 0,
      modelCosts: new Map(),
      tasksCompleted: 0,
    };

    this.pricing = { ...DEFAULT_PRICING, ...(config?.pricing || {}) };
    this.resourcePricing = { ...DEFAULT_RESOURCE_PRICING, ...(config?.resourcePricing || {}) };
  }

  protected async initialize(): Promise<void> {
    logger.debug('Initializing CostMetricsCollector');

    // Set up event listeners for cost-related events
    this.on('token_usage', this.handleTokenUsage.bind(this));
    this.on('api_call', this.handleApiCall.bind(this));
    this.on('resource_usage', this.handleResourceUsage.bind(this));
    this.on('task_completed', this.handleTaskCompleted.bind(this));
  }

  protected async gatherMetrics(eventData?: any): Promise<Partial<CostMetrics> | null> {
    const currentTime = new Date();

    // Calculate token costs
    const tokenCosts = {
      input: this.calculateTokenCost(this.state.totalInputTokens, 'input'),
      output: this.calculateTokenCost(this.state.totalOutputTokens, 'output'),
      total: this.state.totalTokenCost,
    };

    // Aggregate API costs by API name
    const apiCosts: CostMetrics['apiCosts'] = {};
    for (const [apiName, calls] of this.state.apiCalls.entries()) {
      const totalCalls = calls.reduce((sum, call) => sum + call.calls, 0);
      const totalCost = calls.reduce((sum, call) => sum + call.cost, 0);
      const totalTokens = calls.reduce((sum, call) => sum + (call.tokens || 0), 0);

      apiCosts[apiName] = {
        calls: totalCalls,
        cost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
        tokens: totalTokens > 0 ? totalTokens : undefined,
      };
    }

    // Aggregate resource costs
    const resourceCosts = {
      compute: this.state.resourceUsages
        .filter(r => r.type === 'compute')
        .reduce((sum, r) => sum + r.cost, 0),
      storage: this.state.resourceUsages
        .filter(r => r.type === 'storage')
        .reduce((sum, r) => sum + r.cost, 0),
      network: this.state.resourceUsages
        .filter(r => r.type === 'network')
        .reduce((sum, r) => sum + r.cost, 0),
      total: this.state.totalResourceCost,
    };

    // Calculate cost per task
    const costPerTask = this.state.tasksCompleted > 0
      ? (this.state.totalTokenCost + this.state.totalApiCost + this.state.totalResourceCost) / this.state.tasksCompleted
      : 0;

    // Calculate cost optimization metrics
    const costOptimization = this.calculateCostOptimization();

    return {
      timestamp: currentTime,
      evaluationId: this.context.evaluationId,
      agentId: this.context.agentId,
      benchmarkId: this.context.benchmarkId,
      sessionId: this.context.sessionId,
      totalTokens: this.state.totalTokens,
      inputTokens: this.state.totalInputTokens,
      outputTokens: this.state.totalOutputTokens,
      estimatedCost: Math.round((this.state.totalTokenCost + this.state.totalApiCost + this.state.totalResourceCost) * 10000) / 10000,
      tokenCosts,
      apiCosts,
      resourceCosts,
      costPerTask: Math.round(costPerTask * 10000) / 10000,
      costOptimization,
    };
  }

  protected validateMetrics(metrics: Partial<BaseMetrics>): MetricValidationError[] {
    const errors: MetricValidationError[] = [];
    const costMetrics = metrics as CostMetrics;

    if (costMetrics.totalTokens !== undefined && costMetrics.totalTokens < 0) {
      errors.push({
        field: 'totalTokens',
        value: costMetrics.totalTokens,
        expected: 'positive number',
        actual: String(costMetrics.totalTokens),
        severity: 'error',
      });
    }

    if (costMetrics.estimatedCost !== undefined && costMetrics.estimatedCost < 0) {
      errors.push({
        field: 'estimatedCost',
        value: costMetrics.estimatedCost,
        expected: 'positive number',
        actual: String(costMetrics.estimatedCost),
        severity: 'error',
      });
    }

    if (costMetrics.inputTokens !== undefined && costMetrics.inputTokens < 0) {
      errors.push({
        field: 'inputTokens',
        value: costMetrics.inputTokens,
        expected: 'positive number',
        actual: String(costMetrics.inputTokens),
        severity: 'error',
      });
    }

    if (costMetrics.outputTokens !== undefined && costMetrics.outputTokens < 0) {
      errors.push({
        field: 'outputTokens',
        value: costMetrics.outputTokens,
        expected: 'positive number',
        actual: String(costMetrics.outputTokens),
        severity: 'error',
      });
    }

    return errors;
  }

  protected async persistMetrics(metrics: BaseMetrics): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await EvaluationModel.updateMetrics(this.context.evaluationId, {
          cost: metrics as CostMetrics,
        } as any);
      }, 'persist_cost_metrics');

      logger.debug('Cost metrics persisted successfully');
    } catch (error) {
      logger.error('Failed to persist cost metrics:', error);
      throw error;
    }
  }

  /**
   * Record token usage
   */
  public recordTaskCompletion(): void {
    this.state.tasksCompleted += 1;
  }

  public recordTokenUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    customPricing?: { input: number; output: number }
  ): void {
    const totalTokens = inputTokens + outputTokens;
    const pricing = customPricing || this.pricing[model];

    if (!pricing) {
      logger.warn(`No pricing found for model: ${model}`);
      return;
    }

    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000; // Convert from per-1K tokens

    const tokenUsage: TokenUsage = {
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      timestamp: new Date(),
    };

    this.state.tokenUsages.push(tokenUsage);
    this.state.totalInputTokens += inputTokens;
    this.state.totalOutputTokens += outputTokens;
    this.state.totalTokens += totalTokens;
    this.state.totalTokenCost += cost;

    // Update model costs
    const currentModelCost = this.state.modelCosts.get(model) || 0;
    this.state.modelCosts.set(model, currentModelCost + cost);

    logger.debug(`Token usage recorded for ${model}`, {
      inputTokens,
      outputTokens,
      cost: Math.round(cost * 10000) / 10000,
    });

    this.emit('token_usage', { model, inputTokens, outputTokens, cost });
  }

  /**
   * Record API call
   */
  public recordApiCall(
    apiName: string,
    endpoint: string,
    cost: number,
    tokens?: number,
    responseTime?: number
  ): void {
    const apiCall: ApiCall = {
      apiName,
      endpoint,
      calls: 1,
      cost,
      tokens,
      responseTime: responseTime || 0,
      timestamp: new Date(),
    };

    if (!this.state.apiCalls.has(apiName)) {
      this.state.apiCalls.set(apiName, []);
    }
    this.state.apiCalls.get(apiName)!.push(apiCall);
    this.state.totalApiCost += cost;

    logger.debug(`API call recorded for ${apiName}`, {
      endpoint,
      cost: Math.round(cost * 10000) / 10000,
      tokens,
      responseTime,
    });

    this.emit('api_call', { apiName, endpoint, cost, tokens, responseTime });
  }

  /**
   * Record resource usage
   */
  public recordResourceUsage(
    type: 'compute' | 'storage' | 'network',
    amount: number,
    unit: string,
    customCost?: number
  ): void {
    const costPerUnit = this.resourcePricing[type];
    const cost = customCost !== undefined ? customCost : this.calculateResourceCost(type, amount, unit);

    const resourceUsage: ResourceUsage = {
      type,
      amount,
      unit,
      cost,
      timestamp: new Date(),
    };

    this.state.resourceUsages.push(resourceUsage);
    this.state.totalResourceCost += cost;

    logger.debug(`Resource usage recorded for ${type}`, {
      amount,
      unit,
      cost: Math.round(cost * 10000) / 10000,
    });

    this.emit('resource_usage', { type, amount, unit, cost });
  }

  /**
   * Calculate token cost
   */
  private calculateTokenCost(tokens: number, type: 'input' | 'output'): number {
    // Simple calculation - in real implementation, this would use actual pricing
    // For now, we'll use an average cost across all models
    const averageCost = Object.values(this.pricing).reduce((sum, pricing) => sum + pricing[type], 0) / Object.keys(this.pricing).length;
    return (tokens * averageCost) / 1000;
  }

  /**
   * Calculate resource cost
   */
  private calculateResourceCost(type: string, amount: number, unit: string): number {
    const costPerUnit = this.resourcePricing[type as keyof typeof DEFAULT_RESOURCE_PRICING];

    switch (type) {
      case 'compute':
        // Amount is in hours, unit is 'vCPU-hours'
        return amount * costPerUnit;
      case 'storage':
        // Amount is in GB, unit is 'GB'
        // Convert GB-months to hourly cost
        return (amount * costPerUnit) / (30 * 24);
      case 'network':
        // Amount is in GB, unit is 'GB'
        return amount * costPerUnit;
      default:
        return 0;
    }
  }

  /**
   * Calculate cost optimization metrics
   */
  private calculateCostOptimization(): CostMetrics['costOptimization'] {
    // This is a simplified implementation - could be enhanced with actual optimization algorithms
    const totalCost = this.state.totalTokenCost + this.state.totalApiCost + this.state.totalResourceCost;

    // Calculate potential savings (e.g., by using cheaper models, caching, etc.)
    let potentialSavings = 0;

    // Example: potential savings from using cheaper models
    for (const [model, cost] of this.state.modelCosts.entries()) {
      if (model === 'gpt-4') {
        // Potential savings by switching to gpt-4-turbo
        const gpt4TurboCost = this.state.tokenUsages
          .filter(t => t.model === 'gpt-4')
          .reduce((sum, t) => sum + (t.inputTokens * this.pricing['gpt-4-turbo'].input + t.outputTokens * this.pricing['gpt-4-turbo'].output) / 1000, 0);
        potentialSavings += cost - gpt4TurboCost;
      }
    }

    return {
      potential: Math.round(potentialSavings * 10000) / 10000,
      achieved: 0, // Would track actual optimizations made
      efficiency: totalCost > 0 ? Math.max(0, 1 - potentialSavings / totalCost) : 1,
    };
  }

  /**
   * Get current cost summary
   */
  public getCostSummary(): {
    totalCost: number;
    tokenCost: number;
    apiCost: number;
    resourceCost: number;
    costPerTask: number;
    totalTokens: number;
  } {
    const totalCost = this.state.totalTokenCost + this.state.totalApiCost + this.state.totalResourceCost;
    const costPerTask = this.state.tasksCompleted > 0 ? totalCost / this.state.tasksCompleted : 0;

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      tokenCost: Math.round(this.state.totalTokenCost * 10000) / 10000,
      apiCost: Math.round(this.state.totalApiCost * 10000) / 10000,
      resourceCost: Math.round(this.state.totalResourceCost * 10000) / 10000,
      costPerTask: Math.round(costPerTask * 10000) / 10000,
      totalTokens: this.state.totalTokens,
    };
  }

  // Event handlers
  private handleTokenUsage(data: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost?: number;
  }): void {
    this.recordTokenUsage(data.model, data.inputTokens, data.outputTokens);
  }

  private handleApiCall(data: {
    apiName: string;
    endpoint: string;
    cost: number;
    tokens?: number;
    responseTime?: number;
  }): void {
    this.recordApiCall(data.apiName, data.endpoint, data.cost, data.tokens, data.responseTime);
  }

  private handleResourceUsage(data: {
    type: 'compute' | 'storage' | 'network';
    amount: number;
    unit: string;
    cost?: number;
  }): void {
    this.recordResourceUsage(data.type, data.amount, data.unit, data.cost);
  }

  private handleTaskCompleted(): void {
    this.state.tasksCompleted++;
  }
}