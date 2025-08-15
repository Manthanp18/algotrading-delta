/**
 * Main trading application class
 */
import express, { Application } from 'express';
import { Server } from 'http';
import cors from 'cors';
import { createLogger } from '@/utils/logger';
import { DeltaExchangeProvider } from '@/data/providers/DeltaExchangeProvider';
import { SessionManager } from '@/services/SessionManager';
import { ApiService } from '@/services/ApiService';
import config from '@/config';

export class TradingApp {
  private logger = createLogger('TradingApp');
  private app: Application;
  private server: Server;
  private dataProvider: DeltaExchangeProvider;
  private sessionManager: SessionManager;
  private apiService: ApiService;

  constructor(app: Application, server: Server) {
    this.app = app;
    this.server = server;
  }

  /**
   * Initialize the trading application
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing trading application...');

    try {
      // Setup middleware
      this.setupMiddleware();

      // Initialize data provider
      this.dataProvider = new DeltaExchangeProvider(config.api.deltaExchange);

      // Initialize session manager
      this.sessionManager = new SessionManager(this.dataProvider);

      // Initialize API service
      this.apiService = new ApiService(this.sessionManager);

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      this.logger.info('Trading application initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize trading application', { error });
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Enable CORS
    this.app.use(cors({
      origin: config.isDevelopment() ? '*' : ['http://localhost:3001'],
      credentials: true
    }));

    // Parse JSON requests
    this.app.use(express.json({ limit: '10mb' }));

    // Parse URL-encoded requests
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug('HTTP Request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.app.version,
        environment: config.app.environment
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // API routes
    this.app.use('/api', this.apiService.getRouter());

    // Serve static files for dashboard (if not using separate frontend)
    if (config.isDevelopment()) {
      this.app.use('/dashboard', express.static('../dashboard'));
    }

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled Express error', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body
        }
      });

      // Don't expose internal errors in production
      const isDev = config.isDevelopment();
      
      res.status(error.status || 500).json({
        error: isDev ? error.message : 'Internal Server Error',
        ...(isDev && { stack: error.stack }),
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Get the session manager instance
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Get the data provider instance
   */
  getDataProvider(): DeltaExchangeProvider {
    return this.dataProvider;
  }

  /**
   * Shutdown the application gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down trading application...');

    try {
      // Stop all active sessions
      await this.sessionManager.stopAllSessions();

      // Disconnect data provider
      this.dataProvider.destroy();

      this.logger.info('Trading application shutdown completed');

    } catch (error) {
      this.logger.error('Error during application shutdown', { error });
      throw error;
    }
  }
}