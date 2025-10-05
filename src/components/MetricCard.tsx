import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../utils/helpers';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue-500 text-blue-600 border-blue-200',
    green: 'bg-green-500 text-green-600 border-green-200',
    yellow: 'bg-yellow-500 text-yellow-600 border-yellow-200',
    red: 'bg-red-500 text-red-600 border-red-200',
    purple: 'bg-purple-500 text-purple-600 border-purple-200',
  };

  const bgColorClasses = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
    purple: 'bg-purple-50',
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      case 'stable':
        return <Minus className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={cn(
      'metric-card',
      bgColorClasses[color]
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={cn(
            'p-2 rounded-lg border',
            colorClasses[color]
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <div className="flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              <span className={cn(
                'ml-2 flex items-center text-sm',
                getTrendColor()
              )}>
                {getTrendIcon()}
                <span className="ml-1">{trendValue}</span>
              </span>
            </div>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;