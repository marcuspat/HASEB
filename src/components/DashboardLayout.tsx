import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Target,
  Trophy,
  BarChart3,
  Settings,
  Activity,
  Bell,
  Search,
  Menu,
  X
} from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import { cn } from '../utils/helpers';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Benchmarks', href: '/benchmarks', icon: Target },
  { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { realTimeUpdates, toggleRealTimeUpdates, evaluations } = useDashboardStore();

  // Enable real-time updates
  useRealTimeUpdates(realTimeUpdates);

  const runningEvaluations = evaluations.filter(e => e.status === 'running').length;

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 flex z-40 md:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <Sidebar />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <Sidebar />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  type="button"
                  className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div className="ml-4 md:ml-0 flex items-center">
                  <Activity className="h-8 w-8 text-primary-600" />
                  <h1 className="ml-3 text-xl font-semibold text-gray-900">
                    HASEB Dashboard
                  </h1>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Real-time toggle */}
                <button
                  onClick={toggleRealTimeUpdates}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    realTimeUpdates
                      ? "bg-green-100 text-green-600 hover:bg-green-200"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  )}
                  title={realTimeUpdates ? "Real-time updates enabled" : "Real-time updates disabled"}
                >
                  <Activity className="h-5 w-5" />
                </button>

                {/* Running evaluations indicator */}
                {runningEvaluations > 0 && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{runningEvaluations} running</span>
                  </div>
                )}

                {/* Notifications */}
                <button className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                  <Bell className="h-5 w-5" />
                </button>

                {/* Search */}
                <div className="hidden md:block">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { agents, benchmarks, evaluations } = useDashboardStore();

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const activeBenchmarks = benchmarks.filter(b => b.isActive).length;
  const totalEvaluations = evaluations.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <Activity className="h-8 w-8 text-primary-600" />
          <span className="ml-2 text-lg font-semibold text-gray-900">HASEB</span>
        </div>

        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary-100 text-primary-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-primary-500" : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Stats summary */}
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <div className="flex-shrink-0 w-full">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Quick Stats
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Agents</span>
                <span className="font-medium text-gray-900">{activeAgents}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Benchmarks</span>
                <span className="font-medium text-gray-900">{activeBenchmarks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Evaluations</span>
                <span className="font-medium text-gray-900">{totalEvaluations}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;