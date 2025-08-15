/**
 * Main entry point for the trading engine
 */
import 'module-alias/register';
import express from 'express';
import { createServer } from 'http';
import config, { validateConfig } from '@/config';
import { createLogger } from '@/utils/logger';
import { TradingApp } from './app/TradingApp';

const logger = createLogger('Main');

async function bootstrap(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated successfully');

    // Create Express app
    const app = express();
    const server = createServer(app);

    // Initialize trading application
    const tradingApp = new TradingApp(app, server);
    await tradingApp.initialize();

    // Start server
    server.listen(config.app.port, () => {
      logger.info('Trading engine started', {
        port: config.app.port,
        environment: config.app.environment,
        version: config.app.version
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info('Shutdown signal received', { signal });
      
      try {
        await tradingApp.shutdown();
        server.close(() => {
          logger.info('Server closed successfully');
          process.exit(0);
        });
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start trading engine', { error });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Start the application
bootstrap();