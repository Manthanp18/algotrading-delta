'use client';

import { useState, useEffect } from 'react';
import { Trade, StatusFilter, TypeFilter } from '@/types/trading';
import { useTrades } from '@/hooks/useTrades';
import { formatCurrency, formatPercentage, formatDateTime, formatQuantity } from '@/utils/formatters';
import { DEFAULTS, TRADE_TYPE_LABELS } from '@/utils/constants';
import { Card } from '@/components/ui/Card';
import { TableLoadingSkeleton } from '@/components/ui/LoadingStates';
import { ErrorState, NoDataState } from '@/components/ui/ErrorStates';
import { DateFilter, StatusFilterSelect, TypeFilterSelect } from '@/components/ui/Filters';

const TradesTableHeader = () => (
  <thead className="bg-gray-800">
    <tr>
      {[
        'Time', 'Type', 'Symbol', 'Quantity', 'Entry Price', 
        'Exit Price', 'P&L', 'P&L %', 'Status', 'Duration', 'Reason'
      ].map((header) => (
        <th 
          key={header}
          className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
        >
          {header}
        </th>
      ))}
    </tr>
  </thead>
);

interface TradeRowProps {
  trade: Trade;
  index: number;
}

const TradeRow = ({ trade, index }: TradeRowProps) => {
  const getTypeClass = (type: string, signalType: string) => {
    if (type === 'BUY' || signalType === 'LONG_ENTRY') {
      return 'text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-xs font-medium';
    }
    return 'text-red-500 bg-red-500/10 px-2 py-1 rounded-full text-xs font-medium';
  };

  const getPnLClass = (pnl?: number) => {
    if (!pnl) return 'text-gray-400';
    return pnl > 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium';
  };

  const getStatusBadge = (status: string) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
      status === 'OPEN' 
        ? 'bg-blue-500/20 text-blue-400' 
        : 'bg-gray-500/20 text-gray-400'
    }`}>
      {status}
    </span>
  );

  return (
    <tr key={trade.id || index} className="hover:bg-gray-800/50">
      <td className="px-4 py-3 text-sm text-gray-300">
        {formatDateTime(trade.entryTime)}
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={getTypeClass(trade.type, trade.signal_type)}>
          {TRADE_TYPE_LABELS[trade.signal_type] || trade.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-white">
        {trade.symbol}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {formatQuantity(trade.quantity)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {formatCurrency(trade.entryPrice)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {formatCurrency(trade.exitPrice)}
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={getPnLClass(trade.pnl)}>
          {formatCurrency(trade.pnl)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <span className={getPnLClass(trade.pnl)}>
          {formatPercentage(trade.pnlPercent)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        {getStatusBadge(trade.status)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-300">
        {trade.holdingPeriod ? `${trade.holdingPeriod}m` : '--'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={trade.reason}>
        {trade.reason}
      </td>
    </tr>
  );
};

export default function TradesTable() {
  const [selectedDate, setSelectedDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState<TypeFilter>('all');

  // Set default date on client side only
  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const { trades, loading, error, refetch } = useTrades(selectedDate);

  const filteredTrades = trades.filter(trade => {
    const statusMatch = filterStatus === 'all' || trade.status === filterStatus.toUpperCase();
    const typeMatch = filterType === 'all' || 
      (filterType === 'long' && (trade.type === 'BUY' || trade.signal_type === 'LONG_ENTRY')) ||
      (filterType === 'short' && (trade.type === 'SELL' || trade.type === 'SELL_SHORT' || trade.signal_type === 'SHORT_ENTRY'));
    
    return statusMatch && typeMatch;
  });

  if (loading) return <TableLoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} title="Failed to Load Trades" />;

  return (
    <Card className="overflow-hidden p-0">
      {/* Header with filters */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Trading History</h2>
            <p className="text-gray-400 text-sm">
              {filteredTrades.length} trades found
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <DateFilter
              value={selectedDate}
              onChange={setSelectedDate}
            />
            <StatusFilterSelect
              value={filterStatus}
              onChange={setFilterStatus}
            />
            <TypeFilterSelect
              value={filterType}
              onChange={setFilterType}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <TradesTableHeader />
          <tbody className="divide-y divide-gray-800">
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8">
                  <NoDataState message="No trades found for the selected filters" />
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade, index) => (
                <TradeRow key={trade.id || index} trade={trade} index={index} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}