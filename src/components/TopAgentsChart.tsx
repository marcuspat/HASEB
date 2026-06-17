import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useDashboardStore } from '../store/useDashboardStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const TopAgentsChart: React.FC = () => {
  const { leaderboard } = useDashboardStore();

  // Get top 5 agents
  const topAgents = leaderboard.slice(0, 5);

  // Generate mock data if no real data
  const generateMockData = () => {
    return [
      { name: 'GPT-4 Agent', score: 92.5, successRate: 95 },
      { name: 'Claude-3 Agent', score: 89.2, successRate: 91 },
      { name: 'Gemini Pro', score: 87.8, successRate: 89 },
      { name: 'Custom Agent A', score: 84.1, successRate: 86 },
      { name: 'Custom Agent B', score: 81.3, successRate: 83 },
    ];
  };

  const data = topAgents.length > 0 ? topAgents : generateMockData();

  const chartData = {
    labels: data.map(agent => ('agent' in agent ? agent.agent.name : agent.name)),
    datasets: [
      {
        label: 'Overall Score',
        data: data.map(agent =>
          'agent' in agent ? agent.overallScore : agent.score
        ),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Success Rate',
        data: data.map(agent =>
          'agent' in agent
            ? (agent.metrics?.taskSuccessRate ?? 0) * 100
            : agent.successRate
        ),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#111827',
        bodyColor: '#111827',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    elements: {
      bar: {
        borderWidth: 1,
      },
    },
  };

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Top Performing Agents</h2>
        <p className="text-sm text-gray-600">Overall scores and success rates</p>
      </div>
      <div className="h-64">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default TopAgentsChart;