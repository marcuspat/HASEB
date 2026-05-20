import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ApiService, apiService } from '@/services/api';

/**
 * ESM-compatible ApiService tests.
 *
 * The previous suite asserted a fictional ApiService surface (constructor
 * options, generic get/post/put/patch/delete/upload, retry, cache, and
 * request/response interceptors) that the real implementation never had. The
 * real ApiService is a thin REST client built on `fetch` against
 * `import.meta.env.VITE_API_URL || 'http://localhost:3001/api'` with a private
 * `request()` helper and domain methods (getAgents, getEvaluations, etc.).
 *
 * These tests mock the global `fetch` and validate the real observable
 * behavior of those domain methods: the URL/method/headers used, response
 * shaping/parsing, and error propagation on non-ok responses.
 */

const API_BASE = 'http://localhost:3001/api';

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(body),
  headers: new Headers(),
});

describe('ApiService', () => {
  let service: ApiService;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new ApiService();
    fetchMock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Module surface', () => {
    it('should export an ApiService class and a singleton instance', () => {
      expect(typeof ApiService).toBe('function');
      expect(apiService).toBeInstanceOf(ApiService);
    });

    it('should construct without arguments', () => {
      expect(new ApiService()).toBeInstanceOf(ApiService);
    });
  });

  describe('getAgents', () => {
    it('should GET /agents with JSON content-type header', async () => {
      fetchMock.mockResolvedValue(okResponse({ data: [] }) as Response);

      await service.getAgents();

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/agents`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('should parse stringified capabilities/configuration and attach default performance', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          data: [
            {
              id: 'a1',
              name: 'Agent 1',
              capabilities: JSON.stringify(['code-gen']),
              configuration: JSON.stringify({ model: 'opus' }),
              createdAt: '2026-01-01',
              updatedAt: '2026-01-02',
            },
          ],
        }) as Response
      );

      const agents = await service.getAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].capabilities).toEqual(['code-gen']);
      expect(agents[0].configuration).toEqual({ model: 'opus' });
      expect(agents[0].performance.taskSuccessRate).toBe(0);
      expect(agents[0].lastActive).toBe('2026-01-02');
    });

    it('should pass through already-parsed capabilities/configuration', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          data: [
            {
              id: 'a2',
              capabilities: ['debug'],
              configuration: { temperature: 0.2 },
              createdAt: 'c',
              updatedAt: 'u',
            },
          ],
        }) as Response
      );

      const agents = await service.getAgents();
      expect(agents[0].capabilities).toEqual(['debug']);
      expect(agents[0].configuration).toEqual({ temperature: 0.2 });
    });
  });

  describe('getAgent', () => {
    it('should GET /agents/:id', async () => {
      fetchMock.mockResolvedValue(okResponse({ id: 'a1' }) as Response);

      const agent = await service.getAgent('a1');

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/agents/a1`, expect.any(Object));
      expect(agent).toEqual({ id: 'a1' });
    });
  });

  describe('updateAgentStatus', () => {
    it('should PATCH /agents/:id/status with the status payload', async () => {
      fetchMock.mockResolvedValue(okResponse(undefined) as Response);

      await service.updateAgentStatus('a1', 'active');

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/agents/a1/status`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' }),
        })
      );
    });
  });

  describe('getEvaluations', () => {
    it('should GET /evaluations and parse nested evaluation fields', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          data: {
            evaluations: [
              {
                id: 'e1',
                agentId: 'a1',
                metrics: JSON.stringify({ taskSuccessRate: 0.5 }),
                logs: JSON.stringify(['line']),
                configuration: JSON.stringify({ retries: 1 }),
              },
            ],
          },
        }) as Response
      );

      const evaluations = await service.getEvaluations();

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/evaluations`, expect.any(Object));
      expect(evaluations[0].metrics).toEqual({ taskSuccessRate: 0.5 });
      expect(evaluations[0].logs).toEqual(['line']);
      expect(evaluations[0].configuration).toEqual({ retries: 1 });
    });
  });

  describe('createEvaluation', () => {
    it('should POST /evaluations with the serialized body', async () => {
      const payload = { agentId: 'a1', benchmarkType: 'swe-bench' } as any;
      fetchMock.mockResolvedValue(okResponse({ id: 'e1' }) as Response);

      await service.createEvaluation(payload);

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/evaluations`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('updateEvaluationProgress', () => {
    it('should PATCH /evaluations/:id/progress', async () => {
      fetchMock.mockResolvedValue(okResponse(undefined) as Response);

      await service.updateEvaluationProgress('e1', 42);

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/evaluations/e1/progress`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ progress: 42 }),
        })
      );
    });
  });

  describe('getBenchmarks', () => {
    it('should GET /benchmarks and map isActive numeric flag to boolean', async () => {
      fetchMock.mockResolvedValue(
        okResponse({
          data: [
            { id: 'b1', name: 'SWE', isActive: 1, updatedAt: '2026-01-03' },
            { id: 'b2', name: 'GAIA', isActive: 0, updatedAt: '2026-01-04' },
          ],
        }) as Response
      );

      const benchmarks = await service.getBenchmarks();

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/benchmarks`, expect.any(Object));
      expect(benchmarks[0].isActive).toBe(true);
      expect(benchmarks[1].isActive).toBe(false);
      expect(benchmarks[0].totalTasks).toBe(50);
      expect(benchmarks[0].lastRun).toBe('2026-01-03');
    });
  });

  describe('runBenchmark', () => {
    it('should POST /benchmarks/:id/run with the agentId', async () => {
      fetchMock.mockResolvedValue(okResponse({ id: 'e1' }) as Response);

      await service.runBenchmark('b1', 'a1');

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/benchmarks/b1/run`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ agentId: 'a1' }),
        })
      );
    });
  });

  describe('getMetrics', () => {
    it('should GET agent metrics without query string when no time range', async () => {
      fetchMock.mockResolvedValue(okResponse([]) as Response);

      await service.getMetrics('a1');

      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/agents/a1/metrics`, expect.any(Object));
    });

    it('should append timeRange query param when provided', async () => {
      fetchMock.mockResolvedValue(okResponse([]) as Response);

      await service.getMetrics('a1', '7d');

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/agents/a1/metrics?timeRange=7d`,
        expect.any(Object)
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should derive leaderboard entries from agents and evaluations, sorted by score', async () => {
      // request() is called for /agents then /evaluations inside getLeaderboard.
      fetchMock.mockImplementation((input: any) => {
        const url = String(input);
        if (url.endsWith('/agents')) {
          return Promise.resolve(
            okResponse({
              data: [
                { id: 'a1', name: 'A1', capabilities: [], configuration: {}, createdAt: 'c', updatedAt: 'u' },
                { id: 'a2', name: 'A2', capabilities: [], configuration: {}, createdAt: 'c', updatedAt: 'u' },
              ],
            }) as Response
          );
        }
        return Promise.resolve(okResponse({ data: { evaluations: [] } }) as Response);
      });

      const leaderboard = await service.getLeaderboard();

      expect(leaderboard.length).toBeGreaterThan(0);
      for (let i = 0; i < leaderboard.length - 1; i++) {
        expect(leaderboard[i].overallScore).toBeGreaterThanOrEqual(leaderboard[i + 1].overallScore);
      }
      leaderboard.forEach((entry) => {
        expect(entry.agent).toBeDefined();
        expect(entry.benchmark).toBeDefined();
        expect(typeof entry.overallScore).toBe('number');
      });
    });
  });

  describe('subscribeToUpdates', () => {
    it('should resolve without performing a fetch (placeholder implementation)', async () => {
      await expect(service.subscribeToUpdates(() => {})).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should throw a formatted API Error on a non-ok response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response);

      await expect(service.getAgent('missing')).rejects.toThrow('API Error: 404 Not Found');
    });

    it('should propagate network errors from fetch', async () => {
      fetchMock.mockRejectedValue(new Error('Network down'));

      await expect(service.getAgent('a1')).rejects.toThrow('Network down');
    });
  });
});
