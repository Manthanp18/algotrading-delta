/**
 * Configuration management for the trading system
 */
import dotenv from 'dotenv';
import { DataSourceConfig, RiskManagementConfig } from '@/types';

// Load environment variables
dotenv.config();

export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
    port: number;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  api: {
    deltaExchange: {
      baseUrl: string;
      apiKey?: string;
      apiSecret?: string;
      timeout: number;
      retries: number;
    };
  };
  database: {
    path: string;
    backupPath: string;
    autoBackup: boolean;
    backupInterval: number; // in hours
  };
  trading: {
    defaultSymbol: string;
    defaultTimeframe: string;
    defaultInitialCapital: number;
    maxConcurrentSessions: number;
    dataRetentionDays: number;
  };
  risk: {
    default: RiskManagementConfig;
    maxLeverage: number;
    emergencyStopLoss: number;
  };
  dashboard: {
    port: number;
    refreshInterval: number;
    maxHistoryDays: number;
  };
  logging: {
    level: string;
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
    console: {
      enabled: boolean;
      colorize: boolean;
    };
  };
}

const config: AppConfig = {
  app: {
    name: 'TradingEngine',
    version: '2.0.0',
    environment: (process.env.NODE_ENV as any) || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: (process.env.LOG_LEVEL as any) || 'info'
  },
  
  api: {
    deltaExchange: {
      baseUrl: process.env.DELTA_BASE_URL || 'https://api.delta.exchange',
      apiKey: process.env.DELTA_API_KEY,
      apiSecret: process.env.DELTA_API_SECRET,
      timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
      retries: parseInt(process.env.API_RETRIES || '3', 10)
    }
  },

  database: {
    path: process.env.DB_PATH || './data',
    backupPath: process.env.BACKUP_PATH || './backups',
    autoBackup: process.env.AUTO_BACKUP === 'true',
    backupInterval: parseInt(process.env.BACKUP_INTERVAL || '24', 10)
  },

  trading: {
    defaultSymbol: process.env.DEFAULT_SYMBOL || 'BTCUSD',
    defaultTimeframe: process.env.DEFAULT_TIMEFRAME || '1m',
    defaultInitialCapital: parseInt(process.env.DEFAULT_CAPITAL || '100000', 10),
    maxConcurrentSessions: parseInt(process.env.MAX_SESSIONS || '5', 10),
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '30', 10)
  },

  risk: {
    default: {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.1'),
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '0.2'),
      stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '0.02'),
      takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '0.03'),
      maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '3', 10)
    },
    maxLeverage: parseFloat(process.env.MAX_LEVERAGE || '10'),
    emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || '0.5')
  },

  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3001', 10),
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '30000', 10),
    maxHistoryDays: parseInt(process.env.MAX_HISTORY_DAYS || '90', 10)
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: process.env.LOG_FILE_ENABLED !== 'false',
      path: process.env.LOG_FILE_PATH || './logs',
      maxSize: process.env.LOG_MAX_SIZE || '10MB',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10)
    },
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
      colorize: process.env.LOG_COLORIZE !== 'false'
    }
  }
};

// Validation functions
export const validateConfig = (): void => {
  const required = {
    'DELTA_BASE_URL': config.api.deltaExchange.baseUrl,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  if (config.app.port < 1 || config.app.port > 65535) {
    throw new Error('Invalid port number');
  }

  if (config.trading.defaultInitialCapital <= 0) {
    throw new Error('Initial capital must be positive');
  }
};

// Helper functions
export const isDevelopment = (): boolean => config.app.environment === 'development';
export const isProduction = (): boolean => config.app.environment === 'production';
export const isTest = (): boolean => config.app.environment === 'test';

export default config;