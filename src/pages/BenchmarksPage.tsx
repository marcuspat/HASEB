import React from 'react';
import { Plus, Play, Pause, Settings, Download, Clock, CheckCircle, XCircle, Target } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { formatDate, getStatusColor, cn } from '../utils/helpers';

const BenchmarksPage: React.FC = () => {
  const { benchmarks, agents } = useDashboardStore();
  const [selectedBenchmark, setSelectedBenchmark] = React.useState<string | null>(null);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-orange-100 text-orange-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBenchmarkTypeIcon = (type: string) => {
    switch (type) {
      case 'swe-bench':
        return '💻';
      case 'gaia':
        return '🤖';
      case 'osworld':
        return '🖥️';
      case 'webarena':
        return '🌐';
      case 'agentbench':
        return '📊';
      default:
        return '📋';
    }
  };

  const handleRunBenchmark = (benchmarkId: string) => {
    // In a real implementation, this would start an evaluation
    console.log(`Running benchmark: ${benchmarkId}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Benchmarks</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage and run evaluation benchmarks for your agents
          </p>
        </div>
        <button className="btn btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Benchmark
        </button>
      </div>

      {/* Benchmark Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-xl font-semibold text-gray-900">
                {benchmarks.filter(b => b.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Play className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Scheduled</p>
              <p className="text-xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Download className="h-5 w-5 text-gray-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-xl font-semibold text-gray-900">
                {benchmarks.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmarks List */}
      <div className="space-y-4">
        {benchmarks.map((benchmark) => (
          <div key={benchmark.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-2xl">
                  {getBenchmarkTypeIcon(benchmark.type)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{benchmark.name}</h3>
                  <p className="text-sm text-gray-600">{benchmark.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-gray-500">
                      Type: <span className="font-medium">{benchmark.type}</span>
                    </span>
                    <span className="text-sm text-gray-500">
                      Tasks: <span className="font-medium">{benchmark.totalTasks}</span>
                    </span>
                    <span className="text-sm text-gray-500">
                      Completed: <span className="font-medium">{benchmark.completedTasks}</span>
                    </span>
                    {benchmark.lastRun && (
                      <span className="text-sm text-gray-500">
                        Last run: <span className="font-medium">{formatDate(benchmark.lastRun)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={cn(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  getDifficultyColor(benchmark.difficulty)
                )}>
                  {benchmark.difficulty}
                </span>

                <div className="flex items-center space-x-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    benchmark.isActive ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                  <span className="text-sm text-gray-600">
                    {benchmark.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRunBenchmark(benchmark.id)}
                    className="btn btn-primary text-sm"
                    disabled={!benchmark.isActive || agents.length === 0}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run
                  </button>
                  <button className="btn btn-secondary text-sm">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {benchmark.totalTasks > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Math.round((benchmark.completedTasks / benchmark.totalTasks) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(benchmark.completedTasks / benchmark.totalTasks) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {benchmarks.length === 0 && (
        <div className="card">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No benchmarks configured</h3>
            <p className="text-gray-600 mb-4">
              Get started by adding your first evaluation benchmark
            </p>
            <button className="btn btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Benchmark
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BenchmarksPage;