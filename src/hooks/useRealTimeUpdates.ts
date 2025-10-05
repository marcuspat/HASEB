import { useEffect, useRef } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { apiService } from '../services/api';

export const useRealTimeUpdates = (enabled: boolean = true) => {
  const {
    setAgents,
    setEvaluations,
    setBenchmarks,
    setLeaderboard,
    addEvaluation,
    updateEvaluationProgress,
    updateAgentStatus,
  } = useDashboardStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Initial data fetch
    const fetchInitialData = async () => {
      try {
        const [agents, evaluations, benchmarks, leaderboard] = await Promise.all([
          apiService.getAgents(),
          apiService.getEvaluations(),
          apiService.getBenchmarks(),
          apiService.getLeaderboard(),
        ]);

        setAgents(agents);
        setEvaluations(evaluations);
        setBenchmarks(benchmarks);
        setLeaderboard(leaderboard);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();

    // WebSocket connection for real-time updates
    const connectWebSocket = () => {
      try {
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRealtimeUpdate(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected, attempting to reconnect...');
          setTimeout(connectWebSocket, 5000);
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        // Fallback to polling
        startPolling();
      }
    };

    // Fallback polling mechanism
    const startPolling = () => {
      if (intervalRef.current) return;

      intervalRef.current = setInterval(async () => {
        try {
          const [agents, evaluations] = await Promise.all([
            apiService.getAgents(),
            apiService.getEvaluations(),
          ]);

          setAgents(agents);
          setEvaluations(evaluations);
        } catch (error) {
          console.error('Failed to poll updates:', error);
        }
      }, 5000); // Poll every 5 seconds
    };

    const handleRealtimeUpdate = (data: any) => {
      switch (data.type) {
        case 'evaluation_started':
          addEvaluation(data.payload);
          break;
        case 'evaluation_progress':
          updateEvaluationProgress(data.payload.id, data.payload.progress);
          break;
        case 'evaluation_completed':
          updateEvaluationProgress(data.payload.id, 100);
          break;
        case 'agent_status_changed':
          updateAgentStatus(data.payload.id, data.payload.status);
          break;
        case 'agents_updated':
          setAgents(data.payload);
          break;
        case 'evaluations_updated':
          setEvaluations(data.payload);
          break;
        case 'benchmarks_updated':
          setBenchmarks(data.payload);
          break;
        case 'leaderboard_updated':
          setLeaderboard(data.payload);
          break;
        default:
          console.log('Unknown update type:', data.type);
      }
    };

    // Try WebSocket first, fallback to polling
    connectWebSocket();

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, setAgents, setEvaluations, setBenchmarks, setLeaderboard, addEvaluation, updateEvaluationProgress, updateAgentStatus]);
};