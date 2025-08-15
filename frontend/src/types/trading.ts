// Core trading types
export interface Trade {
  id?: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'SELL_SHORT';
  signal_type: 'LONG_ENTRY' | 'SHORT_ENTRY';
  quantity: number;
  entryPrice: number;
  entryTime: string;
  reason: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitTime?: string;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriod?: number;
  exitReason?: string;
  timestamp: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface Portfolio {
  cash: number;
  equity: number;
  positions: Position[];
  totalReturn: number;
}

export interface TradingMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  maxDrawdown: number;
  winRate: number;
  lastUpdate: string;
}

export interface SessionData {
  symbol: string;
  strategy: string;
  initialCapital: number;
  startTime: string;
  portfolio: Portfolio;
  metrics: TradingMetrics;
  lastCandleTime: string;
  lastPrice: number;
  openPositions: number;
  lastUpdate: string;
  uptime?: number;
  unrealizedPnL?: number;
  realizedPnL?: number;
  totalPnL?: number;
}

export interface Analytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxWin: number;
  maxLoss: number;
  averageHoldingPeriod: number;
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
  hourlyBreakdown: HourlyBreakdown[];
  pnlChartData: PnLChartData[];
}

export interface HourlyBreakdown {
  hour: number;
  trades: number;
  pnl: number;
}

export interface PnLChartData {
  timestamp: string;
  cumulativePnL: number;
  pnl: number;
  type: string;
}

// API Response types
export interface TradesResponse {
  trades: Trade[];
  date: string;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
}

// Filter types
export type StatusFilter = 'all' | 'open' | 'closed';
export type TypeFilter = 'all' | 'long' | 'short';
export type TabType = 'positions' | 'trades' | 'analytics';

// Error types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}