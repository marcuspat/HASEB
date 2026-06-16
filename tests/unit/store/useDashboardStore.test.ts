import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useDashboardStore } from '@/store/useDashboardStore';
import type { Agent, Evaluation, Benchmark, LeaderboardEntry } from '@/types';

// Mock the types for testing
const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  type: 'language-model',
  status: 'active',
  capabilities: ['code-generation'],
  performance: {
    taskSuccessRate: 0.9,
    executionTime: 5000,
    latencyPerStep: 500,
    totalSteps: 10,
    totalTokens: 1000,
    estimatedCost: 0.05,
    toolCallErrorRate: 0.02,
    recoveryRate: 0.98,
    toolSelectionAccuracy: 0.92,
    parameterAccuracy: 0.88,
  },
  lastActive: '2024-01-15T10:30:00Z',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockEvaluation: Evaluation = {
  id: 'eval-1',
  agentId: 'agent-1',
  benchmarkId: 'benchmark-1',
  status: 'running',
  configuration: {
    timeout: 30000,
    environment: 'test',
  },
  logs: [],
  progress: 0.5,
};

const mockBenchmark: Benchmark = {
  id: 'benchmark-1',
  name: 'Test Benchmark',
  type: 'swe-bench',
  description: 'A test benchmark',
  totalTasks: 100,
  completedTasks: 50,
  difficulty: 'medium',
  isActive: true,
};

const mockLeaderboardEntry: LeaderboardEntry = {
  rank: 1,
  agent: mockAgent,
  metrics: mockAgent.performance!,
  benchmark: mockBenchmark,
  overallScore: 92.5,
  trend: 'up',
};

