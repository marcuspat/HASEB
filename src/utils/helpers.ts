import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { PerformanceMetrics } from '../types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  }
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM dd, yyyy HH:mm');
}

export function calculateOverallScore(metrics: PerformanceMetrics): number {
  const weights = {
    taskSuccessRate: 0.3,
    toolSelectionAccuracy: 0.2,
    parameterAccuracy: 0.2,
    recoveryRate: 0.15,
    executionTime: -0.1, // Negative because lower is better
    estimatedCost: -0.05, // Negative because lower is better
  };

  let score = 0;

  // Normalize metrics to 0-1 scale where appropriate
  const normalizedTime = Math.max(0, 1 - metrics.executionTime / 300000); // 5 minutes as max
  const normalizedCost = Math.max(0, 1 - metrics.estimatedCost / 100); // $100 as max

  score += metrics.taskSuccessRate * weights.taskSuccessRate;
  score += metrics.toolSelectionAccuracy * weights.toolSelectionAccuracy;
  score += metrics.parameterAccuracy * weights.parameterAccuracy;
  score += metrics.recoveryRate * weights.recoveryRate;
  score += normalizedTime * Math.abs(weights.executionTime);
  score += normalizedCost * Math.abs(weights.estimatedCost);

  return Math.max(0, Math.min(100, score * 100));
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'running':
    case 'completed':
      return 'text-green-600 bg-green-100';
    case 'idle':
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'busy':
      return 'text-blue-600 bg-blue-100';
    case 'error':
    case 'failed':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'stable':
      return '→';
    default:
      return '→';
  }
}

export function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return 'text-green-600';
    case 'down':
      return 'text-red-600';
    case 'stable':
      return 'text-gray-600';
    default:
      return 'text-gray-600';
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function calculatePercentile(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  if (index === -1) return 100;
  return (index / sorted.length) * 100;
}

export function generateMockData() {
  // Helper function for generating realistic mock data during development
  return {
    agents: [
      {
        id: 'agent-1',
        name: 'GPT-4 Agent',
        type: 'language-model',
        status: 'active' as const,
        capabilities: ['reasoning', 'coding', 'analysis'],
        performance: {
          taskSuccessRate: 0.92,
          executionTime: 45000,
          latencyPerStep: 1500,
          totalSteps: 30,
          totalTokens: 15000,
          estimatedCost: 0.45,
          toolCallErrorRate: 0.05,
          recoveryRate: 0.88,
          toolSelectionAccuracy: 0.94,
          parameterAccuracy: 0.91,
        },
        lastActive: new Date().toISOString(),
        createdAt: '2024-01-15T10:00:00Z',
      },
      // Add more mock agents as needed
    ],
  };
}