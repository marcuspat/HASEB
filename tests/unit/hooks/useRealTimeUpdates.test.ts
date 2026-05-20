import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { apiService } from '@/services/api';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

/**
 * ESM-compatible useRealTimeUpdates tests.
 *
 * Original breakage: in-body `require('@/services/api')` /
 * `require('@/store/useDashboardStore')` (no CommonJS under Jest ESM) and an
 * `Object.defineProperty(global, 'import', ...)` hack for `import.meta.env`
 * (a no-op under ts-jest's ESM transform).
 *
 * Fixes / notes:
 *  - `@/services/api` is mocked via a hoisted factory; mocked methods are
 *    accessed through a top-level import and rebuilt in beforeEach (factory
 *    jest.fn()s under @jest/globals ESM lack mockResolvedValue).
 *  - The store is NOT mocked: under jest's vm-ESM module registry the hook's
 *    relative store import is not intercepted by a `@/store/...` mock factory,
 *    so we drive the REAL zustand store and assert via `getState()`.
 *  - The `global.import` hack is removed.
 *
 * Softened/adjusted assertions (vs. the original) and why:
 *  - The original "use custom WebSocket URL from environment" set
 *    `process.env.VITE_WS_URL`, but the hook reads `import.meta.env.VITE_WS_URL`
 *    (a Vite build-time constant), NOT `process.env`. Under jest `import.meta.env`
 *    is undefined, so the hook ALWAYS uses its 'ws://localhost:3001' fallback.
 *    The custom-URL case is therefore not reachable in this environment; the
 *    test is reframed to assert the real, observable behavior (the fallback URL).
 */

jest.mock('@/services/api', () => ({
  apiService: {
    getAgents: jest.fn(),
    getEvaluations: jest.fn(),
    getBenchmarks: jest.fn(),
    getLeaderboard: jest.fn(),
  },
}));

const mockApi = apiService as unknown as {
  getAgents: jest.Mock;
  getEvaluations: jest.Mock;
  getBenchmarks: jest.Mock;
  getLeaderboard: jest.Mock;
};

const mockWebSocket = {
  close: jest.fn(),
  readyState: 1,
  onopen: null as ((ev: Event) => void) | null,
  onmessage: null as ((ev: MessageEvent) => void) | null,
  onclose: null as ((ev: CloseEvent) => void) | null,
  onerror: null as ((ev: Event) => void) | null,
};

const resetStore = () => {
  useDashboardStore.setState({ agents: [], evaluations: [], benchmarks: [], leaderboard: [] });
};

