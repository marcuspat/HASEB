import {
  DefaultProcessViabilityCalculator,
  InvalidWeightsError,
  MissingDimensionError,
} from '../../../src/domain/process-viability-calculator';
import {
  DEFAULT_VIABILITY_WEIGHTS,
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

const performance: PerformanceMetric = {
  dimension: 'performance',
  taskSuccessRate: createPercentage(1),
  partialCredit: createPercentage(1),
  tasksAttempted: 10,
  tasksPassed: 10,
};
const efficiency: EfficiencyMetric = {
  dimension: 'efficiency',
  executionTime: createDuration(0),
  latencyPerStep: createDuration(0),
  totalSteps: 0,
};
const cost: CostMetric = {
  dimension: 'cost',
  tokens: createTokenCount(0, 0),
  estimatedCost: createMoney(0),
};
const robustness: RobustnessMetric = {
  dimension: 'robustness',
  toolCallErrorRate: createPercentage(0),
  recoveryRate: createPercentage(1),
  retries: 0,
};
const quality: QualityMetric = {
  dimension: 'quality',
  toolSelectionAccuracy: createPercentage(1),
  parameterAccuracy: createPercentage(1),
};

const allDimensions: MetricDimension[] = [
  performance,
  efficiency,
  cost,
  robustness,
  quality,
];

describe('DefaultProcessViabilityCalculator', () => {
  const calc = new DefaultProcessViabilityCalculator();

  test('returns 1.0 for a perfect run', () => {
    const score = calc.compute(allDimensions);
    expect(score.value.value).toBeCloseTo(1, 6);
    expect(score.weights).toEqual(DEFAULT_VIABILITY_WEIGHTS);
    expect(score.version).toBe('1.0.0');
  });

  test('returns 0.0 for a worst-case run', () => {
    const worst: MetricDimension[] = [
      {
        dimension: 'performance',
        taskSuccessRate: createPercentage(0),
        partialCredit: createPercentage(0),
        tasksAttempted: 1,
        tasksPassed: 0,
      },
      {
        dimension: 'efficiency',
        executionTime: createDuration(60 * 60 * 1000),
        latencyPerStep: createDuration(2 * 60 * 1000),
        totalSteps: 1000,
      },
      {
        dimension: 'cost',
        tokens: createTokenCount(2_000_000, 0),
        estimatedCost: createMoney(50),
      },
      {
        dimension: 'robustness',
        toolCallErrorRate: createPercentage(1),
        recoveryRate: createPercentage(0),
        retries: 100,
      },
      {
        dimension: 'quality',
        toolSelectionAccuracy: createPercentage(0),
        parameterAccuracy: createPercentage(0),
      },
    ];
    const score = calc.compute(worst);
    expect(score.value.value).toBeCloseTo(0, 6);
  });

  test('throws MissingDimensionError when a dimension is absent', () => {
    const incomplete = allDimensions.filter((d) => d.dimension !== 'cost');
    expect(() => calc.compute(incomplete)).toThrow(MissingDimensionError);
  });

  test('throws InvalidWeightsError when weights do not sum to 1', () => {
    expect(
      () =>
        new DefaultProcessViabilityCalculator({
          weights: {
            performance: 0.5,
            efficiency: 0.5,
            cost: 0.5,
            robustness: 0,
            quality: 0,
          },
        }),
    ).toThrow(InvalidWeightsError);
  });

  test('is idempotent for the same input', () => {
    const a = calc.compute(allDimensions);
    const b = calc.compute(allDimensions);
    expect(a.value.value).toBe(b.value.value);
  });

  test('respects per-call weight override', () => {
    const score = calc.compute(allDimensions, {
      performance: 1,
      efficiency: 0,
      cost: 0,
      robustness: 0,
      quality: 0,
    });
    expect(score.value.value).toBeCloseTo(1, 6);
  });
});

describe('value-object factories', () => {
  test('createPercentage rejects out-of-range', () => {
    expect(() => createPercentage(-0.1)).toThrow(RangeError);
    expect(() => createPercentage(1.1)).toThrow(RangeError);
    expect(() => createPercentage(Number.NaN)).toThrow(RangeError);
  });

  test('createDuration rejects non-integer or negative', () => {
    expect(() => createDuration(-1)).toThrow(RangeError);
    expect(() => createDuration(1.5)).toThrow(RangeError);
  });

  test('createTokenCount rejects negative or non-integer', () => {
    expect(() => createTokenCount(-1, 0)).toThrow(RangeError);
    expect(() => createTokenCount(0, 1.5)).toThrow(RangeError);
  });

  test('createMoney rounds to 6 decimals and rejects negative', () => {
    expect(createMoney(0.123456789).amount).toBeCloseTo(0.123457, 6);
    expect(() => createMoney(-1)).toThrow(RangeError);
  });
});
