'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, RefreshCw, Download, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingStates';
import { ErrorState } from '@/components/ui/ErrorStates';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

interface LogsData {
  logs: LogEntry[];
  totalLogs: number;
  logLevel: string;
  lastUpdate: string;
}

const LogLevelBadge = ({ level }: { level: string }) => {
  const colors = {
    info: 'bg-blue-600 text-blue-100',
    error: 'bg-red-600 text-red-100', 
    warn: 'bg-yellow-600 text-yellow-100',
    debug: 'bg-gray-600 text-gray-100'
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colors[level as keyof typeof colors] || colors.info}`}>
      {level.toUpperCase()}
    </span>
  );
};

const LogEntry = ({ log, expanded, onToggle }: { 
  log: LogEntry; 
  expanded: boolean; 
  onToggle: () => void;
}) => (
  <div className="border-b border-gray-800 last:border-b-0">
    <div className="flex items-start gap-3 p-4 hover:bg-gray-800/50 transition-colors">
      <div className="flex-shrink-0 pt-1">
        <LogLevelBadge level={log.level} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-white font-medium leading-relaxed">
            {log.message}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            {log.data && Object.keys(log.data).length > 0 && (
              <button
                onClick={onToggle}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                {expanded ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            )}
          </div>
        </div>
        
        {expanded && log.data && Object.keys(log.data).length > 0 && (
          <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700">
            <pre className="text-xs text-gray-300 overflow-x-auto">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default function LogsViewer() {
  const [logsData, setLogsData] = useState<LogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [logLevel, setLogLevel] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/logs?level=${logLevel}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogsData(data);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Failed to fetch logs' });
    } finally {
      setLoading(false);
    }
  }, [logLevel]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchLogs, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (logsData && autoRefresh) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsData, autoRefresh]);

  const toggleLogExpansion = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const exportLogs = () => {
    if (!logsData) return;
    
    const csvContent = [
      'Timestamp,Level,Message,Data',
      ...logsData.logs.map(log => 
        `"${log.timestamp}","${log.level}","${log.message}","${JSON.stringify(log.data || {})}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <Card>
      <div className="p-6">
        <LoadingSkeleton />
      </div>
    </Card>
  );
  if (error) return <ErrorState error={error} onRetry={fetchLogs} title="Failed to Load Logs" />;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Live System Logs</h3>
              {autoRefresh && (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  Live
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warnings</option>
                <option value="error">Errors</option>
                <option value="debug">Debug</option>
              </select>
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded transition-colors ${
                  autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={exportLogs}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Export logs to CSV"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {logsData && (
          <div className="p-4 bg-gray-800/50 text-sm text-gray-400">
            <div className="flex items-center justify-between">
              <span>
                Showing {logsData.logs.length} of {logsData.totalLogs} logs
              </span>
              <span>
                Last updated: {new Date(logsData.lastUpdate).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Logs Display */}
      <Card className="overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {logsData && logsData.logs.length > 0 ? (
            <div>
              {logsData.logs.map((log, index) => (
                <LogEntry
                  key={`${log.timestamp}-${index}`}
                  log={log}
                  expanded={expandedLogs.has(index)}
                  onToggle={() => toggleLogExpansion(index)}
                />
              ))}
              <div ref={logsEndRef} />
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No logs available</p>
              <p className="text-sm">Logs will appear here when the trading system is active</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}