describe('useRealTimeUpdates', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockApi.getAgents = jest.fn(() => Promise.resolve([]));
    mockApi.getEvaluations = jest.fn(() => Promise.resolve([]));
    mockApi.getBenchmarks = jest.fn(() => Promise.resolve([]));
    mockApi.getLeaderboard = jest.fn(() => Promise.resolve([]));
    mockWebSocket.onopen = null;
    mockWebSocket.onmessage = null;
    mockWebSocket.onclose = null;
    mockWebSocket.onerror = null;
    originalWebSocket = global.WebSocket;
    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });

  describe('Initialization', () => {
    it('should not initialize when disabled', () => {
      renderHook(() => useRealTimeUpdates(false));

      expect(mockApi.getAgents).not.toHaveBeenCalled();
      expect(mockApi.getEvaluations).not.toHaveBeenCalled();
      expect(mockApi.getBenchmarks).not.toHaveBeenCalled();
      expect(mockApi.getLeaderboard).not.toHaveBeenCalled();
    });

    it('should initialize when enabled', () => {
      renderHook(() => useRealTimeUpdates(true));

      expect(mockApi.getAgents).toHaveBeenCalled();
      expect(mockApi.getEvaluations).toHaveBeenCalled();
      expect(mockApi.getBenchmarks).toHaveBeenCalled();
      expect(mockApi.getLeaderboard).toHaveBeenCalled();
    });

    it('should connect the WebSocket using the default URL fallback', () => {
      // The hook reads import.meta.env.VITE_WS_URL (undefined under jest) and
      // falls back to 'ws://localhost:3001'. process.env is intentionally NOT
      // consulted by the hook, so the fallback is the only reachable branch here.
      renderHook(() => useRealTimeUpdates(true));

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3001');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch initial data on mount and populate the store', async () => {
      const mockAgents = [{ id: '1', name: 'Agent 1' }] as any;
      const mockEvaluations = [{ id: '1', status: 'running' }] as any;
      const mockBenchmarks = [{ id: '1', name: 'Benchmark 1' }] as any;
      const mockLeaderboard = [{ agent: 'Agent 1', score: 100 }] as any;

      mockApi.getAgents = jest.fn(() => Promise.resolve(mockAgents));
      mockApi.getEvaluations = jest.fn(() => Promise.resolve(mockEvaluations));
      mockApi.getBenchmarks = jest.fn(() => Promise.resolve(mockBenchmarks));
      mockApi.getLeaderboard = jest.fn(() => Promise.resolve(mockLeaderboard));

      renderHook(() => useRealTimeUpdates(true));

      await waitFor(() => expect(useDashboardStore.getState().agents).toEqual(mockAgents));

      const state = useDashboardStore.getState();
      expect(state.agents).toEqual(mockAgents);
      expect(state.evaluations).toEqual(mockEvaluations);
      expect(state.benchmarks).toEqual(mockBenchmarks);
      expect(state.leaderboard).toEqual(mockLeaderboard);
    });

    it('should handle initial data fetch errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockApi.getAgents = jest.fn(() => Promise.reject(new Error('API Error')));
      mockApi.getEvaluations = jest.fn(() => Promise.reject(new Error('API Error')));
      mockApi.getBenchmarks = jest.fn(() => Promise.reject(new Error('API Error')));
      mockApi.getLeaderboard = jest.fn(() => Promise.reject(new Error('API Error')));

      renderHook(() => useRealTimeUpdates(true));

      await waitFor(() =>
        expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch initial data:', expect.any(Error))
      );

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

      expect(() => unmount()).not.toThrow();
    });

    it('should close the socket when disabled after being enabled', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(global.WebSocket).toHaveBeenCalled();

      rerender({ enabled: false });

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should reconnect when re-enabled after disabling', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(global.WebSocket).toHaveBeenCalledTimes(1);

      rerender({ enabled: false });
      rerender({ enabled: true });

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should log when WebSocket construction fails', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      }) as any;

      renderHook(() => useRealTimeUpdates(true));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to connect WebSocket:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should register and invoke the WebSocket onerror handler', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => useRealTimeUpdates(true));

      expect(typeof mockWebSocket.onerror).toBe('function');

      act(() => {
        mockWebSocket.onerror?.(new Event('error'));
      });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.anything());
      consoleSpy.mockRestore();
    });

    it('should register and invoke the WebSocket onclose handler', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() => useRealTimeUpdates(true));

      expect(typeof mockWebSocket.onclose).toBe('function');

      act(() => {
        mockWebSocket.onclose?.(new CloseEvent('close'));
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid enable/disable changes without throwing', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(() => {
        rerender({ enabled: false });
        rerender({ enabled: true });
        rerender({ enabled: false });
        rerender({ enabled: true });
      }).not.toThrow();
    });

    it('should construct a WebSocket per mounted instance', () => {
      renderHook(() => useRealTimeUpdates(true));
      renderHook(() => useRealTimeUpdates(true));

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should fall back to polling when WebSocket construction fails', async () => {
      jest.useFakeTimers();
      try {
        global.WebSocket = jest.fn().mockImplementation(() => {
          throw new Error('WebSocket failed');
        }) as any;

        renderHook(() => useRealTimeUpdates(true));

        await act(async () => {
          await jest.advanceTimersByTimeAsync(5000);
        });

        // Initial fetch (1) + one polling cycle (1) for the polled endpoints.
        expect(mockApi.getAgents).toHaveBeenCalledTimes(2);
        expect(mockApi.getEvaluations).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
