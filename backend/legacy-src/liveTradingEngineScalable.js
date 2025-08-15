const { Portfolio } = require('./backtestEngine');
const EventEmitter = require('events');
const DataManager = require('./dataManager');

class LiveTradingEngineScalable extends EventEmitter {
  constructor(initialCapital = 100000, strategyClass, strategyParams = {}) {
    super();
    this.portfolio = new Portfolio(initialCapital);
    this.strategy = new strategyClass(strategyParams.positionSize || 0.1);
    this.symbol = null;
    this.isRunning = false;
    this.startTime = null;
    
    // Initialize data manager for scalability
    this.dataManager = new DataManager({
      maxTradesInMemory: 1000,
      maxCandleHistory: 500,
      logRetentionDays: 7,
      tradeRetentionDays: 30
    });
    
    // Use circular buffers instead of unbounded arrays
    this.trades = this.dataManager.createTradesBuffer();
    this.candleHistory = this.dataManager.createCandleBuffer();
    
    this.openPositions = new Map();
    this.performanceMetrics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      winRate: 0,
      lastUpdate: null
    };
    this.maxEquity = initialCapital;
    this.minEquity = initialCapital;
    
    // Memory monitoring
    this.memoryCheckInterval = setInterval(() => {
      if (this.dataManager.checkMemoryUsage(500)) {
        console.warn('⚠️ Memory usage high, consider restarting the engine');
        this.emit('memoryWarning', this.dataManager.getMemoryStats());
      }
    }, 60000); // Check every minute
  }

  start(symbol) {
    if (this.isRunning) {
      console.log('⚠️  Trading engine is already running');
      return;
    }

    this.isRunning = true;
    this.symbol = symbol;
    this.startTime = new Date();
    
    console.log(`🚀 Scalable live trading engine started for ${symbol}`);
    console.log(`💰 Initial capital: $${this.portfolio.initialCapital.toLocaleString()}`);
    console.log(`📊 Strategy: ${this.strategy.name}`);
    console.log(`🔧 Max trades in memory: ${this.trades.getAll().length}/${1000}`);
    console.log(`📈 Max candle history: ${this.candleHistory.size()}/${500}`);
    
    this.emit('started', {
      symbol,
      initialCapital: this.portfolio.initialCapital,
      strategy: this.strategy.name,
      startTime: this.startTime,
      memoryLimits: {
        maxTrades: 1000,
        maxCandles: 500
      }
    });
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Trading engine is not running');
      return;
    }

    this.isRunning = false;
    const endTime = new Date();
    const duration = endTime - this.startTime;
    
    // Close any remaining positions
    if (this.candleHistory.size() > 0) {
      const candles = this.candleHistory.getAll();
      const lastCandle = candles[candles.length - 1];
      this.closeAllPositions(lastCandle.close, lastCandle.timestamp, 'Session ended');
    }

    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    // Stop cleanup scheduler
    this.dataManager.stopCleanupScheduler();

    this.calculateFinalMetrics();
    
    const memStats = this.dataManager.getMemoryStats();
    console.log(`🛑 Trading engine stopped after ${Math.floor(duration / 60000)} minutes`);
    console.log(`📈 Final equity: $${this.portfolio.equity.toLocaleString()}`);
    console.log(`📊 Total trades: ${this.performanceMetrics.totalTrades}`);
    console.log(`💾 Memory usage: ${memStats.heapUsed}MB`);
    console.log(`📁 Trades in memory: ${this.trades.size()}`);
    
    this.emit('stopped', {
      duration,
      finalEquity: this.portfolio.equity,
      totalTrades: this.performanceMetrics.totalTrades,
      metrics: this.performanceMetrics,
      memoryStats: memStats
    });
  }

  processNewCandle(candle, historicalData) {
    if (!this.isRunning) return;

    // Update candle history with circular buffer
    this.candleHistory.update(historicalData);
    
    // Update portfolio equity
    const currentPrices = { [this.symbol]: candle.close };
    this.portfolio.getCurrentValue(currentPrices);
    
    // Track equity for drawdown
    if (this.portfolio.equity > this.maxEquity) {
      this.maxEquity = this.portfolio.equity;
    }
    if (this.portfolio.equity < this.minEquity) {
      this.minEquity = this.portfolio.equity;
    }

    try {
      // Generate trading signal
      const signal = this.strategy.generateSignal(
        candle, 
        this.candleHistory.getAll(), 
        this.portfolio
      );
      
      if (signal && (signal.action === 'BUY' || signal.action === 'SELL')) {
        console.log(`📢 Signal: ${signal.action} ${signal.quantity} at ${candle.close} - ${signal.reason}`);
        
        const executed = this.executeSignal(signal, candle);
        
        if (executed) {
          this.emit('trade', {
            signal,
            candle,
            portfolio: this.getPortfolioSnapshot()
          });
        }
      }

      // Check stop loss and take profit
      this.checkStopLossAndTakeProfit(candle);

      // Update metrics
      this.updateMetrics();

      // Emit event
      this.emit('candleProcessed', {
        candle,
        portfolio: this.getPortfolioSnapshot(),
        signal: signal || null,
        dataStats: {
          tradesInMemory: this.trades.size(),
          candlesInMemory: this.candleHistory.size()
        }
      });

    } catch (error) {
      console.error(`❌ Error processing candle: ${error.message}`);
      this.emit('error', error);
    }
  }

  executeSignal(signal, candle) {
    if (!this.isRunning) return false;

    const price = candle.close;
    
    try {
      // Close existing positions before opening new ones
      if (this.openPositions.size > 0) {
        console.log(`🔄 Closing ${this.openPositions.size} existing position(s)`);
        this.closeAllPositions(price, candle.timestamp, 'New signal - closing existing');
      }

      if (signal.action === 'BUY' && signal.quantity > 0) {
        if (signal.signal_type === 'LONG_ENTRY' && this.portfolio.canBuy(this.symbol, signal.quantity, price)) {
          this.portfolio.buy(this.symbol, signal.quantity, price, candle.timestamp);
          
          const tradeId = `${this.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const trade = {
            id: tradeId,
            symbol: this.symbol,
            type: 'BUY',
            signal_type: signal.signal_type,
            quantity: signal.quantity,
            entryPrice: price,
            entryTime: candle.timestamp,
            reason: signal.reason,
            takeProfitPrice: signal.takeProfitPrice,
            stopLossPrice: signal.stopLossPrice,
            status: 'OPEN'
          };
          
          this.openPositions.set(tradeId, trade);
          this.trades.push({...trade});
          
          console.log(`✅ BUY executed: ${signal.quantity} at $${price} | ID: ${tradeId}`);
          console.log(`📊 Trades in memory: ${this.trades.size()}/1000`);
          return true;
        }
      } else if (signal.action === 'SELL' && signal.quantity > 0) {
        if (signal.signal_type === 'SHORT_ENTRY') {
          this.portfolio.sellShort(this.symbol, signal.quantity, price, candle.timestamp);
          
          const tradeId = `${this.symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const trade = {
            id: tradeId,
            symbol: this.symbol,
            type: 'SELL_SHORT',
            signal_type: signal.signal_type,
            quantity: signal.quantity,
            entryPrice: price,
            entryTime: candle.timestamp,
            reason: signal.reason,
            takeProfitPrice: signal.takeProfitPrice,
            stopLossPrice: signal.stopLossPrice,
            status: 'OPEN'
          };
          
          this.openPositions.set(tradeId, trade);
          this.trades.push({...trade});
          
          console.log(`✅ SELL SHORT executed: ${signal.quantity} at $${price} | ID: ${tradeId}`);
          console.log(`📊 Trades in memory: ${this.trades.size()}/1000`);
          return true;
        }
      }
    } catch (error) {
      console.error(`❌ Trade execution failed: ${error.message}`);
      return false;
    }
    
    return false;
  }

  checkStopLossAndTakeProfit(candle) {
    const currentPrice = candle.close;
    const positionsToClose = [];

    for (const [tradeId, position] of this.openPositions) {
      if (position.status !== 'OPEN') continue;

      let shouldClose = false;
      let reason = '';

      if (position.type === 'BUY') {
        if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
          shouldClose = true;
          reason = 'Stop Loss Hit';
        } else if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
          shouldClose = true;
          reason = 'Take Profit Hit';
        }
      } else if (position.type === 'SELL_SHORT') {
        if (position.stopLossPrice && currentPrice >= position.stopLossPrice) {
          shouldClose = true;
          reason = 'Stop Loss Hit';
        } else if (position.takeProfitPrice && currentPrice <= position.takeProfitPrice) {
          shouldClose = true;
          reason = 'Take Profit Hit';
        }
      }

      if (shouldClose) {
        positionsToClose.push({ tradeId, position, reason });
      }
    }

    for (const { tradeId, position, reason } of positionsToClose) {
      this.closePosition(tradeId, position, currentPrice, candle.timestamp, reason);
    }
  }

  closePosition(tradeId, position, exitPrice, exitTime, reason) {
    try {
      if (position.type === 'BUY') {
        this.portfolio.sell(this.symbol, position.quantity, exitPrice, exitTime);
      } else if (position.type === 'SELL_SHORT') {
        this.portfolio.buy(this.symbol, position.quantity, exitPrice, exitTime);
      }

      let pnl;
      if (position.type === 'BUY') {
        pnl = (exitPrice - position.entryPrice) * position.quantity;
      } else {
        pnl = (position.entryPrice - exitPrice) * position.quantity;
      }

      const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
      const holdingPeriod = Math.floor((exitTime - position.entryTime) / (1000 * 60));

      position.exitPrice = exitPrice;
      position.exitTime = exitTime;
      position.pnl = pnl;
      position.pnlPercent = pnlPercent;
      position.holdingPeriod = holdingPeriod;
      position.exitReason = reason;
      position.status = 'CLOSED';

      this.openPositions.delete(tradeId);

      console.log(`🔄 Position closed: ${position.type} ${position.quantity} | Entry: $${position.entryPrice} Exit: $${exitPrice} | PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%) | Reason: ${reason}`);

      this.emit('positionClosed', {
        position,
        portfolio: this.getPortfolioSnapshot()
      });

      return true;
    } catch (error) {
      console.error(`❌ Error closing position ${tradeId}: ${error.message}`);
      return false;
    }
  }

  closeAllPositions(exitPrice, exitTime, reason) {
    const openPositions = Array.from(this.openPositions.entries());
    
    for (const [tradeId, position] of openPositions) {
      this.closePosition(tradeId, position, exitPrice, exitTime, reason);
    }
  }

  updateMetrics() {
    const allTrades = this.trades.getAll();
    const closedTrades = allTrades.filter(trade => trade.status === 'CLOSED');
    
    if (closedTrades.length > 0) {
      const winningTrades = closedTrades.filter(trade => trade.pnl > 0);
      const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      
      this.performanceMetrics.totalTrades = closedTrades.length;
      this.performanceMetrics.winningTrades = winningTrades.length;
      this.performanceMetrics.losingTrades = closedTrades.length - winningTrades.length;
      this.performanceMetrics.totalPnl = totalPnl;
      this.performanceMetrics.winRate = (winningTrades.length / closedTrades.length) * 100;
      
      const drawdown = ((this.maxEquity - this.portfolio.equity) / this.maxEquity) * 100;
      if (drawdown > this.performanceMetrics.maxDrawdown) {
        this.performanceMetrics.maxDrawdown = drawdown;
      }
    }
    
    this.performanceMetrics.lastUpdate = new Date();
  }

  calculateFinalMetrics() {
    this.updateMetrics();
  }

  getPortfolioSnapshot() {
    return {
      cash: this.portfolio.cash,
      equity: this.portfolio.equity,
      positions: Array.from(this.portfolio.positions.entries()).map(([symbol, pos]) => ({
        symbol,
        quantity: pos.quantity,
        avgPrice: pos.avgPrice
      })),
      totalReturn: ((this.portfolio.equity - this.portfolio.initialCapital) / this.portfolio.initialCapital) * 100
    };
  }

  getStatus() {
    const memStats = this.dataManager.getMemoryStats();
    const candles = this.candleHistory.getAll();
    
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      startTime: this.startTime,
      strategy: this.strategy.name,
      portfolio: this.getPortfolioSnapshot(),
      openPositions: this.openPositions.size,
      metrics: this.performanceMetrics,
      lastCandle: candles.length > 0 ? candles[candles.length - 1] : null,
      dataStats: {
        tradesInMemory: this.trades.size(),
        maxTradesInMemory: 1000,
        candlesInMemory: this.candleHistory.size(),
        maxCandlesInMemory: 500,
        memoryUsageMB: memStats.heapUsed
      }
    };
  }

  getTrades() {
    return this.trades.getAll();
  }

  getRecentTrades(count = 20) {
    return this.trades.getRecent(count);
  }

  getOpenPositions() {
    return Array.from(this.openPositions.values());
  }
}

module.exports = LiveTradingEngineScalable;