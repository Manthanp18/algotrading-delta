/**
 * Core type definitions for the trading system
 */

// Market data types
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  high24h?: number;
  low24h?: number;
  change24h?: number;
}

// Trading types
export interface Trade {
  id: string;
  symbol: string;
  type: TradeType;
  signalType: SignalType;
  quantity: number;
  entryPrice: number;
  entryTime: number;
  exitPrice?: number;
  exitTime?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  status: TradeStatus;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriod?: number;
  reason: string;
  exitReason?: string;
  strategy: string;
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
  SELL_SHORT = 'SELL_SHORT'
}

export enum SignalType {
  LONG_ENTRY = 'LONG_ENTRY',
  SHORT_ENTRY = 'SHORT_ENTRY',
  EXIT = 'EXIT'
}

export enum TradeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED'
}

// Portfolio types
export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  side: 'LONG' | 'SHORT';
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface Portfolio {
  cash: number;
  equity: number;
  positions: Position[];
  totalReturn: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

// Strategy types
export interface StrategySignal {
  type: SignalType;
  symbol: string;
  price: number;
  quantity: number;
  reason: string;
  confidence: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
}

export interface StrategyConfig {
  name: string;
  parameters: Record<string, any>;
  riskManagement: RiskManagementConfig;
}

export interface RiskManagementConfig {
  maxPositionSize: number;
  maxDrawdown: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxOpenPositions: number;
}

// Session types
export interface TradingSession {
  id: string;
  symbol: string;
  strategy: string;
  startTime: number;
  endTime?: number;
  initialCapital: number;
  portfolio: Portfolio;
  trades: Trade[];
  status: SessionStatus;
  config: SessionConfig;
}

export enum SessionStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

export interface SessionConfig {
  symbol: string;
  strategy: string;
  initialCapital: number;
  timeframe: string;
  riskManagement: RiskManagementConfig;
  dataSource: DataSourceConfig;
}

export interface DataSourceConfig {
  type: 'LIVE' | 'BACKTEST';
  startDate?: number;
  endDate?: number;
  apiConfig?: {
    baseUrl: string;
    apiKey?: string;
    apiSecret?: string;
  };
}

// Analytics types
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingPeriod: number;
}

// API types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error types
export interface TradingError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  context?: {
    symbol?: string;
    strategy?: string;
    sessionId?: string;
  };
}

// Event types
export interface TradingEvent {
  type: EventType;
  timestamp: number;
  data: any;
  sessionId?: string;
}

export enum EventType {
  TRADE_OPENED = 'TRADE_OPENED',
  TRADE_CLOSED = 'TRADE_CLOSED',
  SIGNAL_GENERATED = 'SIGNAL_GENERATED',
  SESSION_STARTED = 'SESSION_STARTED',
  SESSION_STOPPED = 'SESSION_STOPPED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  DATA_RECEIVED = 'DATA_RECEIVED'
}