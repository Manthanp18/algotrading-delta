const EventEmitter = require('events');

class LiveDashboard extends EventEmitter {
  constructor(sessionManager) {
    super();
    this.sessionManager = sessionManager;
    this.isRunning = false;
    this.updateInterval = null;
    this.updateFrequency = 5000; // Update every 5 seconds
    this.lastUpdate = null;
    this.console = console;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  Dashboard is already running');
      return;
    }

    this.isRunning = true;
    console.log('📊 Starting live dashboard...');
    
    // Initial display
    this.displayDashboard();
    
    // Set up periodic updates
    this.updateInterval = setInterval(() => {
      this.displayDashboard();
    }, this.updateFrequency);

    console.log(`✅ Dashboard started (updates every ${this.updateFrequency/1000}s)`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Dashboard is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    console.log('🛑 Dashboard stopped');
  }

  displayDashboard() {
    const status = this.sessionManager.getSessionStatus();
    
    if (!status.isRunning) {
      this.displayNoSession();
      return;
    }

    try {
      // Clear screen and move cursor to top
      process.stdout.write('\x1B[2J\x1B[0f');
      
      const session = status.session;
      const tradingEngine = status.tradingEngine;
      const dataFetcher = status.dataFetcher;
      
      // Header
      this.printHeader(session);
      
      // Session Info
      this.printSessionInfo(session, dataFetcher);
      
      // Portfolio Status
      this.printPortfolioStatus(session);
      
      // Trading Performance
      this.printTradingPerformance(session);
      
      // Open Positions
      if (tradingEngine && tradingEngine.openPositions > 0) {
        this.printOpenPositions(tradingEngine);
      }
      
      // Recent Activity
      this.printRecentActivity(session);
      
      // Market Data
      this.printMarketData(session, dataFetcher);
      
      // Footer
      this.printFooter();
      
      this.lastUpdate = new Date();
      
    } catch (error) {
      console.error(`❌ Dashboard error: ${error.message}`);
    }
  }

  displayNoSession() {
    process.stdout.write('\x1B[2J\x1B[0f');
    
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                          📊 LIVE TRADING DASHBOARD                      ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🔴 No Active Trading Session');
    console.log('');
    console.log('💡 Start a session with: node cli.js live [symbol] [capital]');
    console.log('');
    console.log(`📅 ${new Date().toLocaleString()}`);
  }

  printHeader(session) {
    const line = '═'.repeat(78);
    console.log(`╔${line}╗`);
    console.log('║                          📊 LIVE TRADING DASHBOARD                      ║');
    console.log(`║                           Session: ${session.id.substring(0, 20).padEnd(20)}    ║`);
    console.log(`╚${line}╝`);
    console.log('');
  }

  printSessionInfo(session, dataFetcher) {
    const startTime = new Date(session.startTime);
    const duration = Date.now() - startTime.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log('📋 SESSION INFO');
    console.log('─'.repeat(50));
    console.log(`Symbol: ${session.symbol}                Strategy: ${session.strategy}`);
    console.log(`Status: 🟢 ACTIVE              Started: ${startTime.toLocaleString()}`);
    console.log(`Duration: ${hours}h ${minutes}m           Data Feed: ${dataFetcher?.isRunning ? '🟢 Connected' : '🔴 Disconnected'}`);
    console.log('');
  }

