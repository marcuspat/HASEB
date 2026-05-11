import {
  CollectorError,
  LegacyMetricCollectorAdapter,
  collectAllDimensions,
  type EvaluationRunSummary,
  type LegacyCollectorPort,
  type MetricCollector,
  type MetricCollectorSet,
} from '../../../src/domain/metric-collector';
import {
  type CostMetric,
  type EfficiencyMetric,
  type MetricDimension,
  type PerformanceMetric,
  type QualityMetric,
  type RobustnessMetric,
  createDuration,
  createMoney,
  createPercentage,
  createTokenCount,
} from '../../../src/domain/metric-set';

const RUN: EvaluationRunSummary = {
  evaluationId: 'e1',
  runId: 'r1',
  startedAt: '2026-05-10T00:00:00Z',
  completedAt: '2026-05-10T00:01:00Z',
  outcome: 'success',
  steps: [
    {
      stepIndex: 0,
      recordedAt: '2026-05-10T00:00:01Z',
      kind: 'tool_call',
      status: 'ok',
    },
  ],
};

function performanceCollector(): MetricCollector<PerformanceMetric> {
  return {
    dimension: 'performance',
    async collect() {
      return {
        dimension: 'performance',
        taskSuccessRate: createPercentage(0.8),
        partialCredit: createPercentage(0.7),
        tasksAttempted: 10,
        tasksPassed: 8,
      };
    },
  };
}

function efficiencyCollector(): MetricCollector<EfficiencyMetric> {
  return {
    dimension: 'efficiency',
    async collect() {
      return {
        dimension: 'efficiency',
        executionTime: createDuration(60_000),
        latencyPerStep: createDuration(500),
        totalSteps: 20,
      };
    },
  };
}

function costCollector(): MetricCollector<CostMetric> {
  return {
    dimension: 'cost',
    async collect() {
      return {
        dimension: 'cost',
        tokens: createTokenCount(1000, 200),
        estimatedCost: createMoney(0.1),
      };
    },
  };
}

function robustnessCollector(): MetricCollector<RobustnessMetric> {
  return {
    dimension: 'robustness',
    async collect() {
      return {
        dimension: 'robustness',
        toolCallErrorRate: createPercentage(0.05),
        recoveryRate: createPercentage(0.9),
        retries: 1,
      };
    },
  };
}

function qualityCollector(): MetricCollector<QualityMetric> {
  return {
    dimension: 'quality',
    async collect() {
      return {
        dimension: 'quality',
        toolSelectionAccuracy: createPercentage(0.9),
        parameterAccuracy: createPercentage(0.85),
      };
    },
  };
}

describe('LegacyMetricCollectorAdapter', () => {
  test('wraps a legacy gatherMetrics → typed dimension', async () => {
    const legacy: LegacyCollectorPort<PerformanceMetric> = {
      async gatherMetrics() {
        return { passed: 8, attempted: 10 };
      },
    };
    const adapter = new LegacyMetricCollectorAdapter<PerformanceMetric>(legacy, {
      dimension: 'performance',
      toDimension: (raw) => {
        const r = raw as { passed: number; attempted: number };
        return {
          dimension: 'performance',
          taskSuccessRate: createPercentage(r.passed / r.attempted),
          partialCredit: createPercentage(0),
          tasksAttempted: r.attempted,
          tasksPassed: r.passed,
        };
      },
    });

    const got = await adapter.collect(RUN);
    expect(got.dimension).toBe('performance');
    expect(got.tasksPassed).toBe(8);
    expect(got.taskSuccessRate.value).toBeCloseTo(0.8, 6);
  });

  test('wraps CollectorError when legacy gatherMetrics throws', async () => {
    const legacy: LegacyCollectorPort<PerformanceMetric> = {
      gatherMetrics() {
        throw new Error('boom');
      },
    };
    const adapter = new LegacyMetricCollectorAdapter<PerformanceMetric>(legacy, {
      dimension: 'performance',
      toDimension: () => {
        throw new Error('should not reach');
      },
    });

    await expect(adapter.collect(RUN)).rejects.toBeInstanceOf(CollectorError);
    await expect(adapter.collect(RUN)).rejects.toMatchObject({
      dimension: 'performance',
      message: expect.stringContaining('legacy gatherMetrics threw'),
    });
  });

  test('rejects null/undefined output from legacy gatherMetrics', async () => {
    const legacy: LegacyCollectorPort<PerformanceMetric> = {
      async gatherMetrics() {
        return null;
      },
    };
    const adapter = new LegacyMetricCollectorAdapter<PerformanceMetric>(legacy, {
      dimension: 'performance',
      toDimension: () => {
        throw new Error('should not reach');
      },
    });
    await expect(adapter.collect(RUN)).rejects.toMatchObject({
      dimension: 'performance',
      message: expect.stringContaining('returned null/undefined'),
    });
  });

  test('rejects toDimension output with wrong discriminator', async () => {
    const legacy: LegacyCollectorPort<PerformanceMetric> = {
      async gatherMetrics() {
        return {};
      },
    };
    const adapter = new LegacyMetricCollectorAdapter<PerformanceMetric>(legacy, {
      dimension: 'performance',
      toDimension: () =>
        ({
          dimension: 'cost', // wrong!
          tokens: createTokenCount(0, 0),
          estimatedCost: createMoney(0),
        }) as unknown as PerformanceMetric,
    });
    await expect(adapter.collect(RUN)).rejects.toMatchObject({
      dimension: 'performance',
      message: expect.stringContaining('produced dimension=cost'),
    });
  });

  test('wraps non-CollectorError thrown by toDimension', async () => {
    const legacy: LegacyCollectorPort<PerformanceMetric> = {
      async gatherMetrics() {
        return { passed: 1, attempted: 0 };
      },
    };
    const adapter = new LegacyMetricCollectorAdapter<PerformanceMetric>(legacy, {
      dimension: 'performance',
      toDimension: () => {
        throw new RangeError('Percentage out of range');
      },
    });
    await expect(adapter.collect(RUN)).rejects.toMatchObject({
      dimension: 'performance',
      message: expect.stringContaining('toDimension threw'),
    });
  });
});

describe('collectAllDimensions', () => {
  test('returns one MetricDimension per family in parallel', async () => {
    const set: MetricCollectorSet = {
      performance: performanceCollector(),
      efficiency: efficiencyCollector(),
      cost: costCollector(),
      robustness: robustnessCollector(),
      quality: qualityCollector(),
    };
    const dims = await collectAllDimensions(set, RUN);
    expect(dims).toHaveLength(5);
    const names = dims.map((d: MetricDimension) => d.dimension).sort();
    expect(names).toEqual([
      'cost',
      'efficiency',
      'performance',
      'quality',
      'robustness',
    ]);
  });

  test('rejects if any collector throws', async () => {
    const set: MetricCollectorSet = {
      performance: performanceCollector(),
      efficiency: efficiencyCollector(),
      cost: {
        dimension: 'cost',
        async collect() {
          throw new CollectorError('cost', 'boom');
        },
      },
      robustness: robustnessCollector(),
      quality: qualityCollector(),
    };
    await expect(collectAllDimensions(set, RUN)).rejects.toBeInstanceOf(
      CollectorError,
    );
  });
});
