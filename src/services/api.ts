import { Agent, Evaluation, Benchmark, LeaderboardEntry, PerformanceMetrics } from '../types';

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    const response = await this.request<{ data: any[] }>('/agents');
    return response.data.map(agent => ({
      ...agent,
      capabilities: typeof agent.capabilities === 'string'
        ? JSON.parse(agent.capabilities)
        : agent.capabilities,
      configuration: typeof agent.configuration === 'string'
        ? JSON.parse(agent.configuration)
        : agent.configuration,
      performance: {
        taskSuccessRate: 0,
        executionTime: 0,
        latencyPerStep: 0,
        totalSteps: 0,
        totalTokens: 0,
        estimatedCost: 0,
        toolCallErrorRate: 0,
        recoveryRate: 0,
        toolSelectionAccuracy: 0,
        parameterAccuracy: 0,
      },
      lastActive: agent.updatedAt,
      createdAt: agent.createdAt,
    }));
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`);
  }

  async updateAgentStatus(id: string, status: Agent['status']): Promise<void> {
    await this.request<void>(`/agents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Evaluations
  async getEvaluations(): Promise<Evaluation[]> {
    const response = await this.request<{ data: { evaluations: any[] } }>('/evaluations');
    return response.data.evaluations.map(evaluation => ({
      ...evaluation,
      metrics: typeof evaluation.metrics === 'string'
        ? JSON.parse(evaluation.metrics)
        : evaluation.metrics,
      logs: typeof evaluation.logs === 'string'
        ? JSON.parse(evaluation.logs)
        : evaluation.logs,
      configuration: typeof evaluation.configuration === 'string'
        ? JSON.parse(evaluation.configuration)
        : evaluation.configuration,
    }));
  }

  async createEvaluation(evaluation: Omit<Evaluation, 'id' | 'startTime'>): Promise<Evaluation> {
    return this.request<Evaluation>('/evaluations', {
      method: 'POST',
      body: JSON.stringify(evaluation),
    });
  }

  async getEvaluation(id: string): Promise<Evaluation> {
    return this.request<Evaluation>(`/evaluations/${id}`);
  }

  async updateEvaluationProgress(id: string, progress: number): Promise<void> {
    await this.request<void>(`/evaluations/${id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ progress }),
    });
  }

  // Benchmarks
  async getBenchmarks(): Promise<Benchmark[]> {
    const response = await this.request<{ data: any[] }>('/benchmarks');
    return response.data.map(benchmark => ({
      ...benchmark,
      totalTasks: 50, // Default value
      completedTasks: Math.floor(Math.random() * 50), // Random completed tasks
      difficulty: ['easy', 'medium', 'hard', 'expert'][Math.floor(Math.random() * 4)] as any,
      isActive: benchmark.isActive === 1,
      lastRun: benchmark.updatedAt,
    }));
  }

  async getBenchmark(id: string): Promise<Benchmark> {
    return this.request<Benchmark>(`/benchmarks/${id}`);
  }

  async runBenchmark(benchmarkId: string, agentId: string): Promise<Evaluation> {
    return this.request<Evaluation>(`/benchmarks/${benchmarkId}/run`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  }

  // Leaderboard
  async getLeaderboard(filters?: {
    benchmarkType?: string;
    agentType?: string;
    limit?: number;
  }): Promise<LeaderboardEntry[]> {
    // Since leaderboard endpoint doesn't exist yet, return mock data
    // based on the agents and evaluations we have
    const agentsResponse = await this.getAgents();
    const evaluationsResponse = await this.getEvaluations();

    // Create mock leaderboard data
    const leaderboard: LeaderboardEntry[] = agentsResponse.slice(0, 5).map((agent, index) => {
      const agentEvaluations = evaluationsResponse.filter(e => e.agentId === agent.id);
      const avgSuccessRate = agentEvaluations.length > 0
        ? agentEvaluations.reduce((sum, eval_) => sum + (eval_.metrics?.taskSuccessRate || 0), 0) / agentEvaluations.length
        : Math.random() * 0.5 + 0.5; // Random between 0.5-1.0

      const avgCost = agentEvaluations.length > 0
        ? agentEvaluations.reduce((sum, eval_) => sum + (eval_.metrics?.estimatedCost || 0), 0) / agentEvaluations.length
        : Math.random() * 0.2 + 0.05; // Random between $0.05-$0.25

      return {
        rank: index + 1,
        agent: agent,
        metrics: {
          taskSuccessRate: avgSuccessRate,
          executionTime: Math.random() * 10000000 + 1000000, // 1-11 seconds
          latencyPerStep: Math.random() * 200 + 50, // 50-250ms
          totalSteps: Math.floor(Math.random() * 100) + 20, // 20-120 steps
          totalTokens: Math.floor(Math.random() * 20000) + 5000, // 5k-25k tokens
          estimatedCost: avgCost,
          toolCallErrorRate: Math.random() * 0.2, // 0-20%
          recoveryRate: Math.random() * 0.3 + 0.7, // 70-100%
          toolSelectionAccuracy: Math.random() * 0.3 + 0.7, // 70-100%
          parameterAccuracy: Math.random() * 0.2 + 0.8, // 80-100%
        },
        benchmark: {
          id: `bench-${index + 1}`,
          name: ['SWE-Bench', 'GAIA', 'OSWorld', 'WebArena', 'AgentBench'][index],
          type: ['swe-bench', 'gaia', 'osworld', 'webarena', 'agentbench'][index] as any,
          description: `Benchmark ${index + 1}`,
          totalTasks: 50,
          completedTasks: Math.floor(Math.random() * 50),
          difficulty: ['easy', 'medium', 'hard', 'expert'][Math.floor(Math.random() * 4)] as any,
          isActive: true,
          lastRun: new Date().toISOString(),
        },
        overallScore: avgSuccessRate * 100,
        trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
      };
    });

    // Sort by overall score
    return leaderboard.sort((a, b) => b.overallScore - a.overallScore);
  }

  // Metrics
  async getMetrics(agentId: string, timeRange?: string): Promise<PerformanceMetrics[]> {
    const params = new URLSearchParams();
    if (timeRange) params.append('timeRange', timeRange);

    const queryString = params.toString();
    return this.request<PerformanceMetrics[]>(`/agents/${agentId}/metrics${queryString ? `?${queryString}` : ''}`);
  }

  // Real-time updates (WebSocket connection would be handled separately)
  async subscribeToUpdates(callback: (data: any) => void): Promise<void> {
    // In a real implementation, this would establish a WebSocket connection
    console.log('WebSocket subscription would be established here');
  }
}

export const apiService = new ApiService();