  printPortfolioStatus(session) {
    const portfolio = session.portfolio || {};
    const initialCapital = session.initialCapital || 100000;
    const currentEquity = portfolio.equity || initialCapital;
    const totalReturn = portfolio.totalReturn || 0;
    const cash = portfolio.cash || initialCapital;
    
    console.log('💰 PORTFOLIO STATUS');
    console.log('─'.repeat(50));
    console.log(`Initial Capital: $${initialCapital.toLocaleString().padEnd(15)} Current Equity: $${currentEquity.toLocaleString()}`);
    console.log(`Available Cash:  $${cash.toLocaleString().padEnd(15)} Total Return:   ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
    
    // Add position info if available
    if (portfolio.positions && portfolio.positions.length > 0) {
      const position = portfolio.positions[0]; // Assuming single position
      console.log(`Position Size:   ${position.quantity.toFixed(6).padEnd(15)} Avg Price:      $${position.avgPrice.toFixed(2)}`);
    } else {
      console.log(`Position Size:   0                 Avg Price:      N/A`);
    }
    console.log('');
  }

  printTradingPerformance(session) {
    const metrics = session.metrics || {};
    
    console.log('📈 TRADING PERFORMANCE');
    console.log('─'.repeat(50));
    console.log(`Total Trades:    ${(metrics.totalTrades || 0).toString().padEnd(15)} Win Rate:       ${(metrics.winRate || 0).toFixed(1)}%`);
    console.log(`Winning Trades:  ${(metrics.winningTrades || 0).toString().padEnd(15)} Losing Trades:  ${metrics.losingTrades || 0}`);
    console.log(`Total PnL:       $${(metrics.totalPnl || 0).toFixed(2).padEnd(14)} Max Drawdown:   ${(metrics.maxDrawdown || 0).toFixed(2)}%`);
    console.log('');
  }

  printOpenPositions(tradingEngine) {
    console.log('🔄 OPEN POSITIONS');
    console.log('─'.repeat(50));
    
    const openPositions = tradingEngine.getOpenPositions?.() || [];
    
    if (openPositions.length === 0) {
      console.log('No open positions');
    } else {
      openPositions.slice(0, 3).forEach((position, index) => {
        const side = position.type === 'BUY' ? 'LONG' : 'SHORT';
        const entryPrice = position.entryPrice.toFixed(2);
        const quantity = position.quantity.toFixed(6);
        const holdingTime = Math.floor((Date.now() - position.entryTime) / (1000 * 60));
        
        console.log(`${index + 1}. ${side} ${quantity} @ $${entryPrice} (${holdingTime}m ago)`);
      });
      
      if (openPositions.length > 3) {
        console.log(`... and ${openPositions.length - 3} more positions`);
      }
    }
    console.log('');
  }

  printRecentActivity(session) {
    console.log('📊 RECENT ACTIVITY');
    console.log('─'.repeat(50));
    
    const trades = session.trades || [];
    const recentTrades = trades.slice(-3);
    
    if (recentTrades.length === 0) {
      console.log('No recent trades');
    } else {
      recentTrades.forEach((trade, index) => {
        const time = new Date(trade.timestamp).toLocaleTimeString();
        const action = trade.signal.action;
        const quantity = trade.signal.quantity.toFixed(6);
        const price = trade.price.toFixed(2);
        const reason = trade.signal.reason.substring(0, 30);
        
        console.log(`${time} | ${action} ${quantity} @ $${price}`);
        console.log(`         └─ ${reason}${reason.length > 30 ? '...' : ''}`);
      });
    }
    console.log('');
  }

  printMarketData(session, dataFetcher) {
    console.log('📈 MARKET DATA');
    console.log('─'.repeat(50));
    
    if (session.currentPrice) {
      console.log(`Current Price:   $${session.currentPrice.toLocaleString()}`);
    } else {
      console.log('Current Price:   N/A');
    }
    
    if (dataFetcher) {
      const status = dataFetcher.getStatus?.() || {};
      console.log(`Last Update:     ${status.lastCandleTime ? new Date(status.lastCandleTime).toLocaleTimeString() : 'N/A'}`);
      console.log(`History Length:  ${status.historyLength || 0} candles`);
    }
    console.log('');
  }

  printFooter() {
    console.log('─'.repeat(78));
    console.log(`📅 Last Updated: ${new Date().toLocaleString().padEnd(30)} 🔄 Auto-refresh: ${this.updateFrequency/1000}s`);
    console.log('💡 Press Ctrl+C to stop dashboard');
    console.log('');
    console.log('Commands: node cli.js live-stop | live-status | live-list');
  }

  displayCompactStatus() {
    const status = this.sessionManager.getSessionStatus();
    
    if (!status.isRunning) {
      console.log('🔴 No active session');
      return;
    }

    const session = status.session;
    const portfolio = session.portfolio || {};
    const metrics = session.metrics || {};
    
    const equity = portfolio.equity || session.initialCapital;
    const returnPct = portfolio.totalReturn || 0;
    const trades = metrics.totalTrades || 0;
    const winRate = metrics.winRate || 0;
    
    console.log(`🟢 ${session.symbol} | $${equity.toLocaleString()} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%) | ${trades} trades (${winRate.toFixed(1)}% win)`);
  }

  // Method to display status in a single line (useful for other parts of the system)
  getStatusLine() {
    const status = this.sessionManager.getSessionStatus();
    
    if (!status.isRunning) {
      return '🔴 No active session';
    }

    const session = status.session;
    const portfolio = session.portfolio || {};
    const returnPct = portfolio.totalReturn || 0;
    const equity = portfolio.equity || session.initialCapital;
    
    return `🟢 ${session.symbol} $${equity.toLocaleString()} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%)`;
  }

  setUpdateFrequency(seconds) {
    this.updateFrequency = seconds * 1000;
    
    if (this.isRunning) {
      // Restart with new frequency
      this.stop();
      this.start();
    }
  }
}

module.exports = LiveDashboard;