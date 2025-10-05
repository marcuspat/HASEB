import { create } from 'zustand';
import { Agent, Evaluation, Benchmark, LeaderboardEntry, FilterState } from '../types';

interface DashboardState {
  agents: Agent[];
  evaluations: Evaluation[];
  benchmarks: Benchmark[];
  leaderboard: LeaderboardEntry[];
  filters: FilterState;
  isLoading: boolean;
  error: string | null;
  realTimeUpdates: boolean;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setEvaluations: (evaluations: Evaluation[]) => void;
  setBenchmarks: (benchmarks: Benchmark[]) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleRealTimeUpdates: () => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  addEvaluation: (evaluation: Evaluation) => void;
  updateEvaluationProgress: (evaluationId: string, progress: number) => void;
}

const initialFilters: FilterState = {
  benchmarkType: 'all',
  agentType: 'all',
  status: 'all',
  difficulty: 'all',
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  agents: [],
  evaluations: [],
  benchmarks: [],
  leaderboard: [],
  filters: initialFilters,
  isLoading: false,
  error: null,
  realTimeUpdates: true,

  setAgents: (agents) => set({ agents }),

  setEvaluations: (evaluations) => set({ evaluations }),

  setBenchmarks: (benchmarks) => set({ benchmarks }),

  setLeaderboard: (leaderboard) => set({ leaderboard }),

  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  toggleRealTimeUpdates: () => set((state) => ({
    realTimeUpdates: !state.realTimeUpdates
  })),

  updateAgentStatus: (agentId, status) => set((state) => ({
    agents: state.agents.map((agent) =>
      agent.id === agentId ? { ...agent, status } : agent
    )
  })),

  addEvaluation: (evaluation) => set((state) => ({
    evaluations: [...state.evaluations, evaluation]
  })),

  updateEvaluationProgress: (evaluationId, progress) => set((state) => ({
    evaluations: state.evaluations.map((eval_) =>
      eval_.id === evaluationId ? { ...eval_, progress } : eval_
    )
  })),
}));