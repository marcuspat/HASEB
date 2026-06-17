import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the API service completely to avoid import.meta.env issues
jest.mock('@/services/api', () => ({
  apiService: {
    getAgents: jest.fn(() => Promise.resolve([])),
    getEvaluations: jest.fn(() => Promise.resolve([])),
    getBenchmarks: jest.fn(() => Promise.resolve([])),
    getLeaderboard: jest.fn(() => Promise.resolve([])),
  },
}));

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

// Mock import.meta.env at the top level before importing the hook
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

// Import the hook after mocking
const { useRealTimeUpdates } = require('@/hooks/useRealTimeUpdates');

describe('useRealTimeUpdates', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    originalWebSocket = global.WebSocket;
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any;
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
    });

    it('should initialize when enabled', () => {
      const { apiService } = require('@/services/api');

      renderHook(() => useRealTimeUpdates(true));

      expect(apiService.getAgents).toHaveBeenCalled();
      expect(apiService.getEvaluations).toHaveBeenCalled();
    });

    it('should use custom WebSocket URL from environment', () => {
      // Update the import.meta.env mock
      Object.defineProperty((global as any).import.meta.env, 'VITE_WS_URL', {
        value: 'ws://custom-server:8080',
        writable: true,
      });

      renderHook(() => useRealTimeUpdates(true));

      expect(global.WebSocket).toHaveBeenCalledWith('ws://custom-server:8080');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch initial data on mount', async () => {
      const { apiService } = require('@/services/api');
      const mockStore = require('@/store/useDashboardStore').useDashboardStore();

      const mockAgents = [{ id: '1', name: 'Agent 1' }];
      const mockEvaluations = [{ id: '1', status: 'running' }];

      apiService.getAgents.mockResolvedValue(mockAgents);
      apiService.getEvaluations.mockResolvedValue(mockEvaluations);

      renderHook(() => useRealTimeUpdates(true));

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockStore.setAgents).toHaveBeenCalledWith(mockAgents);
      expect(mockStore.setEvaluations).toHaveBeenCalledWith(mockEvaluations);
    });

    it('should handle initial data fetch errors', async () => {
      const { apiService } = require('@/services/api');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      apiService.getAgents.mockRejectedValue(new Error('API Error'));
      apiService.getEvaluations.mockRejectedValue(new Error('API Error'));

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

    it('should handle cleanup when disabled after being enabled', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(global.WebSocket).toHaveBeenCalled();

      // Disable the hook
      rerender({ enabled: false });

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock WebSocket to throw
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      }) as any;

      renderHook(() => useRealTimeUpdates(true));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to connect WebSocket:', expect.any(Error));
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