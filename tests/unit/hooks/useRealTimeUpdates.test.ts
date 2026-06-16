import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

// Mock the store
jest.mock('@/store/useDashboardStore', () => ({
  useDashboardStore: () => ({
    setAgents: jest.fn(),
    setEvaluations: jest.fn(),
    setBenchmarks: jest.fn(),
    setLeaderboard: jest.fn(),
    addEvaluation: jest.fn(),
    updateEvaluationProgress: jest.fn(),
    updateAgentStatus: jest.fn(),
  }),
}));

// Mock the API service
jest.mock('@/services/api', () => ({
  apiService: {
    getAgents: jest.fn(),
    getEvaluations: jest.fn(),
    getBenchmarks: jest.fn(),
    getLeaderboard: jest.fn(),
  },
}));

// Mock import.meta.env
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_URL: 'http://localhost:3001/api',
        VITE_WS_URL: 'ws://localhost:3001',
      },
    },
  },
  writable: true,
});

// Mock WebSocket
const mockWebSocket = {
  close: jest.fn(),
  readyState: 1,
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
};

// Mock timers
jest.useFakeTimers();

describe('useRealTimeUpdates', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    originalWebSocket = global.WebSocket;
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any;

    // Mock environment variables
    delete process.env.VITE_WS_URL;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should not initialize when disabled', () => {
      const { apiService } = require('@/services/api');

      renderHook(() => useRealTimeUpdates(false));

      expect(apiService.getAgents).not.toHaveBeenCalled();
      expect(apiService.getEvaluations).not.toHaveBeenCalled();
      expect(apiService.getBenchmarks).not.toHaveBeenCalled();
      expect(apiService.getLeaderboard).not.toHaveBeenCalled();
    });

    it('should initialize when enabled', () => {
      const { apiService } = require('@/services/api');

      // Mock successful API calls
      apiService.getAgents.mockResolvedValue([]);
      apiService.getEvaluations.mockResolvedValue([]);
      apiService.getBenchmarks.mockResolvedValue([]);
      apiService.getLeaderboard.mockResolvedValue([]);

      renderHook(() => useRealTimeUpdates(true));

      expect(apiService.getAgents).toHaveBeenCalled();
      expect(apiService.getEvaluations).toHaveBeenCalled();
      expect(apiService.getBenchmarks).toHaveBeenCalled();
      expect(apiService.getLeaderboard).toHaveBeenCalled();
    });

    it('should use custom WebSocket URL from environment', () => {
      process.env.VITE_WS_URL = 'ws://custom-server:8080';

      renderHook(() => useRealTimeUpdates(true));

      expect(global.WebSocket).toHaveBeenCalledWith('ws://custom-server:8080');
    });

    it('should use default WebSocket URL when no environment variable', () => {
      renderHook(() => useRealTimeUpdates(true));

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3001');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch initial data on mount', async () => {
      const { apiService } = require('@/services/api');
      const mockStore = require('@/store/useDashboardStore').useDashboardStore();

      const mockAgents = [{ id: '1', name: 'Agent 1' }];
      const mockEvaluations = [{ id: '1', status: 'running' }];
      const mockBenchmarks = [{ id: '1', name: 'Benchmark 1' }];
      const mockLeaderboard = [{ agent: 'Agent 1', score: 100 }];

      apiService.getAgents.mockResolvedValue(mockAgents);
      apiService.getEvaluations.mockResolvedValue(mockEvaluations);
      apiService.getBenchmarks.mockResolvedValue(mockBenchmarks);
      apiService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      renderHook(() => useRealTimeUpdates(true));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockStore.setAgents).toHaveBeenCalledWith(mockAgents);
      expect(mockStore.setEvaluations).toHaveBeenCalledWith(mockEvaluations);
      expect(mockStore.setBenchmarks).toHaveBeenCalledWith(mockBenchmarks);
      expect(mockStore.setLeaderboard).toHaveBeenCalledWith(mockLeaderboard);
    });

    it('should handle initial data fetch errors', async () => {
      const { apiService } = require('@/services/api');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      apiService.getAgents.mockRejectedValue(new Error('API Error'));
      apiService.getEvaluations.mockRejectedValue(new Error('API Error'));
      apiService.getBenchmarks.mockRejectedValue(new Error('API Error'));
      apiService.getLeaderboard.mockRejectedValue(new Error('API Error'));

      renderHook(() => useRealTimeUpdates(true));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch initial data:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Lifecycle Management', () => {
    it('should cleanup resources on unmount when enabled', () => {
      const { unmount } = renderHook(() => useRealTimeUpdates(true));

      expect(global.WebSocket).toHaveBeenCalled();

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should not throw errors on unmount when disabled', () => {
      const { unmount } = renderHook(() => useRealTimeUpdates(false));

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle cleanup when disabled after being enabled', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(global.WebSocket).toHaveBeenCalled();

      // Disable the hook
      rerender({ enabled: false });

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should handle re-enabling after disabling', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(global.WebSocket).toHaveBeenCalledTimes(1);

      // Disable the hook
      rerender({ enabled: false });

      // Re-enable the hook
      rerender({ enabled: true });

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock WebSocket to throw
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      }) as any;

      const { apiService } = require('@/services/api');
      apiService.getAgents.mockResolvedValue([]);
      apiService.getEvaluations.mockResolvedValue([]);

      renderHook(() => useRealTimeUpdates(true));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to connect WebSocket:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle WebSocket errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => useRealTimeUpdates(true));

      // Simulate WebSocket error
      if (mockWebSocket.onerror) {
        (mockWebSocket.onerror as any)(new Event('error'));
      }

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle WebSocket disconnection', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() => useRealTimeUpdates(true));

      // Simulate WebSocket close
      if (mockWebSocket.onclose) {
        (mockWebSocket.onclose as any)(new CloseEvent('close'));
      }

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid enable/disable changes', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      // Rapidly toggle enabled state
      rerender({ enabled: false });
      rerender({ enabled: true });
      rerender({ enabled: false });
      rerender({ enabled: true });

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle multiple hook instances', () => {
      const { apiService } = require('@/services/api');
      apiService.getAgents.mockResolvedValue([]);
      apiService.getEvaluations.mockResolvedValue([]);
      apiService.getBenchmarks.mockResolvedValue([]);
      apiService.getLeaderboard.mockResolvedValue([]);

      renderHook(() => useRealTimeUpdates(true));
      renderHook(() => useRealTimeUpdates(true));

      // Should handle multiple instances without conflicts
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should handle polling fallback when WebSocket fails', async () => {
      // Mock WebSocket to fail
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket failed');
      }) as any;

      const { apiService } = require('@/services/api');
      apiService.getAgents.mockResolvedValue([]);
      apiService.getEvaluations.mockResolvedValue([]);

      renderHook(() => useRealTimeUpdates(true));

      // Fast forward to trigger polling
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(apiService.getAgents).toHaveBeenCalledTimes(2); // Initial + poll
      expect(apiService.getEvaluations).toHaveBeenCalledTimes(2);
    });
  });
});