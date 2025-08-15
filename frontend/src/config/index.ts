/**
 * Application configuration
 */

export const config = {
  // API configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || '',
    timeout: 30000, // 30 seconds
  },

  // Data refresh intervals
  refreshIntervals: {
    sessionData: 30000,  // 30 seconds
    tradesData: 60000,   // 1 minute
    analyticsData: 60000, // 1 minute
  },

  // UI settings
  ui: {
    defaultPageSize: 50,
    maxTableRows: 1000,
    animationDuration: 300,
  },

  // Trading settings
  trading: {
    defaultSymbol: 'BTCUSD',
    quantityDecimals: 6,
    priceDecimals: 2,
    percentageDecimals: 2,
  },

  // Chart settings
  charts: {
    defaultHeight: 300,
    colors: {
      primary: '#3B82F6',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      grid: '#374151',
    },
  },

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

export default config;