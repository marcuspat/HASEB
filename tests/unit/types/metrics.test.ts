import { describe, it, expect } from '@jest/globals';
import {
  BaseMetrics,
  PerformanceMetrics,
  EfficiencyMetrics,
  CostMetrics,
  RobustnessMetrics,
  QualityMetrics,
  ComprehensiveMetrics,
  MetricsCollectionContext,
  MetricCollectorConfig,
  MetricValidationError,
  MetricsAggregation,
  MetricsExportOptions,
  RealTimeMetricsUpdate,
  isPerformanceMetrics,
  isEfficiencyMetrics,
  isCostMetrics,
  isRobustnessMetrics,
  isQualityMetrics,
  validateMetrics,
} from '@/types/metrics';

describe('Metrics Types', () => {
  describe('BaseMetrics', () => {
    it('should accept valid BaseMetrics', () => {
      const baseMetrics: BaseMetrics = {
        timestamp: new Date('2024-01-15T10:30:00Z'),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
      };

      expect(baseMetrics.evaluationId).toBe('eval-123');
      expect(baseMetrics.agentId).toBe('agent-456');
      expect(baseMetrics.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('PerformanceMetrics', () => {
    it('should accept valid PerformanceMetrics', () => {
      const performanceMetrics: PerformanceMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        taskSuccessRate: 0.92,
        tasksCompleted: 85,
        tasksTotal: 100,
        passRate: 0.85,
        failRate: 0.15,
        completionValidation: {
          passed: 85,
          failed: 10,
          skipped: 5,
        },
        resultAccuracy: 0.88,
        benchmarkCompletionRate: 0.85,
      };

      expect(performanceMetrics.taskSuccessRate).toBe(0.92);
      expect(performanceMetrics.completionValidation.passed).toBe(85);
      expect(performanceMetrics.passRate).toBe(0.85);
    });

    it('should validate ranges', () => {
      const validMetrics: PerformanceMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        taskSuccessRate: 0.5, // Valid: 0-1
        tasksCompleted: 50,
        tasksTotal: 100,
        passRate: 0.5, // Valid: 0-1
        failRate: 0.5, // Valid: 0-1
        completionValidation: {
          passed: 50,
          failed: 30,
          skipped: 20,
        },
        resultAccuracy: 0.75, // Valid: 0-1
        benchmarkCompletionRate: 0.5, // Valid: 0-1
      };

      expect(validMetrics.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(validMetrics.taskSuccessRate).toBeLessThanOrEqual(1);
      expect(validMetrics.resultAccuracy).toBeGreaterThanOrEqual(0);
      expect(validMetrics.resultAccuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('EfficiencyMetrics', () => {
    it('should accept valid EfficiencyMetrics', () => {
      const efficiencyMetrics: EfficiencyMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        executionTime: 15000,
        latencyPerStep: 1500,
        totalSteps: 10,
        averageStepDuration: 1500,
        peakMemoryUsage: 512,
        averageMemoryUsage: 256,
        cpuUtilization: 0.75,
        throughput: 2.5,
        responseTime: {
          min: 500,
          max: 3000,
          average: 1500,
          p50: 1200,
          p95: 2500,
          p99: 2800,
        },
      };

      expect(efficiencyMetrics.executionTime).toBe(15000);
      expect(efficiencyMetrics.responseTime.min).toBe(500);
      expect(efficiencyMetrics.responseTime.p99).toBe(2800);
    });

    it('should validate time-based metrics', () => {
      const metrics: EfficiencyMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        executionTime: 5000, // milliseconds
        latencyPerStep: 500, // milliseconds
        totalSteps: 10,
        averageStepDuration: 500, // milliseconds
        peakMemoryUsage: 1024, // MB
        averageMemoryUsage: 512, // MB
        cpuUtilization: 0.8, // 0-1
        throughput: 2.0, // tasks per second
        responseTime: {
          min: 100, // milliseconds
          max: 2000, // milliseconds
          average: 800, // milliseconds
          p50: 600, // milliseconds
          p95: 1500, // milliseconds
          p99: 1800, // milliseconds
        },
      };

      expect(metrics.executionTime).toBeGreaterThan(0);
      expect(metrics.latencyPerStep).toBeGreaterThan(0);
      expect(metrics.cpuUtilization).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUtilization).toBeLessThanOrEqual(1);
    });
  });

  describe('CostMetrics', () => {
    it('should accept valid CostMetrics', () => {
      const costMetrics: CostMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        totalTokens: 5000,
        inputTokens: 3000,
        outputTokens: 2000,
        estimatedCost: 0.25,
        tokenCosts: {
          input: 0.15,
          output: 0.10,
          total: 0.25,
        },
        apiCosts: {
          'openai-gpt-4': {
            calls: 10,
            cost: 0.20,
            tokens: 5000,
          },
          'anthropic-claude': {
            calls: 5,
            cost: 0.05,
            tokens: 2000,
          },
        },
        resourceCosts: {
          compute: 0.02,
          storage: 0.01,
          network: 0.01,
          total: 0.04,
        },
        costPerTask: 0.025,
        costOptimization: {
          potential: 0.05,
          achieved: 0.03,
          efficiency: 0.6,
        },
      };

      expect(costMetrics.totalTokens).toBe(5000);
      expect(costMetrics.apiCosts['openai-gpt-4'].calls).toBe(10);
      expect(costMetrics.costOptimization.efficiency).toBe(0.6);
    });

    it('should validate monetary values', () => {
      const metrics: CostMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        totalTokens: 1000,
        inputTokens: 600,
        outputTokens: 400,
        estimatedCost: 0.05, // USD
        tokenCosts: {
          input: 0.03, // USD
          output: 0.02, // USD
          total: 0.05, // USD
        },
        apiCosts: {},
        resourceCosts: {
          compute: 0.01, // USD
          storage: 0.005, // USD
          network: 0.005, // USD
          total: 0.02, // USD
        },
        costPerTask: 0.01, // USD
        costOptimization: {
          potential: 0.02, // USD
          achieved: 0.015, // USD
          efficiency: 0.75, // 0-1
        },
      };

      expect(metrics.estimatedCost).toBeGreaterThan(0);
      expect(metrics.costPerTask).toBeGreaterThan(0);
      expect(metrics.costOptimization.efficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.costOptimization.efficiency).toBeLessThanOrEqual(1);
    });
  });

  describe('RobustnessMetrics', () => {
    it('should accept valid RobustnessMetrics', () => {
      const robustnessMetrics: RobustnessMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        toolCallErrorRate: 0.05,
        recoveryRate: 0.95,
        errorCounts: {
          total: 100,
          fatal: 2,
          recoverable: 80,
          transient: 18,
        },
        errorPatterns: {
          'timeout': {
            count: 20,
            recoveryTime: 5000,
            recoveryAttempts: 25,
            successRate: 0.8,
          },
          'api-failure': {
            count: 15,
            recoveryTime: 2000,
            recoveryAttempts: 18,
            successRate: 0.83,
          },
        },
        failureModes: {
          timeout: 20,
          resourceExhaustion: 5,
          apiFailure: 15,
          logicError: 8,
          unexpectedInput: 12,
        },
        resilience: {
          averageRecoveryTime: 3000,
          maxDowntime: 10000,
          availability: 0.99,
          meanTimeBetweenFailures: 50000,
        },
      };

      expect(robustnessMetrics.toolCallErrorRate).toBe(0.05);
      expect(robustnessMetrics.errorPatterns['timeout'].count).toBe(20);
      expect(robustnessMetrics.resilience.availability).toBe(0.99);
    });

    it('should validate error rates and recovery metrics', () => {
      const metrics: RobustnessMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        toolCallErrorRate: 0.1, // 0-1
        recoveryRate: 0.9, // 0-1
        errorCounts: {
          total: 50,
          fatal: 1,
          recoverable: 40,
          transient: 9,
        },
        errorPatterns: {
          'test-error': {
            count: 10,
            recoveryTime: 1000, // milliseconds
            recoveryAttempts: 12,
            successRate: 0.83, // 0-1
          },
        },
        failureModes: {
          timeout: 10,
          resourceExhaustion: 2,
          apiFailure: 8,
          logicError: 3,
          unexpectedInput: 5,
        },
        resilience: {
          averageRecoveryTime: 2000, // milliseconds
          maxDowntime: 5000, // milliseconds
          availability: 0.95, // 0-1
          meanTimeBetweenFailures: 30000, // milliseconds
        },
      };

      expect(metrics.toolCallErrorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.toolCallErrorRate).toBeLessThanOrEqual(1);
      expect(metrics.recoveryRate).toBeGreaterThanOrEqual(0);
      expect(metrics.recoveryRate).toBeLessThanOrEqual(1);
    });
  });

  describe('QualityMetrics', () => {
    it('should accept valid QualityMetrics', () => {
      const qualityMetrics: QualityMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        toolSelectionAccuracy: 0.92,
        parameterAccuracy: 0.88,
        decisionQuality: 0.90,
        outputQuality: 0.85,
        toolUsage: {
          'code-interpreter': {
            uses: 25,
            successRate: 0.96,
            averageExecutionTime: 2000,
            errors: 1,
          },
          'file-manager': {
            uses: 15,
            successRate: 0.87,
            averageExecutionTime: 500,
            errors: 2,
          },
        },
        parameterValidation: {
          correct: 45,
          incorrect: 3,
          missing: 1,
          invalid: 1,
        },
        decisionTracking: {
          total: 50,
          optimal: 35,
          suboptimal: 12,
          incorrect: 3,
        },
        outputScoring: {
          relevance: 0.92,
          completeness: 0.88,
          correctness: 0.90,
          clarity: 0.85,
        },
      };

      expect(qualityMetrics.toolSelectionAccuracy).toBe(0.92);
      expect(qualityMetrics.toolUsage['code-interpreter'].uses).toBe(25);
      expect(qualityMetrics.decisionTracking.optimal).toBe(35);
      expect(qualityMetrics.outputScoring.relevance).toBe(0.92);
    });

    it('should validate quality metrics ranges', () => {
      const metrics: QualityMetrics = {
        timestamp: new Date(),
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        toolSelectionAccuracy: 0.85, // 0-1
        parameterAccuracy: 0.80, // 0-1
        decisionQuality: 0.82, // 0-1
        outputQuality: 0.78, // 0-1
        toolUsage: {
          'test-tool': {
            uses: 10,
            successRate: 0.9, // 0-1
            averageExecutionTime: 1000, // milliseconds
            errors: 1,
          },
        },
        parameterValidation: {
          correct: 8,
          incorrect: 1,
          missing: 1,
          invalid: 0,
        },
        decisionTracking: {
          total: 10,
          optimal: 7,
          suboptimal: 2,
          incorrect: 1,
        },
        outputScoring: {
          relevance: 0.85, // 0-1
          completeness: 0.80, // 0-1
          correctness: 0.82, // 0-1
          clarity: 0.78, // 0-1
        },
      };

      expect(metrics.toolSelectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.toolSelectionAccuracy).toBeLessThanOrEqual(1);
      expect(metrics.outputScoring.relevance).toBeGreaterThanOrEqual(0);
      expect(metrics.outputScoring.relevance).toBeLessThanOrEqual(1);
    });
  });

  describe('ComprehensiveMetrics', () => {
    it('should accept valid ComprehensiveMetrics', () => {
      const comprehensiveMetrics: ComprehensiveMetrics = {
        performance: {} as PerformanceMetrics,
        efficiency: {} as EfficiencyMetrics,
        cost: {} as CostMetrics,
        robustness: {} as RobustnessMetrics,
        quality: {} as QualityMetrics,
        aggregated: {
          overallScore: 0.88,
          rank: 5,
          percentile: 85,
          trend: 'improving',
          confidence: 0.92,
        },
      };

      expect(comprehensiveMetrics.aggregated.overallScore).toBe(0.88);
      expect(comprehensiveMetrics.aggregated.rank).toBe(5);
      expect(comprehensiveMetrics.aggregated.trend).toBe('improving');
    });

    it('should validate trend values', () => {
      const validTrends: ComprehensiveMetrics['aggregated']['trend'][] = ['improving', 'stable', 'declining'];

      validTrends.forEach(trend => {
        const metrics: ComprehensiveMetrics = {
          performance: {} as PerformanceMetrics,
          efficiency: {} as EfficiencyMetrics,
          cost: {} as CostMetrics,
          robustness: {} as RobustnessMetrics,
          quality: {} as QualityMetrics,
          aggregated: {
            overallScore: 0.75,
            rank: 10,
            percentile: 60,
            trend,
            confidence: 0.8,
          },
        };
        expect(metrics.aggregated.trend).toBe(trend);
      });
    });
  });

  describe('MetricsCollectionContext', () => {
    it('should accept valid MetricsCollectionContext', () => {
      const context: MetricsCollectionContext = {
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        benchmarkId: 'benchmark-789',
        sessionId: 'session-abc',
        startTime: new Date('2024-01-15T09:00:00Z'),
        configuration: {
          timeout: 300000,
          maxRetries: 3,
        },
        environment: {
          platform: 'linux',
          version: 'Ubuntu 22.04',
          resources: {
            cpu: 'Intel i7-9700K',
            memory: '16GB DDR4',
            storage: '512GB NVMe SSD',
          },
        },
      };

      expect(context.evaluationId).toBe('eval-123');
      expect(context.environment.platform).toBe('linux');
      expect(context.environment.resources.cpu).toBe('Intel i7-9700K');
    });
  });

  describe('MetricCollectorConfig', () => {
    it('should accept valid MetricCollectorConfig', () => {
      const config: MetricCollectorConfig = {
        collectionInterval: 1000,
        batchSize: 50,
        retryAttempts: 3,
        retryDelay: 2000,
        enableRealTime: true,
        storage: {
          persistImmediately: false,
          compressionEnabled: true,
          retentionDays: 30,
        },
        validation: {
          strictMode: true,
          outlierDetection: true,
          qualityThreshold: 0.8,
        },
      };

      expect(config.collectionInterval).toBe(1000);
      expect(config.storage.compressionEnabled).toBe(true);
      expect(config.validation.strictMode).toBe(true);
    });

    it('should validate configuration values', () => {
      const config: MetricCollectorConfig = {
        collectionInterval: 5000, // milliseconds
        batchSize: 100,
        retryAttempts: 5,
        retryDelay: 1000, // milliseconds
        enableRealTime: false,
        storage: {
          persistImmediately: true,
          compressionEnabled: false,
          retentionDays: 90,
        },
        validation: {
          strictMode: false,
          outlierDetection: false,
          qualityThreshold: 0.7, // 0-1
        },
      };

      expect(config.collectionInterval).toBeGreaterThan(0);
      expect(config.batchSize).toBeGreaterThan(0);
      expect(config.validation.qualityThreshold).toBeGreaterThanOrEqual(0);
      expect(config.validation.qualityThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe('MetricValidationError', () => {
    it('should accept valid MetricValidationError', () => {
      const error: MetricValidationError = {
        field: 'performance.taskSuccessRate',
        value: 1.5,
        expected: '0-1 decimal',
        actual: '1.5',
        severity: 'error',
      };

      expect(error.field).toBe('performance.taskSuccessRate');
      expect(error.value).toBe(1.5);
      expect(error.severity).toBe('error');
    });

    it('should accept all severity levels', () => {
      const severities: MetricValidationError['severity'][] = ['error', 'warning', 'info'];

      severities.forEach(severity => {
        const error: MetricValidationError = {
          field: 'test.field',
          value: 'invalid',
          expected: 'valid value',
          actual: 'invalid',
          severity,
        };
        expect(error.severity).toBe(severity);
      });
    });
  });

  describe('Type Guards', () => {
    describe('isPerformanceMetrics', () => {
      it('should return true for valid PerformanceMetrics', () => {
        const validMetrics = {
          taskSuccessRate: 0.9,
          executionTime: 5000,
          tasksCompleted: 85,
          tasksTotal: 100,
        };

        expect(isPerformanceMetrics(validMetrics)).toBe(true);
      });

      it('should return false for invalid PerformanceMetrics', () => {
        const invalidMetrics = {
          taskSuccessRate: 'invalid',
          executionTime: 5000,
          tasksCompleted: 85,
          tasksTotal: 100,
        };

        expect(isPerformanceMetrics(invalidMetrics)).toBe(false);
      });

      it('should return false for null/undefined', () => {
        expect(isPerformanceMetrics(null)).toBe(false);
        expect(isPerformanceMetrics(undefined)).toBe(false);
      });
    });

    describe('isEfficiencyMetrics', () => {
      it('should return true for valid EfficiencyMetrics', () => {
        const validMetrics = {
          executionTime: 10000,
          latencyPerStep: 1000,
          totalSteps: 10,
          throughput: 2.5,
        };

        expect(isEfficiencyMetrics(validMetrics)).toBe(true);
      });

      it('should return false for invalid EfficiencyMetrics', () => {
        const invalidMetrics = {
          executionTime: 'invalid',
          latencyPerStep: 1000,
          totalSteps: 10,
          throughput: 2.5,
        };

        expect(isEfficiencyMetrics(invalidMetrics)).toBe(false);
      });
    });

    describe('isCostMetrics', () => {
      it('should return true for valid CostMetrics', () => {
        const validMetrics = {
          totalTokens: 5000,
          estimatedCost: 0.25,
          inputTokens: 3000,
          outputTokens: 2000,
        };

        expect(isCostMetrics(validMetrics)).toBe(true);
      });

      it('should return false for invalid CostMetrics', () => {
        const invalidMetrics = {
          totalTokens: 'invalid',
          estimatedCost: 0.25,
          inputTokens: 3000,
          outputTokens: 2000,
        };

        expect(isCostMetrics(invalidMetrics)).toBe(false);
      });
    });

    describe('isRobustnessMetrics', () => {
      it('should return true for valid RobustnessMetrics', () => {
        const validMetrics = {
          toolCallErrorRate: 0.05,
          recoveryRate: 0.95,
          errorCounts: {
            total: 100,
            fatal: 2,
            recoverable: 80,
            transient: 18,
          },
        };

        expect(isRobustnessMetrics(validMetrics)).toBe(true);
      });

      it('should return false for invalid RobustnessMetrics', () => {
        const invalidMetrics = {
          toolCallErrorRate: 0.05,
          recoveryRate: 0.95,
          errorCounts: {
            total: 'invalid',
            fatal: 2,
            recoverable: 80,
            transient: 18,
          },
        };

        expect(isRobustnessMetrics(invalidMetrics)).toBe(false);
      });
    });

    describe('isQualityMetrics', () => {
      it('should return true for valid QualityMetrics', () => {
        const validMetrics = {
          toolSelectionAccuracy: 0.92,
          parameterAccuracy: 0.88,
          decisionQuality: 0.90,
        };

        expect(isQualityMetrics(validMetrics)).toBe(true);
      });

      it('should return false for invalid QualityMetrics', () => {
        const invalidMetrics = {
          toolSelectionAccuracy: 'invalid',
          parameterAccuracy: 0.88,
          decisionQuality: 0.90,
        };

        expect(isQualityMetrics(invalidMetrics)).toBe(false);
      });
    });
  });

  describe('validateMetrics', () => {
    it('should validate valid metrics without errors', () => {
      const validMetrics = {
        performance: {
          taskSuccessRate: 0.85,
          executionTime: 5000,
          tasksCompleted: 80,
          tasksTotal: 100,
        },
        efficiency: {
          executionTime: 5000,
          latencyPerStep: 500,
          totalSteps: 10,
          throughput: 2.0,
        },
        cost: {
          totalTokens: 4000,
          estimatedCost: 0.20,
          inputTokens: 2400,
          outputTokens: 1600,
        },
      };

      const errors = validateMetrics(validMetrics);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid task success rate', () => {
      const invalidMetrics = {
        performance: {
          taskSuccessRate: 1.5, // Invalid: > 1
          executionTime: 5000,
          tasksCompleted: 80,
          tasksTotal: 100,
        },
      };

      const errors = validateMetrics(invalidMetrics);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('performance.taskSuccessRate');
      expect(errors[0].severity).toBe('error');
    });

    it('should detect negative execution time', () => {
      const invalidMetrics = {
        efficiency: {
          executionTime: -1000, // Invalid: negative
          latencyPerStep: 500,
          totalSteps: 10,
          throughput: 2.0,
        },
      };

      const errors = validateMetrics(invalidMetrics);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('efficiency.executionTime');
      expect(errors[0].severity).toBe('error');
    });

    it('should detect negative cost', () => {
      const invalidMetrics = {
        cost: {
          totalTokens: 4000,
          estimatedCost: -0.10, // Invalid: negative
          inputTokens: 2400,
          outputTokens: 1600,
        },
      };

      const errors = validateMetrics(invalidMetrics);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('cost.estimatedCost');
      expect(errors[0].severity).toBe('error');
    });

    it('should detect multiple validation errors', () => {
      const invalidMetrics = {
        performance: {
          taskSuccessRate: 1.2, // Invalid
          executionTime: 5000,
          tasksCompleted: 80,
          tasksTotal: 100,
        },
        efficiency: {
          executionTime: -500, // Invalid
          latencyPerStep: 500,
          totalSteps: 10,
          throughput: 2.0,
        },
        cost: {
          totalTokens: 4000,
          estimatedCost: -0.05, // Invalid
          inputTokens: 2400,
          outputTokens: 1600,
        },
      };

      const errors = validateMetrics(invalidMetrics);
      expect(errors).toHaveLength(3);
      expect(errors.map(e => e.field)).toContain('performance.taskSuccessRate');
      expect(errors.map(e => e.field)).toContain('efficiency.executionTime');
      expect(errors.map(e => e.field)).toContain('cost.estimatedCost');
    });
  });

  describe('Complex Type Integration', () => {
    it('should handle MetricsAggregation', () => {
      const aggregation: MetricsAggregation = {
        timeRange: {
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-31T23:59:59Z'),
        },
        filters: {
          agentIds: ['agent-1', 'agent-2'],
          benchmarkIds: ['benchmark-1'],
          status: ['completed', 'failed'],
        },
        aggregations: {
          performance: {
            avgSuccessRate: 0.85,
            totalTasks: 1000,
            completionRate: 0.92,
          },
          efficiency: {
            avgExecutionTime: 12000,
            avgThroughput: 3.5,
            resourceUtilization: 0.75,
          },
          cost: {
            totalCost: 250.0,
            avgCostPerTask: 0.25,
            tokenEfficiency: 0.88,
          },
          robustness: {
            avgErrorRate: 0.05,
            avgRecoveryRate: 0.92,
            availability: 0.98,
          },
          quality: {
            avgQualityScore: 0.87,
            toolAccuracy: 0.91,
            decisionQuality: 0.85,
          },
        },
        trends: {
          'success_rate': {
            direction: 'up',
            changeRate: 5.2,
            confidence: 0.89,
          },
          'cost_efficiency': {
            direction: 'stable',
            changeRate: 0.1,
            confidence: 0.92,
          },
        },
      };

      expect(aggregation.filters.agentIds).toHaveLength(2);
      expect(aggregation.aggregations.performance.avgSuccessRate).toBe(0.85);
      expect(aggregation.trends['success_rate'].direction).toBe('up');
    });

    it('should handle MetricsExportOptions', () => {
      const exportOptions: MetricsExportOptions = {
        format: 'json',
        includeRaw: true,
        includeAggregated: true,
        dateRange: {
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-31T23:59:59Z'),
        },
        filters: {
          agentIds: ['agent-1'],
          benchmarkIds: ['benchmark-1', 'benchmark-2'],
          metricTypes: ['performance', 'efficiency'],
        },
        compression: true,
        encryption: false,
      };

      expect(exportOptions.format).toBe('json');
      expect(exportOptions.filters.metricTypes).toContain('efficiency');
      expect(exportOptions.compression).toBe(true);
    });

    it('should handle RealTimeMetricsUpdate', () => {
      const update: RealTimeMetricsUpdate = {
        type: 'metric_update',
        evaluationId: 'eval-123',
        agentId: 'agent-456',
        timestamp: new Date(),
        data: {
          performance: {} as PerformanceMetrics,
          efficiency: {} as EfficiencyMetrics,
        },
        progress: {
          current: 75,
          total: 100,
          percentage: 75,
        },
        status: 'running',
      };

      expect(update.type).toBe('metric_update');
      expect(update.progress?.percentage).toBe(75);
      expect(update.status).toBe('running');
    });
  });
});