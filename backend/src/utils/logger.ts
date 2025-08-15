/**
 * Centralized logging utility
 */
import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import config from '@/config';

// Ensure logs directory exists
const logsDir = path.resolve(config.logging.file.path);
fs.ensureDirSync(logsDir);

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
);

// Create transports
const transports: winston.transport[] = [];

// Console transport
if (config.logging.console.enabled) {
  transports.push(
    new winston.transports.Console({
      format: config.logging.console.colorize ? consoleFormat : logFormat,
      level: config.logging.level
    })
  );
}

// File transports
if (config.logging.file.enabled) {
  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: logFormat,
      level: config.logging.level,
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024, // Convert MB to bytes
      maxFiles: config.logging.file.maxFiles,
      tailable: true
    })
  );

  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024,
      maxFiles: config.logging.file.maxFiles,
      tailable: true
    })
  );

  // Trading-specific log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'trading.log'),
      format: logFormat,
      level: 'info',
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024,
      maxFiles: config.logging.file.maxFiles,
      tailable: true
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections
if (config.logging.file.enabled) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: logFormat,
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024,
      maxFiles: config.logging.file.maxFiles
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: logFormat,
      maxsize: parseInt(config.logging.file.maxSize) * 1024 * 1024,
      maxFiles: config.logging.file.maxFiles
    })
  );
}

// Enhanced logger with context
export class ContextualLogger {
  private context: string;
  private metadata: Record<string, any>;

  constructor(context: string, metadata: Record<string, any> = {}) {
    this.context = context;
    this.metadata = metadata;
  }

  private log(level: string, message: string, meta: Record<string, any> = {}) {
    const combinedMeta = {
      context: this.context,
      ...this.metadata,
      ...meta
    };

    (logger as any)[level](message, combinedMeta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  // Trading-specific methods
  trade(message: string, tradeData?: any) {
    this.info(`[TRADE] ${message}`, { trade: tradeData });
  }

  signal(message: string, signalData?: any) {
    this.info(`[SIGNAL] ${message}`, { signal: signalData });
  }

  session(message: string, sessionData?: any) {
    this.info(`[SESSION] ${message}`, { session: sessionData });
  }

  performance(message: string, metrics?: any) {
    this.info(`[PERFORMANCE] ${message}`, { metrics });
  }

  // Create child logger with additional context
  child(additionalContext: string, additionalMeta: Record<string, any> = {}): ContextualLogger {
    return new ContextualLogger(
      `${this.context}.${additionalContext}`,
      { ...this.metadata, ...additionalMeta }
    );
  }
}

// Factory function for creating contextual loggers
export const createLogger = (context: string, metadata?: Record<string, any>): ContextualLogger => {
  return new ContextualLogger(context, metadata);
};

// Default export for backwards compatibility
export default logger;

// Utility functions
export const logPerformance = (operation: string, duration: number, context?: string) => {
  logger.info(`Performance: ${operation} completed in ${duration}ms`, {
    context: context || 'performance',
    operation,
    duration
  });
};

export const logTrade = (trade: any, action: string) => {
  logger.info(`Trade ${action}`, {
    context: 'trading',
    action,
    trade: {
      id: trade.id,
      symbol: trade.symbol,
      type: trade.type,
      quantity: trade.quantity,
      price: trade.entryPrice || trade.exitPrice,
      pnl: trade.pnl
    }
  });
};

export const logError = (error: Error, context: string, metadata?: Record<string, any>) => {
  logger.error(`Error in ${context}: ${error.message}`, {
    context,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...metadata
  });
};