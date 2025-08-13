const fs = require('fs');
const path = require('path');
const LiveDataFetcher = require('./liveDataFetcher');
const LiveDataFetcherWS = require('./liveDataFetcherWS');
const LiveTradingEngine = require('./liveTradingEngine');
require('dotenv').config({ override: true });

class LiveSessionManager {
  constructor(apiKey, apiSecret, baseUrl) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    
    this.dataFetcher = null;
    this.tradingEngine = null;
    this.isRunning = false;
    this.currentSession = null;
    this.sessionFile = path.join(__dirname, '..', 'live-sessions', 'current-session.json');
    this.sessionsDir = path.join(__dirname, '..', 'live-sessions');
    
    // Ensure sessions directory exists
    this.ensureSessionsDirectory();
  }

  ensureSessionsDirectory() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async startSession(symbol, strategyClass, options = {}) {
    if (this.isRunning) {
      throw new Error('A live trading session is already running. Stop the current session first.');
    }

    console.log(`🚀 Starting live trading session for ${symbol}...`);

    try {
      // Initialize components - use WebSocket version for better real-time performance
      this.dataFetcher = new LiveDataFetcherWS(this.apiKey, this.apiSecret, this.baseUrl);
      this.tradingEngine = new LiveTradingEngine(
        options.initialCapital || 100000,
        strategyClass,
        options.strategyParams || {}
      );

      // Create session metadata
      this.currentSession = {
        id: `session_${Date.now()}`,
        symbol,
        strategy: strategyClass.name,
        startTime: new Date().toISOString(),
        initialCapital: options.initialCapital || 100000,
        status: 'STARTING',
        trades: [],
        metrics: {}
      };

      // Set up event listeners
      this.setupEventListeners();

      // Start data fetcher
      this.dataFetcher.start(symbol);

      // Wait for initial history to load
      await new Promise((resolve, reject) => {
        this.dataFetcher.once('historyLoaded', () => {
          console.log('📊 Historical data loaded successfully');
          resolve();
        });
        this.dataFetcher.once('error', reject);
        
        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Timeout waiting for historical data')), 30000);
      });

      // Start trading engine
      this.tradingEngine.start(symbol);
      
      this.isRunning = true;
      this.currentSession.status = 'RUNNING';
      
      // Save session state
      this.saveSessionState();

      console.log(`✅ Live trading session started successfully!`);
      console.log(`📊 Session ID: ${this.currentSession.id}`);
      console.log(`💰 Initial Capital: $${this.currentSession.initialCapital.toLocaleString()}`);
      console.log(`📈 Strategy: ${this.currentSession.strategy}`);

      return this.currentSession;

    } catch (error) {
      console.error(`❌ Failed to start live trading session: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  setupEventListeners() {
    // Data fetcher events
    this.dataFetcher.on('newCandle', (candle, history) => {
      this.tradingEngine.processNewCandle(candle, history);
    });

    this.dataFetcher.on('error', (error) => {
      console.error(`📡 Data fetcher error: ${error.message}`);
      this.handleError(error);
    });

    // Trading engine events
    this.tradingEngine.on('trade', (tradeData) => {
      console.log(`💰 Trade executed: ${tradeData.signal.action} ${tradeData.signal.quantity} at $${tradeData.candle.close}`);
      this.currentSession.trades.push({
        timestamp: tradeData.candle.timestamp,
        signal: tradeData.signal,
        price: tradeData.candle.close,
        portfolio: tradeData.portfolio
      });
      this.saveSessionState();
    });

    this.tradingEngine.on('positionClosed', (positionData) => {
      console.log(`🔄 Position closed: PnL $${positionData.position.pnl?.toFixed(2) || 'N/A'}`);
      this.updateSessionMetrics();
      this.saveSessionState();
    });

    this.tradingEngine.on('candleProcessed', (data) => {
      // Update session with latest portfolio state
      this.currentSession.lastUpdate = new Date().toISOString();
      this.currentSession.currentPrice = data.candle.close;
      this.currentSession.portfolio = data.portfolio;
      
      // Save state every 5 minutes
      if (!this.lastSave || (Date.now() - this.lastSave) > 300000) {
        this.saveSessionState();
        this.lastSave = Date.now();
      }
    });

    this.tradingEngine.on('error', (error) => {
      console.error(`⚡ Trading engine error: ${error.message}`);
      this.handleError(error);
    });
  }

  async stopSession() {
    if (!this.isRunning) {
      throw new Error('No live trading session is currently running');
    }

    console.log(`🛑 Stopping live trading session...`);

    try {
      // Stop components
      if (this.dataFetcher) {
        this.dataFetcher.stop();
      }

      if (this.tradingEngine) {
        this.tradingEngine.stop();
      }

      // Update session
      this.currentSession.status = 'STOPPED';
      this.currentSession.endTime = new Date().toISOString();
      this.updateSessionMetrics();

      // Save final session state
      const finalSessionFile = path.join(this.sessionsDir, `${this.currentSession.id}.json`);
      fs.writeFileSync(finalSessionFile, JSON.stringify(this.currentSession, null, 2));

      console.log(`✅ Session stopped and saved to: ${finalSessionFile}`);
      console.log(`📊 Final metrics:`, this.currentSession.metrics);

      const session = { ...this.currentSession };
      this.cleanup();

      return session;

    } catch (error) {
      console.error(`❌ Error stopping session: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  updateSessionMetrics() {
    if (this.tradingEngine) {
      const status = this.tradingEngine.getStatus();
      this.currentSession.metrics = {
        ...status.metrics,
        portfolio: status.portfolio,
        openPositions: status.openPositions,
        duration: status.startTime ? Date.now() - status.startTime.getTime() : 0
      };
    }
  }

  saveSessionState() {
    if (this.currentSession) {
      try {
        fs.writeFileSync(this.sessionFile, JSON.stringify(this.currentSession, null, 2));
      } catch (error) {
        console.error(`⚠️  Failed to save session state: ${error.message}`);
      }
    }
  }

  loadSessionState() {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = fs.readFileSync(this.sessionFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`⚠️  Failed to load session state: ${error.message}`);
    }
    return null;
  }

  getSessionStatus() {
    if (!this.isRunning || !this.currentSession) {
      return {
        isRunning: false,
        message: 'No active session'
      };
    }

    this.updateSessionMetrics();

    return {
      isRunning: true,
      session: this.currentSession,
      dataFetcher: this.dataFetcher ? this.dataFetcher.getStatus() : null,
      tradingEngine: this.tradingEngine ? this.tradingEngine.getStatus() : null
    };
  }

  getAllSessions() {
    try {
      const files = fs.readdirSync(this.sessionsDir)
        .filter(file => file.endsWith('.json') && file !== 'current-session.json')
        .map(file => {
          try {
            const content = fs.readFileSync(path.join(this.sessionsDir, file), 'utf8');
            const session = JSON.parse(content);
            return {
              id: session.id,
              symbol: session.symbol,
              strategy: session.strategy,
              startTime: session.startTime,
              endTime: session.endTime,
              status: session.status,
              metrics: session.metrics || {}
            };
          } catch (error) {
            console.error(`Error reading session file ${file}: ${error.message}`);
            return null;
          }
        })
        .filter(session => session !== null)
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      return files;
    } catch (error) {
      console.error(`Error reading sessions directory: ${error.message}`);
      return [];
    }
  }

  getSession(sessionId) {
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`Error reading session ${sessionId}: ${error.message}`);
    }
    return null;
  }

  handleError(error) {
    console.error(`💥 Critical error in live session: ${error.message}`);
    
    if (this.currentSession) {
      this.currentSession.status = 'ERROR';
      this.currentSession.error = error.message;
      this.currentSession.errorTime = new Date().toISOString();
      this.saveSessionState();
    }

    // Optionally auto-stop on critical errors
    // this.stopSession().catch(console.error);
  }

  cleanup() {
    this.isRunning = false;
    this.currentSession = null;
    this.dataFetcher = null;
    this.tradingEngine = null;
    
    // Remove current session file
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
    } catch (error) {
      console.error(`Error cleaning up session file: ${error.message}`);
    }
  }

  async restoreSession() {
    const savedSession = this.loadSessionState();
    
    if (savedSession && savedSession.status === 'RUNNING') {
      console.log(`🔄 Found active session ${savedSession.id}, attempting to restore...`);
      
      try {
        // Try to restart the session (this is a simplified restore)
        console.log(`⚠️  Note: Full session restore not implemented. Please start a new session.`);
        this.cleanup();
        return false;
      } catch (error) {
        console.error(`Failed to restore session: ${error.message}`);
        this.cleanup();
        return false;
      }
    }
    
    return false;
  }
}

module.exports = LiveSessionManager;