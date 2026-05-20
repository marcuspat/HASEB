import React from 'react';
import { Play, Pause, Square, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { formatDuration, formatDate, getStatusColor, cn } from '../utils/helpers';

const RealTimeEvaluations: React.FC = () => {
  const { evaluations } = useDashboardStore();
  const runningEvaluations = evaluations.filter(e => e.status === 'running');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (runningEvaluations.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Real-time Evaluations</h2>
          <div className="text-sm text-gray-500">No evaluations running</div>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No evaluations are currently running.</p>
          <p className="text-sm mt-2">Start an evaluation from the Benchmarks page to see real-time progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Real-time Evaluations</h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600">
            {runningEvaluations.length} {runningEvaluations.length === 1 ? 'evaluation' : 'evaluations'} running
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {runningEvaluations.map((evaluation) => {
          const progress = (evaluation.metrics?.taskSuccessRate ?? 0) * 100;
          return (
          <div key={evaluation.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'p-2 rounded-full',
                  getStatusColor(evaluation.status)
                )}>
                  {getStatusIcon(evaluation.status)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {evaluation.benchmarkId} Evaluation
                  </h3>
                  <p className="text-sm text-gray-600">
                    Agent: {evaluation.agentId}
                    {evaluation.startTime && ` • Started: ${formatDate(evaluation.startTime)}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-gray-900">
                  {progress.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">
                  {evaluation.startTime
                    ? formatDuration(Date.now() - new Date(evaluation.startTime).getTime())
                    : '—'}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Metrics Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Success Rate:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {((evaluation.metrics?.taskSuccessRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">Steps:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {evaluation.metrics?.totalSteps ?? 0}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tokens:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {(evaluation.metrics?.totalTokens ?? 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Cost:</span>
                <span className="ml-2 font-medium text-gray-900">
                  ${(evaluation.metrics?.estimatedCost ?? 0).toFixed(3)}
                </span>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Recent Completed Evaluations */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Recently Completed</h3>
        <div className="space-y-2">
          {evaluations
            .filter(e => e.status === 'completed')
            .slice(-3)
            .reverse()
            .map((evaluation) => (
              <div key={evaluation.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {evaluation.benchmarkId}
                    </span>
                    <span className="text-sm text-gray-600 ml-2">
                      {evaluation.endTime && formatDate(evaluation.endTime)}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-900">
                  {((evaluation.metrics?.taskSuccessRate ?? 0) * 100).toFixed(1)}% success
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default RealTimeEvaluations;