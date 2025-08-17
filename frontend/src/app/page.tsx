'use client';

import { useState, useEffect } from 'react';
import TradesTable from '@/components/trades/TradesTable';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import PositionDetails from '@/components/positions/PositionDetails';
import LogsViewer from '@/components/logs/LogsViewer';
import { BarChart3, TrendingUp, Table, RefreshCw, Activity } from 'lucide-react';

type TabType = 'positions' | 'trades' | 'analytics' | 'logs';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    // Update time only on client side to avoid hydration issues
    setLastUpdated(new Date().toLocaleTimeString());
    
    // Update every 30 seconds
    const interval = setInterval(() => {
      setLastUpdated(new Date().toLocaleTimeString());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const tabs = [
    {
      id: 'positions' as TabType,
      name: 'Live Positions',
      icon: TrendingUp,
      description: 'Current positions and portfolio status'
    },
    {
      id: 'trades' as TabType,
      name: 'Trade History',
      icon: Table,
      description: 'Complete trading history with details'
    },
    {
      id: 'analytics' as TabType,
      name: 'Analytics',
      icon: BarChart3,
      description: 'Performance metrics and charts'
    },
    {
      id: 'logs' as TabType,
      name: 'System Logs',
      icon: Activity,
      description: 'Live backend logs and trading activity'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
              <p className="text-gray-400 mt-1">Comprehensive trading analytics and monitoring</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-500 text-sm font-medium">Live</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200"
                title="Refresh dashboard"
              >
                <RefreshCw className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Description */}
        <div className="mb-8">
          <p className="text-gray-400">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {/* Tab Content */}
        <div className="animate-in slide-in-from-right-5 duration-300">
          {activeTab === 'positions' && <PositionDetails />}
          {activeTab === 'trades' && <TradesTable />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'logs' && <LogsViewer />}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 Trading Dashboard. Real-time cryptocurrency trading analytics.
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Last updated: {lastUpdated || 'Loading...'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
