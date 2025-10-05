import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Filter, Download, RefreshCw } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { formatDate, formatCurrency, formatDuration, getTrendIcon, getTrendColor, cn } from '../utils/helpers';

const LeaderboardPage: React.FC = () => {
  const { leaderboard, filters, setFilters } = useDashboardStore();
  const [sortBy, setSortBy] = React.useState<'overallScore' | 'successRate' | 'cost' | 'speed'>('overallScore');
  const [timeRange, setTimeRange] = React.useState('7d');

  const getRankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    switch (sortBy) {
      case 'overallScore':
        return b.overallScore - a.overallScore;
      case 'successRate':
        return b.metrics.taskSuccessRate - a.metrics.taskSuccessRate;
      case 'cost':
        return a.metrics.estimatedCost - b.metrics.estimatedCost;
      case 'speed':
        return a.metrics.executionTime - b.metrics.executionTime;
      default:
        return b.overallScore - a.overallScore;
    }
  });

  const handleExport = () => {
    // In a real implementation, this would export the leaderboard data
    console.log('Exporting leaderboard data...');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Compare agent performance across different benchmarks
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn btn-secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button onClick={handleExport} className="btn btn-secondary">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Benchmark Type
              </label>
              <select
                value={filters.benchmarkType}
                onChange={(e) => setFilters({ benchmarkType: e.target.value })}
                className="select-field"
              >
                <option value="all">All Benchmarks</option>
                <option value="swe-bench">SWE-Bench</option>
                <option value="gaia">GAIA</option>
                <option value="osworld">OSWorld</option>
                <option value="webarena">WebArena</option>
                <option value="agentbench">AgentBench</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Agent Type
              </label>
              <select
                value={filters.agentType}
                onChange={(e) => setFilters({ agentType: e.target.value })}
                className="select-field"
              >
                <option value="all">All Agents</option>
                <option value="language-model">Language Models</option>
                <option value="multi-modal">Multi-Modal</option>
                <option value="specialized">Specialized</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="select-field"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="select-field"
              >
                <option value="overallScore">Overall Score</option>
                <option value="successRate">Success Rate</option>
                <option value="cost">Cost (Low to High)</option>
                <option value="speed">Speed (Fast to Slow)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Benchmark
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overall Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLeaderboard.map((entry) => (
                <tr key={`${entry.agent.id}-${entry.benchmark.id}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-900">
                        {getRankMedal(entry.rank)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {entry.agent.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.agent.type}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {entry.benchmark.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {entry.benchmark.type}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {entry.overallScore.toFixed(1)}
                      </span>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${entry.overallScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(entry.metrics.taskSuccessRate * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatCurrency(entry.metrics.estimatedCost)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDuration(entry.metrics.executionTime)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={cn('flex items-center', getTrendColor(entry.trend))}>
                      <span className="text-sm">{getTrendIcon(entry.trend)}</span>
                      <span className="ml-1 text-sm font-medium">
                        {entry.trend === 'up' ? '+2.3%' : entry.trend === 'down' ? '-1.1%' : '0%'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {sortedLeaderboard.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No leaderboard data</h3>
            <p className="text-gray-600">
              Run some evaluations to see agent rankings
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Top Performer</h3>
              <p className="text-sm text-gray-600">
                {sortedLeaderboard[0]?.agent.name || 'N/A'} with{' '}
                {sortedLeaderboard[0]?.overallScore.toFixed(1) || '0'} points
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <h3 className="font-medium text-gray-900">Average Score</h3>
              <p className="text-sm text-gray-600">
                {sortedLeaderboard.length > 0
                  ? (sortedLeaderboard.reduce((sum, entry) => sum + entry.overallScore, 0) / sortedLeaderboard.length).toFixed(1)
                  : '0'} points
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <span className="text-blue-600 font-bold text-sm">
                {sortedLeaderboard.length}
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Total Entries</h3>
              <p className="text-sm text-gray-600">
                Agent-benchmark combinations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;