describe('useDashboardStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    const { result } = renderHook(() => useDashboardStore());
    act(() => {
      result.current.setAgents([]);
      result.current.setEvaluations([]);
      result.current.setBenchmarks([]);
      result.current.setLeaderboard([]);
      result.current.setFilters({
        benchmarkType: 'all',
        agentType: 'all',
        status: 'all',
        difficulty: 'all',
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      });
      result.current.setLoading(false);
      result.current.setError(null);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.agents).toEqual([]);
      expect(result.current.evaluations).toEqual([]);
      expect(result.current.benchmarks).toEqual([]);
      expect(result.current.leaderboard).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.realTimeUpdates).toBe(true);
      expect(result.current.filters.benchmarkType).toBe('all');
      expect(result.current.filters.agentType).toBe('all');
      expect(result.current.filters.status).toBe('all');
      expect(result.current.filters.difficulty).toBe('all');
      expect(result.current.filters.dateRange).toBeDefined();
    });
  });

  describe('setAgents', () => {
    it('should set agents correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setAgents([mockAgent]);
      });

      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0]).toEqual(mockAgent);
    });

    it('should overwrite existing agents', () => {
      const { result } = renderHook(() => useDashboardStore());
      const secondAgent = { ...mockAgent, id: 'agent-2', name: 'Second Agent' };

      act(() => {
        result.current.setAgents([mockAgent]);
      });
      expect(result.current.agents).toHaveLength(1);

      act(() => {
        result.current.setAgents([secondAgent]);
      });
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].id).toBe('agent-2');
    });

    it('should handle empty agents array', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setAgents([mockAgent]);
      });
      expect(result.current.agents).toHaveLength(1);

      act(() => {
        result.current.setAgents([]);
      });
      expect(result.current.agents).toEqual([]);
    });
  });

  describe('setEvaluations', () => {
    it('should set evaluations correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setEvaluations([mockEvaluation]);
      });

      expect(result.current.evaluations).toHaveLength(1);
      expect(result.current.evaluations[0]).toEqual(mockEvaluation);
    });

    it('should handle multiple evaluations', () => {
      const { result } = renderHook(() => useDashboardStore());
      const secondEvaluation = { ...mockEvaluation, id: 'eval-2', agentId: 'agent-2' };

      act(() => {
        result.current.setEvaluations([mockEvaluation, secondEvaluation]);
      });

      expect(result.current.evaluations).toHaveLength(2);
      expect(result.current.evaluations[0].id).toBe('eval-1');
      expect(result.current.evaluations[1].id).toBe('eval-2');
    });
  });

  describe('setBenchmarks', () => {
    it('should set benchmarks correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setBenchmarks([mockBenchmark]);
      });

      expect(result.current.benchmarks).toHaveLength(1);
      expect(result.current.benchmarks[0]).toEqual(mockBenchmark);
    });

    it('should handle empty benchmarks array', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setBenchmarks([mockBenchmark]);
      });
      expect(result.current.benchmarks).toHaveLength(1);

      act(() => {
        result.current.setBenchmarks([]);
      });
      expect(result.current.benchmarks).toEqual([]);
    });
  });

  describe('setLeaderboard', () => {
    it('should set leaderboard correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setLeaderboard([mockLeaderboardEntry]);
      });

      expect(result.current.leaderboard).toHaveLength(1);
      expect(result.current.leaderboard[0]).toEqual(mockLeaderboardEntry);
    });

    it('should handle multiple leaderboard entries', () => {
      const { result } = renderHook(() => useDashboardStore());
      const secondEntry = { ...mockLeaderboardEntry, rank: 2, agent: { ...mockAgent, id: 'agent-2' } };

      act(() => {
        result.current.setLeaderboard([mockLeaderboardEntry, secondEntry]);
      });

      expect(result.current.leaderboard).toHaveLength(2);
      expect(result.current.leaderboard[0].rank).toBe(1);
      expect(result.current.leaderboard[1].rank).toBe(2);
    });
  });

  describe('setFilters', () => {
    it('should update filters correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setFilters({
          benchmarkType: 'swe-bench',
          agentType: 'language-model',
        });
      });

      expect(result.current.filters.benchmarkType).toBe('swe-bench');
      expect(result.current.filters.agentType).toBe('language-model');
      expect(result.current.filters.status).toBe('all'); // Should remain unchanged
      expect(result.current.filters.difficulty).toBe('all'); // Should remain unchanged
    });

    it('should merge with existing filters', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setFilters({ benchmarkType: 'swe-bench' });
      });
      expect(result.current.filters.benchmarkType).toBe('swe-bench');

      act(() => {
        result.current.setFilters({ status: 'completed' });
      });
      expect(result.current.filters.benchmarkType).toBe('swe-bench'); // Should remain
      expect(result.current.filters.status).toBe('completed');
    });

    it('should update date range', () => {
      const { result } = renderHook(() => useDashboardStore());
      const newDateRange = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      };

      act(() => {
        result.current.setFilters({ dateRange: newDateRange });
      });

      expect(result.current.filters.dateRange).toEqual(newDateRange);
    });
  });

  describe('setLoading', () => {
    it('should set loading state correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });
      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError('Something went wrong');
      });
      expect(result.current.error).toBe('Something went wrong');

      act(() => {
        result.current.setError(null);
      });
      expect(result.current.error).toBeNull();
    });

    it('should handle empty error string', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setError('');
      });
      expect(result.current.error).toBe('');
    });
  });

  describe('toggleRealTimeUpdates', () => {
    it('should toggle real-time updates correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.realTimeUpdates).toBe(true);

      act(() => {
        result.current.toggleRealTimeUpdates();
      });
      expect(result.current.realTimeUpdates).toBe(false);

      act(() => {
        result.current.toggleRealTimeUpdates();
      });
      expect(result.current.realTimeUpdates).toBe(true);
    });
  });

  describe('updateAgentStatus', () => {
    it('should update agent status correctly', () => {
      const { result } = renderHook(() => useDashboardStore());
      const secondAgent = { ...mockAgent, id: 'agent-2', status: 'idle' as const };

      act(() => {
        result.current.setAgents([mockAgent, secondAgent]);
      });
      expect(result.current.agents[0].status).toBe('active');
      expect(result.current.agents[1].status).toBe('idle');

      act(() => {
        result.current.updateAgentStatus('agent-1', 'busy');
      });
      expect(result.current.agents[0].status).toBe('busy');
      expect(result.current.agents[1].status).toBe('idle'); // Should remain unchanged
    });

    it('should handle updating non-existent agent', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setAgents([mockAgent]);
      });
      expect(result.current.agents).toHaveLength(1);

      act(() => {
        result.current.updateAgentStatus('non-existent', 'busy');
      });
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].status).toBe('active'); // Should remain unchanged
    });

    it('should handle empty agents array', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.agents).toEqual([]);

      act(() => {
        result.current.updateAgentStatus('agent-1', 'busy');
      });
      expect(result.current.agents).toEqual([]);
    });
  });

  describe('addEvaluation', () => {
    it('should add evaluation correctly', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setEvaluations([mockEvaluation]);
      });
      expect(result.current.evaluations).toHaveLength(1);

      const newEvaluation = { ...mockEvaluation, id: 'eval-2', agentId: 'agent-2' };

      act(() => {
        result.current.addEvaluation(newEvaluation);
      });
      expect(result.current.evaluations).toHaveLength(2);
      expect(result.current.evaluations[1]).toEqual(newEvaluation);
    });

    it('should add evaluation to empty list', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.evaluations).toEqual([]);

      act(() => {
        result.current.addEvaluation(mockEvaluation);
      });
      expect(result.current.evaluations).toHaveLength(1);
      expect(result.current.evaluations[0]).toEqual(mockEvaluation);
    });
  });

  describe('updateEvaluationProgress', () => {
    it('should update evaluation progress correctly', () => {
      const { result } = renderHook(() => useDashboardStore());
      const secondEvaluation = { ...mockEvaluation, id: 'eval-2', progress: 0.3 };

      act(() => {
        result.current.setEvaluations([mockEvaluation, secondEvaluation]);
      });
      expect(result.current.evaluations[0].progress).toBe(0.5);
      expect(result.current.evaluations[1].progress).toBe(0.3);

      act(() => {
        result.current.updateEvaluationProgress('eval-1', 0.8);
      });
      expect(result.current.evaluations[0].progress).toBe(0.8);
      expect(result.current.evaluations[1].progress).toBe(0.3); // Should remain unchanged
    });

    it('should handle updating non-existent evaluation', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setEvaluations([mockEvaluation]);
      });
      expect(result.current.evaluations).toHaveLength(1);

      act(() => {
        result.current.updateEvaluationProgress('non-existent', 0.9);
      });
      expect(result.current.evaluations).toHaveLength(1);
      expect(result.current.evaluations[0].progress).toBe(0.5); // Should remain unchanged
    });

    it('should handle empty evaluations array', () => {
      const { result } = renderHook(() => useDashboardStore());

      expect(result.current.evaluations).toEqual([]);

      act(() => {
        result.current.updateEvaluationProgress('eval-1', 0.9);
      });
      expect(result.current.evaluations).toEqual([]);
    });

    it('should handle zero progress', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setEvaluations([mockEvaluation]);
      });

      act(() => {
        result.current.updateEvaluationProgress('eval-1', 0);
      });
      expect(result.current.evaluations[0].progress).toBe(0);
    });

    it('should handle full progress (1.0)', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setEvaluations([mockEvaluation]);
      });

      act(() => {
        result.current.updateEvaluationProgress('eval-1', 1.0);
      });
      expect(result.current.evaluations[0].progress).toBe(1.0);
    });
  });

  describe('Complex State Interactions', () => {
    it('should handle multiple state updates in sequence', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setAgents([mockAgent]);
        result.current.setEvaluations([mockEvaluation]);
        result.current.setBenchmarks([mockBenchmark]);
        result.current.setLoading(true);
        result.current.setError('Initial error');
      });

      expect(result.current.agents).toHaveLength(1);
      expect(result.current.evaluations).toHaveLength(1);
      expect(result.current.benchmarks).toHaveLength(1);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe('Initial error');

      act(() => {
        result.current.setLoading(false);
        result.current.setError(null);
        result.current.updateAgentStatus('agent-1', 'busy');
        result.current.updateEvaluationProgress('eval-1', 0.9);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.agents[0].status).toBe('busy');
      expect(result.current.evaluations[0].progress).toBe(0.9);
    });

    it('should maintain state independence between different instances', () => {
      const { result: result1 } = renderHook(() => useDashboardStore());
      const { result: result2 } = renderHook(() => useDashboardStore());

      act(() => {
        result1.current.setAgents([mockAgent]);
      });
      act(() => {
        result2.current.setAgents([{ ...mockAgent, id: 'agent-different' }]);
      });

      // Zustand uses global state, so both hooks should share the same store
      expect(result1.current.agents[0].id).toBe('agent-different');
      expect(result2.current.agents[0].id).toBe('agent-different');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined filter updates', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setFilters({ benchmarkType: undefined as any });
      });
      expect(result.current.filters.benchmarkType).toBeUndefined();
    });

    it('should handle null and undefined error values', () => {
      const { result } = renderHook(() => useDashboardStore());

      act(() => {
        result.current.setError('test error');
      });
      expect(result.current.error).toBe('test error');

      act(() => {
        result.current.setError(null);
      });
      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError(undefined as any);
      });
      expect(result.current.error).toBeUndefined();
    });

    it('should handle large arrays of data', () => {
      const { result } = renderHook(() => useDashboardStore());
      const manyAgents = Array.from({ length: 1000 }, (_, i) => ({
        ...mockAgent,
        id: `agent-${i}`,
        name: `Agent ${i}`,
      }));

      act(() => {
        result.current.setAgents(manyAgents);
      });
      expect(result.current.agents).toHaveLength(1000);
      expect(result.current.agents[999].name).toBe('Agent 999');
    });
  });

  describe('Performance', () => {
    it('should handle rapid state updates efficiently', () => {
      const { result } = renderHook(() => useDashboardStore());
      const startTime = performance.now();

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.setLoading(i % 2 === 0);
          result.current.setFilters({ benchmarkType: i % 2 === 0 ? 'swe-bench' : 'gaia' });
          if (i % 10 === 0) {
            result.current.setAgents([{ ...mockAgent, id: `agent-${i}` }]);
          }
        }
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      // After the loop completes, i will be 100, so 100 % 2 === 0 (false)
      expect(result.current.isLoading).toBe(false);
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].id).toBe('agent-90'); // Last agent set when i = 90
    });
  });
});