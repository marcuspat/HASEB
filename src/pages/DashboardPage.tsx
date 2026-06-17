import React from 'react';
import { Activity, Users, Target, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { formatNumber, formatCurrency, formatDuration, calculateOverallScore } from '../utils/helpers';
import MetricCard from '../components/MetricCard';
import RealTimeEvaluations from '../components/RealTimeEvaluations';
import RecentActivityChart from '../components/RecentActivityChart';
import TopAgentsChart from '../components/TopAgentsChart';

const DashboardPage: React.FC = () => {
  const { agents, evaluations, benchmarks, leaderboard } = useDashboardStore();

  // Calculate dashboard metrics
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const runningEvaluations = evaluations.filter(e => e.status === 'running').length;
  const completedEvaluations = evaluations.filter(e => e.status === 'completed').length;
  const activeBenchmarks = benchmarks.filter(b => b.isActive).length;

  // Calculate averages
  const avgSuccessRate = agents.length > 0
    ? agents.reduce((sum, agent) => sum + (agent.performance?.taskSuccessRate ?? 0), 0) / agents.length
    : 0;

  const avgCost = evaluations.length > 0
    ? evaluations.reduce((sum, eval_) => sum + (eval_.metrics?.estimatedCost ?? 0), 0) / evaluations.length
    : 0;

  const avgExecutionTime = evaluations.length > 0
    ? evaluations.reduce((sum, eval_) => sum + (eval_.metrics?.executionTime ?? 0), 0) / evaluations.length
    : 0;

  const topAgents = leaderboard.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor your agentic system evaluation performance and metrics
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Agents"
          value={totalAgents}
          subtitle={`${activeAgents} active`}
          icon={Users}
          trend="up"
          trendValue="12%"
          color="blue"
        />
        <MetricCard
          title="Running Evaluations"
          value={runningEvaluations}
          subtitle={`${completedEvaluations} completed today`}
          icon={Activity}
          trend="up"
          trendValue="8%"
          color="green"
        />
        <MetricCard
          title="Active Benchmarks"
          value={activeBenchmarks}
          subtitle={`${benchmarks.length} total benchmarks`}
          icon={Target}
          trend="stable"
          trendValue="0%"
          color="purple"
        />
        <MetricCard
          title="Avg Success Rate"
          value={`${(avgSuccessRate * 100).toFixed(1)}%`}
          subtitle="Across all agents"
          icon={TrendingUp}
          trend="up"
          trendValue="3.2%"
          color="green"
        />
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Avg Cost per Evaluation"
          value={formatCurrency(avgCost)}
          subtitle="Last 30 days"
          icon={DollarSign}
          trend="down"
          trendValue="5%"
          color="yellow"
        />
        <MetricCard
          title="Avg Execution Time"
          value={formatDuration(avgExecutionTime)}
          subtitle="Per evaluation"
          icon={Clock}
          trend="down"
          trendValue="2%"
          color="blue"
        />
        <MetricCard
          title="Top Performing Agent"
          value={topAgents[0]?.agent.name || 'N/A'}
          subtitle={`Score: ${topAgents[0] ? calculateOverallScore(topAgents[0].metrics).toFixed(1) : 0}`}
          icon={TrendingUp}
          trend="up"
          trendValue="7%"
          color="green"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Chart */}
        <RecentActivityChart />

        {/* Top Agents Performance */}
        <TopAgentsChart />
      </div>

      {/* Real-time Evaluations */}
      <RealTimeEvaluations />
    </div>
  );
};

export default DashboardPage;