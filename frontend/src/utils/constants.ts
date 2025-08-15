/**
 * Application constants
 */

// API endpoints
export const API_ENDPOINTS = {
  TRADES: '/api/trades',
  SESSION: '/api/session',
  ANALYTICS: '/api/analytics'
} as const;

// Refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  SESSION_DATA: 30000,  // 30 seconds
  TRADES_DATA: 60000,   // 1 minute
  ANALYTICS_DATA: 60000 // 1 minute
} as const;

// UI constants
export const COLORS = {
  SUCCESS: '#10B981',
  ERROR: '#EF4444',
  WARNING: '#F59E0B',
  INFO: '#3B82F6',
  NEUTRAL: '#6B7280'
} as const;

export const CHART_COLORS = {
  PRIMARY: '#3B82F6',
  SUCCESS: '#10B981',
  ERROR: '#EF4444',
  GRID: '#374151'
} as const;

// Trade type mappings
export const TRADE_TYPE_LABELS = {
  BUY: 'LONG',
  SELL: 'SHORT',
  SELL_SHORT: 'SHORT',
  LONG_ENTRY: 'LONG',
  SHORT_ENTRY: 'SHORT'
} as const;

// Status mappings
export const STATUS_COLORS = {
  OPEN: 'blue',
  CLOSED: 'gray',
  ACTIVE: 'green',
  INACTIVE: 'red'
} as const;

// Default values
export const DEFAULTS = {
  QUANTITY_DECIMALS: 6,
  PRICE_DECIMALS: 2,
  PERCENTAGE_DECIMALS: 2,
  DEFAULT_DATE: () => new Date().toISOString().split('T')[0]
} as const;