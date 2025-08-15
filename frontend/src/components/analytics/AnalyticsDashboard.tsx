'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatCurrency, formatPercentage } from '@/utils/formatters';
import { DEFAULTS, CHART_COLORS } from '@/utils/constants';
import { Card, MetricCard } from '@/components/ui/Card';
import { MetricLoadingSkeleton, ChartLoadingSkeleton } from '@/components/ui/LoadingStates';
import { ErrorState, NoDataState } from '@/components/ui/ErrorStates';
import { DateFilter } from '@/components/ui/Filters';

interface ChartPayload {
  value: number;
  name: string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
  formatter?: (value: number, name: string) => [string, string];
  labelFormatter?: (value: string) => string;
}

const CustomTooltip = ({ active, payload, label, formatter, labelFormatter }: ChartTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      {labelFormatter && (
        <p className="text-gray-300 text-sm mb-2">{labelFormatter(label || '')}</p>
      )}
      {payload.map((entry, index) => (
        <p key={index} className="text-white text-sm">
          {formatter ? formatter(entry.value, entry.name) : [entry.value, entry.name]}
        </p>
      ))}
    </div>
  );
};

interface CumulativePnLChartProps {
  data: Array<{
    timestamp: string;
    cumulativePnL: number;
    pnl: number;
    type: string;
  }>;
}

const CumulativePnLChart = ({ data }: CumulativePnLChartProps) => (
  <Card>
    <h3 className="text-lg font-semibold text-white mb-4">Cumulative P&L</h3>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.GRID} />
        <XAxis 
          dataKey="timestamp" 
          tick={{ fontSize: 12, fill: '#9CA3AF' }}
          tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        />
        <YAxis 
          tick={{ fontSize: 12, fill: '#9CA3AF' }}
          tickFormatter={(value) => `$${value.toFixed(0)}`}
        />
        <Tooltip 
          content={<CustomTooltip 
            labelFormatter={(value) => new Date(value).toLocaleString()}
            formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']}
          />}
        />
        <Line 
          type="monotone" 
          dataKey="cumulativePnL" 
          stroke={CHART_COLORS.SUCCESS} 
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  </Card>
);

interface HourlyPerformanceChartProps {
  data: Array<{
    hour: number;
    trades: number;
    pnl: number;
  }>;
}

const HourlyPerformanceChart = ({ data }: HourlyPerformanceChartProps) => (
  <Card>
    <h3 className="text-lg font-semibold text-white mb-4">Hourly Performance</h3>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.GRID} />
        <XAxis 
          dataKey="hour" 
          tick={{ fontSize: 12, fill: '#9CA3AF' }}
          tickFormatter={(value) => `${value}:00`}
        />
        <YAxis 
          tick={{ fontSize: 12, fill: '#9CA3AF' }}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          content={<CustomTooltip 
            labelFormatter={(value) => `${value}:00 - ${parseInt(value) + 1}:00`}
            formatter={(value: number, name: string) => [
              name === 'pnl' ? formatCurrency(value) : value.toString(),
              name === 'pnl' ? 'P&L' : 'Trades'
            ]}
          />}
        />
        <Bar 
          dataKey="pnl" 
          fill={CHART_COLORS.PRIMARY}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </Card>
);

export default function AnalyticsDashboard() {
  const [selectedDate, setSelectedDate] = useState('');
  
  // Set default date on client side only
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);
  
  const { analytics, loading, error, refetch } = useAnalytics(selectedDate);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Trading Analytics</h2>
          <DateFilter value={selectedDate} onChange={setSelectedDate} />
        </div>
        <MetricLoadingSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartLoadingSkeleton />
          <ChartLoadingSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Trading Analytics</h2>
          <DateFilter value={selectedDate} onChange={setSelectedDate} />
        </div>
        <ErrorState error={error} onRetry={refetch} title="Failed to Load Analytics" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Trading Analytics</h2>
          <DateFilter value={selectedDate} onChange={setSelectedDate} />
        </div>
        <NoDataState message="No analytics data available for the selected date" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Trading Analytics</h2>
        <DateFilter value={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total P&L"
          value={formatCurrency(analytics.totalPnL)}
          valueColor={analytics.totalPnL >= 0 ? 'success' : 'error'}
          icon={<DollarSign className="h-4 w-4" />}
        />

        <MetricCard
          title="Win Rate"
          value={formatPercentage(analytics.winRate / 100)}
          subtitle={`${analytics.winningTrades}W / ${analytics.losingTrades}L`}
          icon={<Target className="h-4 w-4" />}
        />

        <MetricCard
          title="Profit Factor"
          value={analytics.profitFactor.toFixed(2)}
          valueColor={analytics.profitFactor >= 1 ? 'success' : 'error'}
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <MetricCard
          title="Avg Holding Period"
          value={`${analytics.averageHoldingPeriod.toFixed(1)}m`}
          icon={<Target className="h-4 w-4" />}
        />

        <MetricCard
          title="Average Win"
          value={formatCurrency(analytics.averageWin)}
          valueColor="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />

        <MetricCard
          title="Average Loss"
          value={formatCurrency(analytics.averageLoss)}
          valueColor="error"
          icon={<TrendingDown className="h-4 w-4" />}
        />

        <MetricCard
          title="Long Win Rate"
          value={formatPercentage(analytics.longWinRate / 100)}
          subtitle={`${analytics.longTrades} trades`}
          icon={<div className="h-2 w-2 rounded-full bg-green-500"></div>}
        />

        <MetricCard
          title="Short Win Rate"
          value={formatPercentage(analytics.shortWinRate / 100)}
          subtitle={`${analytics.shortTrades} trades`}
          icon={<div className="h-2 w-2 rounded-full bg-red-500"></div>}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CumulativePnLChart data={analytics.pnlChartData} />
        <HourlyPerformanceChart data={analytics.hourlyBreakdown} />
      </div>

      {/* Best/Worst Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard
          title="Best Trade"
          value={formatCurrency(analytics.maxWin)}
          subtitle="Single trade maximum profit"
          valueColor="success"
          icon={<TrendingUp className="h-5 w-5" />}
          className="text-center"
        />

        <MetricCard
          title="Worst Trade"
          value={formatCurrency(analytics.maxLoss)}
          subtitle="Single trade maximum loss"
          valueColor="error"
          icon={<TrendingDown className="h-5 w-5" />}
          className="text-center"
        />
      </div>
    </div>
  );
}