import React from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Target,
  Download,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { useDashboardStore } from '../store/useDashboardStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const AnalyticsPage: React.FC = () => {
  const { evaluations, benchmarks, agents } = useDashboardStore();

  // Mock data for demonstration
  const performanceTrendData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'],
    datasets: [
      {
        label: 'Success Rate',
        data: [78, 82, 85, 83, 87, 89, 92],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Cost Efficiency',
        data: [65, 68, 72, 75, 78, 81, 84],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const benchmarkDistributionData = {
    labels: ['SWE-Bench', 'GAIA', 'OSWorld', 'WebArena', 'AgentBench'],
    datasets: [
      {
        data: [35, 25, 20, 15, 5],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const costAnalysisData = {
    labels: ['GPT-4', 'Claude-3', 'Gemini', 'Custom A', 'Custom B'],
    datasets: [
      {
        label: 'Average Cost per Evaluation',
        data: [0.85, 0.72, 0.68, 0.91, 0.76],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Success Rate',
        data: [92, 89, 87, 84, 81],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  };

  const handleExportReport = () => {
    console.log('Exporting analytics report...');
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Deep dive into agent performance metrics and trends
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn btn-secondary">
            <Calendar className="h-4 w-4 mr-2" />
            Date Range
          </button>
          <button className="btn btn-secondary">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
          <button onClick={handleExportReport} className="btn btn-primary">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avg Success Rate</p>
              <p className="text-xl font-semibold text-gray-900">87.2%</p>
              <p className="text-xs text-green-600">↑ 3.2% vs last month</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Evaluations</p>
              <p className="text-xl font-semibold text-gray-900">1,247</p>
              <p className="text-xs text-blue-600">↑ 156 vs last month</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avg Cost</p>
              <p className="text-xl font-semibold text-gray-900">$0.78</p>
              <p className="text-xs text-green-600">↓ 5.1% vs last month</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PieChart className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active Agents</p>
              <p className="text-xl font-semibold text-gray-900">{agents.length}</p>
              <p className="text-xs text-purple-600">All performing well</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Trend */}
        <div className="card">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Performance Trend</h3>
            <p className="text-sm text-gray-600">Success rate and cost efficiency over time</p>
          </div>
          <div className="h-80">
            <Line data={performanceTrendData} options={chartOptions} />
          </div>
        </div>

        {/* Benchmark Distribution */}
        <div className="card">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Benchmark Distribution</h3>
            <p className="text-sm text-gray-600">Distribution of evaluation types</p>
          </div>
          <div className="h-80">
            <Pie data={benchmarkDistributionData} options={{
              ...chartOptions,
              plugins: {
                legend: {
                  position: 'right' as const,
                },
              },
            }} />
          </div>
        </div>

        {/* Cost Analysis */}
        <div className="card">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Cost vs Performance</h3>
            <p className="text-sm text-gray-600">Agent cost comparison with success rates</p>
          </div>
          <div className="h-80">
            <Bar data={costAnalysisData} options={{
              ...chartOptions,
              scales: {
                y: {
                  beginAtZero: true,
                },
              },
            }} />
          </div>
        </div>

        {/* Pareto Analysis */}
        <div className="card">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Pareto Analysis</h3>
            <p className="text-sm text-gray-600">Accuracy vs Cost efficiency frontier</p>
          </div>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4" />
              <p>Pareto-optimal analysis chart</p>
              <p className="text-sm mt-2">Coming soon - Accuracy vs Cost visualization</p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="card">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Key Insights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Top Performer</h4>
            <p className="text-sm text-blue-800">
              GPT-4 Agent maintains highest success rate at 92% across all benchmarks
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Cost Optimization</h4>
            <p className="text-sm text-green-800">
              Average evaluation cost decreased by 5.1% this month
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">Most Popular</h4>
            <p className="text-sm text-purple-800">
              SWE-Bench accounts for 35% of all evaluations conducted
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;