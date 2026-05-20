import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { apiService } from '@/services/api';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

/**
 * ESM-compatible "simple" useRealTimeUpdates tests.
 *
 * Original breakage: in-body `require('@/services/api')` /
 * `require('@/store/useDashboardStore')` (CommonJS, unavailable under Jest's
 * ESM runner) and an `Object.defineProperty(global, 'import', ...)` hack to
 * fake `import.meta.env` (a no-op under ts-jest's ESM transform).
 *
 * Fixes / notes:
 *  - `@/services/api` is mocked via a hoisted factory; the mocked methods are
 *    obtained through a top-level `import { apiService }` and rebuilt in
 *    beforeEach (factory-created jest.fn()s under @jest/globals ESM lack the
 *    `mockResolvedValue` helper, so we replace them with in-test jest.fn()s).
 *  - The store is NOT mocked. Under jest's vm-ESM module registry the hook's
 *    relative `../store/useDashboardStore` import is not intercepted by a
 *    `jest.mock('@/store/useDashboardStore')` factory, so we exercise the REAL
 *    zustand store and assert on `useDashboardStore.getState()` — this is a
 *    stronger behavioral assertion than the original (which compared against a
 *    fresh-per-call mock object that could never match the hook's callbacks).
 *  - The `global.import` hack is removed; `import.meta.env` is undefined under
 *    jest, so the hook uses its 'ws://localhost:3001' fallback.
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

describe('useRealTimeUpdates (simple)', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockApi.getAgents = jest.fn(() => Promise.resolve([]));
    mockApi.getEvaluations = jest.fn(() => Promise.resolve([]));
    mockApi.getBenchmarks = jest.fn(() => Promise.resolve([]));
    mockApi.getLeaderboard = jest.fn(() => Promise.resolve([]));
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
      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    it('should initialize when enabled', () => {
      renderHook(() => useRealTimeUpdates(true));

      expect(mockApi.getAgents).toHaveBeenCalled();
      expect(mockApi.getEvaluations).toHaveBeenCalled();
    });

    it('should open a WebSocket using the default URL fallback', () => {
      renderHook(() => useRealTimeUpdates(true));

      // import.meta.env is undefined under jest, so the hook uses its fallback.
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3001');
    });
  });

  describe('Data Fetching', () => {
    it('should push fetched data into the store on mount', async () => {
      const mockAgents = [{ id: '1', name: 'Agent 1' }] as any;
      const mockEvaluations = [{ id: '1', status: 'running' }] as any;

      mockApi.getAgents = jest.fn(() => Promise.resolve(mockAgents));
      mockApi.getEvaluations = jest.fn(() => Promise.resolve(mockEvaluations));

      renderHook(() => useRealTimeUpdates(true));

      await waitFor(() => expect(useDashboardStore.getState().agents).toEqual(mockAgents));
      expect(useDashboardStore.getState().evaluations).toEqual(mockEvaluations);
    });

    it('should handle initial data fetch errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockApi.getAgents = jest.fn(() => Promise.reject(new Error('API Error')));
      mockApi.getEvaluations = jest.fn(() => Promise.reject(new Error('API Error')));

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

    it('should close the socket when disabled after being enabled', () => {
      const { rerender } = renderHook(({ enabled }) => useRealTimeUpdates(enabled), {
        initialProps: { enabled: true },
      });

      expect(global.WebSocket).toHaveBeenCalled();

      rerender({ enabled: false });

      expect(mockWebSocket.close).toHaveBeenCalled();
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

        // Initial fetch already invoked getAgents/getEvaluations once; advancing
        // the 5s polling interval triggers the fallback poll cycle.
        await act(async () => {
          await jest.advanceTimersByTimeAsync(5000);
        });

        expect(mockApi.getAgents).toHaveBeenCalledTimes(2);
        expect(mockApi.getEvaluations).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
