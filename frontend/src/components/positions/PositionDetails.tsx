'use client';

import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { formatCurrency, formatUptime } from '@/utils/formatters';
import { Card, MetricCard } from '@/components/ui/Card';
import { MetricLoadingSkeleton } from '@/components/ui/LoadingStates';
import { ErrorState, NoDataState } from '@/components/ui/ErrorStates';
import { Position } from '@/types/trading';

interface SessionOverviewProps {
  symbol: string;
  strategy: string;
  uptime: number;
  lastPrice: number;
}

const SessionOverview = ({ symbol, strategy, uptime, lastPrice }: SessionOverviewProps) => (
  <Card>
    <div className="flex justify-between items-start mb-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Live Trading Session</h2>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-500 text-sm font-medium">ACTIVE</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-sm">Strategy</p>
        <p className="text-white font-medium">{strategy}</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <p className="text-gray-400 text-sm mb-1">Symbol</p>
        <p className="text-xl font-bold text-white">{symbol}</p>
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">Uptime</p>
        <p className="text-xl font-bold text-white">{formatUptime(uptime)}</p>
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">Last Price</p>
        <p className="text-xl font-bold text-white">{formatCurrency(lastPrice)}</p>
      </div>
    </div>
  </Card>
);

interface PositionsTableProps {
  positions: Position[];
  lastPrice: number;
}

const PositionsTable = ({ positions, lastPrice }: PositionsTableProps) => {
  if (positions.length === 0) {
    return (
      <Card>
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Current Positions</h3>
        </div>
        <NoDataState 
          title="No Open Positions"
          message="No positions are currently open"
          icon={<Target className="h-8 w-8 mx-auto mb-2 opacity-50 text-gray-400" />}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-6 border-b border-gray-800">
        <h3 className="text-lg font-semibold text-white">Current Positions</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              {[
                'Symbol', 'Quantity', 'Avg Price', 'Current Price', 
                'Market Value', 'Unrealized P&L', 'P&L %'
              ].map((header) => (
                <th 
                  key={header}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {positions.map((position, index) => {
              const marketValue = position.quantity * lastPrice;
              const costBasis = position.quantity * position.avgPrice;
              const unrealizedPnL = marketValue - costBasis;
              const pnlPercent = (unrealizedPnL / costBasis) * 100;
              
              return (
                <tr key={index} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {position.symbol}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {position.quantity.toFixed(6)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {formatCurrency(position.avgPrice)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {formatCurrency(lastPrice)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {formatCurrency(marketValue)}
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(unrealizedPnL)}
                  </td>
                  <td className={`px-6 py-4 text-sm font-medium ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default function PositionDetails() {
  const { sessionData, loading, error, refetch } = useSession();

  if (loading) return <MetricLoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Failed to Load Session Data" />;
  if (!sessionData) {
    return (
      <NoDataState
        title="No Active Session"
        message="No live trading session is currently active."
        icon={<AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />}
      />
    );
  }

  const totalReturn = ((sessionData.portfolio.equity - sessionData.initialCapital) / sessionData.initialCapital) * 100;

  return (
    <div className="space-y-6">
      <SessionOverview
        symbol={sessionData.symbol}
        strategy={sessionData.strategy}
        uptime={sessionData.uptime || 0}
        lastPrice={sessionData.lastPrice}
      />

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Current Equity"
          value={formatCurrency(sessionData.portfolio.equity)}
          subtitle={`Initial: ${formatCurrency(sessionData.initialCapital)}`}
          icon={<DollarSign className="h-4 w-4" />}
        />

        <MetricCard
          title="Total Return"
          value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`}
          subtitle={formatCurrency(sessionData.portfolio.equity - sessionData.initialCapital)}
          valueColor={totalReturn >= 0 ? 'success' : 'error'}
          icon={totalReturn >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />

        <MetricCard
          title="Unrealized P&L"
          value={formatCurrency(sessionData.unrealizedPnL || 0)}
          valueColor={(sessionData.unrealizedPnL || 0) >= 0 ? 'success' : 'error'}
          icon={(sessionData.unrealizedPnL || 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />

        <MetricCard
          title="Realized P&L"
          value={formatCurrency(sessionData.realizedPnL || 0)}
          valueColor={(sessionData.realizedPnL || 0) >= 0 ? 'success' : 'error'}
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      <PositionsTable 
        positions={sessionData.portfolio.positions} 
        lastPrice={sessionData.lastPrice}
      />

      {/* Trading Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Trades"
          value={sessionData.metrics.totalTrades}
          icon={<Target className="h-4 w-4" />}
        />

        <MetricCard
          title="Win Rate"
          value={`${(sessionData.metrics.winRate * 100).toFixed(1)}%`}
          subtitle={`${sessionData.metrics.winningTrades}W / ${sessionData.metrics.losingTrades}L`}
          icon={<Target className="h-4 w-4" />}
        />

        <MetricCard
          title="Max Drawdown"
          value={`-${(sessionData.metrics.maxDrawdown * 100).toFixed(2)}%`}
          valueColor="error"
          icon={<TrendingDown className="h-4 w-4" />}
        />

        <MetricCard
          title="Available Cash"
          value={formatCurrency(sessionData.portfolio.cash)}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}