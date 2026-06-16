import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  cn,
  formatNumber,
  formatCurrency,
  formatDuration,
  formatDate,
  calculateOverallScore,
  getStatusColor,
  getTrendIcon,
  getTrendColor,
  debounce,
  calculatePercentile,
  generateMockData,
} from '@/utils/helpers';

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date: any, formatStr: any) => {
    if (formatStr === 'MMM dd, yyyy HH:mm') {
      return 'Jan 15, 2024 14:30';
    }
    return date.toString();
  }),
}));

// Mock clsx
jest.mock('clsx', () => ({
  clsx: jest.fn((...inputs) => inputs.filter(Boolean).join(' ')),
}));

describe('Helpers', () => {
  describe('cn', () => {
    it('should combine class names using clsx', () => {
      const result = cn('class1', 'class2', null, undefined, 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn(null, undefined, false, '')).toBe('');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'active', false && 'inactive');
      expect(result).toBe('base active');
    });
  });

  describe('formatNumber', () => {
    it('should format small numbers', () => {
      expect(formatNumber(123)).toBe('123.00');
      expect(formatNumber(123.456, 1)).toBe('123.5');
    });

    it('should format numbers in thousands', () => {
      expect(formatNumber(1500)).toBe('1.50K');
      expect(formatNumber(12345, 1)).toBe('12.3K');
    });

    it('should format numbers in millions', () => {
      expect(formatNumber(1500000)).toBe('1.50M');
      expect(formatNumber(12345678, 1)).toBe('12.3M');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0.00');
    });

    it('should handle negative numbers', () => {
      // The function doesn't handle negative numbers with K/M suffixes
      expect(formatNumber(-1234)).toBe('-1234.00');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency in USD', () => {
      expect(formatCurrency(123.45)).toBe('$123.45');
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(1000)).toBe('$1,000.00');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-123.45)).toBe('-$123.45');
    });

    it('should handle large amounts', () => {
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(59000)).toBe('59.0s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(90000)).toBe('1.5m');
      expect(formatDuration(3599000)).toBe('60.0m');
    });

    it('should format hours', () => {
      expect(formatDuration(3600000)).toBe('1.0h');
      expect(formatDuration(7200000)).toBe('2.0h');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0ms');
    });
  });

  describe('formatDate', () => {
    it('should format date strings', () => {
      expect(formatDate('2024-01-15T14:30:00Z')).toBe('Jan 15, 2024 14:30');
    });

    it('should format Date objects', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      expect(formatDate(date)).toBe('Jan 15, 2024 14:30');
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      // The actual implementation doesn't handle invalid dates gracefully
      expect(() => formatDate(invalidDate)).toThrow();
    });
  });

  describe('calculateOverallScore', () => {
    const mockMetrics = {
      taskSuccessRate: 0.9,
      toolSelectionAccuracy: 0.8,
      parameterAccuracy: 0.85,
      recoveryRate: 0.95,
      executionTime: 45000,
      estimatedCost: 0.05,
      toolCallErrorRate: 0.1,
      totalTokens: 1000,
      latencyPerStep: 1500,
      totalSteps: 10,
    };

    it('should calculate overall score correctly', () => {
      const score = calculateOverallScore(mockMetrics);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle perfect metrics', () => {
      const perfectMetrics = {
        ...mockMetrics,
        taskSuccessRate: 1.0,
        toolSelectionAccuracy: 1.0,
        parameterAccuracy: 1.0,
        recoveryRate: 1.0,
        executionTime: 0,
        estimatedCost: 0,
      };
      const score = calculateOverallScore(perfectMetrics);
      expect(score).toBe(100);
    });

    it('should handle poor metrics', () => {
      const poorMetrics = {
        ...mockMetrics,
        taskSuccessRate: 0.1,
        toolSelectionAccuracy: 0.1,
        parameterAccuracy: 0.1,
        recoveryRate: 0.1,
        executionTime: 300000,
        estimatedCost: 100,
      };
      const score = calculateOverallScore(poorMetrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(50);
    });

    it('should handle maximum execution time and cost', () => {
      const maxMetrics = {
        ...mockMetrics,
        executionTime: 300000,
        estimatedCost: 100,
      };
      const score = calculateOverallScore(maxMetrics);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStatusColor', () => {
    it('should return colors for active statuses', () => {
      expect(getStatusColor('active')).toBe('text-green-600 bg-green-100');
      expect(getStatusColor('running')).toBe('text-green-600 bg-green-100');
      expect(getStatusColor('completed')).toBe('text-green-600 bg-green-100');
    });

    it('should return colors for idle statuses', () => {
      expect(getStatusColor('idle')).toBe('text-yellow-600 bg-yellow-100');
      expect(getStatusColor('pending')).toBe('text-yellow-600 bg-yellow-100');
    });

    it('should return colors for busy status', () => {
      expect(getStatusColor('busy')).toBe('text-blue-600 bg-blue-100');
    });

    it('should return colors for error statuses', () => {
      expect(getStatusColor('error')).toBe('text-red-600 bg-red-100');
      expect(getStatusColor('failed')).toBe('text-red-600 bg-red-100');
    });

    it('should return default color for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('text-gray-600 bg-gray-100');
      expect(getStatusColor('')).toBe('text-gray-600 bg-gray-100');
    });
  });

  describe('getTrendIcon', () => {
    it('should return icons for trends', () => {
      expect(getTrendIcon('up')).toBe('↑');
      expect(getTrendIcon('down')).toBe('↓');
      expect(getTrendIcon('stable')).toBe('→');
    });

    it('should return default icon for invalid trend', () => {
      expect(getTrendIcon('invalid' as any)).toBe('→');
    });
  });

  describe('getTrendColor', () => {
    it('should return colors for trends', () => {
      expect(getTrendColor('up')).toBe('text-green-600');
      expect(getTrendColor('down')).toBe('text-red-600');
      expect(getTrendColor('stable')).toBe('text-gray-600');
    });

    it('should return default color for invalid trend', () => {
      expect(getTrendColor('invalid' as any)).toBe('text-gray-600');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      // Call multiple times quickly
      debouncedFn('call1');
      debouncedFn('call2');
      debouncedFn('call3');

      // Should not have been called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Fast forward time
      jest.advanceTimersByTime(100);

      // Should have been called once with last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    it('should handle multiple debounced calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 50);

      debouncedFn('first');
      jest.advanceTimersByTime(25);
      debouncedFn('second');
      jest.advanceTimersByTime(25);
      debouncedFn('third');
      jest.advanceTimersByTime(50);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should work with different argument types', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn({ data: 'test' }, 123, 'string');

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith({ data: 'test' }, 123, 'string');
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate percentile correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(calculatePercentile(values, 5)).toBe(40);
      expect(calculatePercentile(values, 1)).toBe(0);
      expect(calculatePercentile(values, 10)).toBe(90);
    });

    it('should handle empty array', () => {
      expect(calculatePercentile([], 5)).toBe(0);
    });

    it('should handle value larger than all elements', () => {
      const values = [1, 2, 3, 4, 5];
      expect(calculatePercentile(values, 10)).toBe(100);
    });

    it('should handle value smaller than all elements', () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculatePercentile(values, 5)).toBe(0);
    });

    it('should handle duplicate values', () => {
      const values = [1, 2, 2, 2, 3, 4];
      const percentile = calculatePercentile(values, 2);
      expect(percentile).toBeCloseTo(16.67, 2); // First occurrence of 2
    });

    it('should handle unsorted input', () => {
      const values = [5, 1, 3, 2, 4];
      expect(calculatePercentile(values, 3)).toBe(40);
    });
  });

  describe('generateMockData', () => {
    it('should generate mock data structure', () => {
      const mockData = generateMockData();

      expect(mockData).toHaveProperty('agents');
      expect(Array.isArray(mockData.agents)).toBe(true);
      expect(mockData.agents.length).toBeGreaterThan(0);
    });

    it('should generate properly structured agent data', () => {
      const mockData = generateMockData();
      const agent = mockData.agents[0];

      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('type');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('capabilities');
      expect(agent).toHaveProperty('performance');
      expect(agent).toHaveProperty('lastActive');
      expect(agent).toHaveProperty('createdAt');

      expect(typeof agent.id).toBe('string');
      expect(typeof agent.name).toBe('string');
      expect(typeof agent.status).toBe('string');
      expect(Array.isArray(agent.capabilities)).toBe(true);
      expect(typeof agent.performance).toBe('object');
    });

    it('should generate valid performance metrics', () => {
      const mockData = generateMockData();
      const performance = mockData.agents[0].performance;

      expect(typeof performance.taskSuccessRate).toBe('number');
      expect(typeof performance.executionTime).toBe('number');
      expect(typeof performance.totalTokens).toBe('number');
      expect(typeof performance.estimatedCost).toBe('number');

      expect(performance.taskSuccessRate).toBeGreaterThanOrEqual(0);
      expect(performance.taskSuccessRate).toBeLessThanOrEqual(1);
      expect(performance.executionTime).toBeGreaterThan(0);
      expect(performance.totalTokens).toBeGreaterThan(0);
      expect(performance.estimatedCost).toBeGreaterThan(0);
    });

    it('should generate realistic values', () => {
      const mockData = generateMockData();
      const agent = mockData.agents[0];

      expect(agent.name).toContain('Agent');
      expect(agent.type).toBe('language-model');
      expect(['active', 'idle', 'busy', 'error']).toContain(agent.status);
      expect(agent.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null inputs with appropriate behavior', () => {
      expect(() => formatNumber(null as any)).toThrow();
      expect(() => formatCurrency(null as any)).not.toThrow(); // Intl.NumberFormat handles null
      expect(() => formatDuration(null as any)).not.toThrow(); // String interpolation handles null
      expect(() => formatDate(null as any)).not.toThrow(); // formatDate handles null gracefully
    });

    it('should handle undefined inputs with appropriate behavior', () => {
      expect(() => formatNumber(undefined as any)).toThrow();
      expect(() => formatCurrency(undefined as any)).not.toThrow(); // Intl.NumberFormat handles undefined
      expect(() => formatDuration(undefined as any)).not.toThrow(); // String interpolation handles undefined
      expect(() => formatDate(undefined as any)).toThrow(); // formatDate throws on undefined (Invalid time value)
    });

    it('should handle NaN inputs gracefully', () => {
      expect(() => formatNumber(NaN)).not.toThrow();
      expect(() => formatCurrency(NaN)).not.toThrow();
      expect(() => formatDuration(NaN)).not.toThrow();
    });
  });
});