const { Portfolio } = require('./backtestEngine');
const EventEmitter = require('events');

class LiveTradingEngine extends EventEmitter {
  constructor(initialCapital = 100000, strategyClass, strategyParams = {}) {
    super();
    this.portfolio = new Portfolio(initialCapital);
    this.strategy = new strategyClass(strategyParams.positionSize || 0.1);
    this.symbol = null;
    this.isRunning = false;
    this.startTime = null;
    this.trades = [];
    this.openPositions = new Map();
    this.candleHistory = [];
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
  }

  start(symbol) {
    if (this.isRunning) {
      console.log('⚠️  Trading engine is already running');
      return;
    }

    this.isRunning = true;
    this.symbol = symbol;
    this.startTime = new Date();
    
    console.log(`🚀 Live trading engine started for ${symbol}`);
    console.log(`💰 Initial capital: $${this.portfolio.initialCapital.toLocaleString()}`);
    console.log(`📊 Strategy: ${this.strategy.name}`);
    
    this.emit('started', {
      symbol,
      initialCapital: this.portfolio.initialCapital,
      strategy: this.strategy.name,
      startTime: this.startTime
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
    
    // Close any remaining positions at current market price
    if (this.candleHistory.length > 0) {
      const lastCandle = this.candleHistory[this.candleHistory.length - 1];
      this.closeAllPositions(lastCandle.close, lastCandle.timestamp, 'Session ended');
    }

    this.calculateFinalMetrics();
    
    console.log(`🛑 Trading engine stopped after ${Math.floor(duration / 60000)} minutes`);
    console.log(`📈 Final equity: $${this.portfolio.equity.toLocaleString()}`);
    console.log(`📊 Total trades: ${this.performanceMetrics.totalTrades}`);
    
    this.emit('stopped', {
      duration,
      finalEquity: this.portfolio.equity,
      totalTrades: this.performanceMetrics.totalTrades,
      metrics: this.performanceMetrics
    });
  }

  processNewCandle(candle, historicalData) {
    if (!this.isRunning) return;

    // Update candle history
    this.candleHistory = [...historicalData];
    
    // Update portfolio equity with current prices
    const currentPrices = { [this.symbol]: candle.close };
    this.portfolio.getCurrentValue(currentPrices);
    
    // Track equity for drawdown calculation
    if (this.portfolio.equity > this.maxEquity) {
      this.maxEquity = this.portfolio.equity;
    }
    if (this.portfolio.equity < this.minEquity) {
      this.minEquity = this.portfolio.equity;
    }

    try {
      // Generate trading signal from strategy
      const signal = this.strategy.generateSignal(candle, historicalData, this.portfolio);
      
      if (signal && (signal.action === 'BUY' || signal.action === 'SELL')) {
        console.log(`📢 Signal generated: ${signal.action} ${signal.quantity} at ${candle.close} - ${signal.reason}`);
        
        // Execute the signal
        const executed = this.executeSignal(signal, candle);
        
        if (executed) {
          this.emit('trade', {
            signal,
            candle,
            portfolio: this.getPortfolioSnapshot()
          });
        }
      }

      // Check for stop loss and take profit
      this.checkStopLossAndTakeProfit(candle);

      // Update real-time metrics
      this.updateMetrics();

      // Emit candle processed event
      this.emit('candleProcessed', {
        candle,
        portfolio: this.getPortfolioSnapshot(),
        signal: signal || null
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
      // FORCE SINGLE POSITION: Close any existing positions before opening new ones
      if (this.openPositions.size > 0) {
        console.log(`🔄 Closing ${this.openPositions.size} existing position(s) before opening new position`);
        this.closeAllPositions(price, candle.timestamp, 'New signal - closing existing position');
      }

      if (signal.action === 'BUY' && signal.quantity > 0) {
        // Handle buy signal
        if (signal.signal_type === 'LONG_ENTRY' && this.portfolio.canBuy(this.symbol, signal.quantity, price)) {
          // Open long position
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
          
          console.log(`✅ BUY executed: ${signal.quantity} at $${price} | Position ID: ${tradeId}`);
          return true;
        }
      } else if (signal.action === 'SELL' && signal.quantity > 0) {
        // Handle sell signal
        if (signal.signal_type === 'SHORT_ENTRY') {
          // Open short position
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
          
          console.log(`✅ SELL SHORT executed: ${signal.quantity} at $${price} | Position ID: ${tradeId}`);
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
        // Long position
        if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
          shouldClose = true;
          reason = 'Stop Loss Hit';
        } else if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
          shouldClose = true;
          reason = 'Take Profit Hit';
        }
      } else if (position.type === 'SELL_SHORT') {
        // Short position
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

    // Close positions
    for (const { tradeId, position, reason } of positionsToClose) {
      this.closePosition(tradeId, position, currentPrice, candle.timestamp, reason);
    }
  }

  closePosition(tradeId, position, exitPrice, exitTime, reason) {
    try {
      if (position.type === 'BUY') {
        // Close long position
        this.portfolio.sell(this.symbol, position.quantity, exitPrice, exitTime);
      } else if (position.type === 'SELL_SHORT') {
        // Close short position
        this.portfolio.buy(this.symbol, position.quantity, exitPrice, exitTime);
      }

      // Calculate PnL
      let pnl;
      if (position.type === 'BUY') {
        pnl = (exitPrice - position.entryPrice) * position.quantity;
      } else {
        pnl = (position.entryPrice - exitPrice) * position.quantity;
      }

      const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
      const holdingPeriod = Math.floor((exitTime - position.entryTime) / (1000 * 60));

      // Update position
      position.exitPrice = exitPrice;
      position.exitTime = exitTime;
      position.pnl = pnl;
      position.pnlPercent = pnlPercent;
      position.holdingPeriod = holdingPeriod;
      position.exitReason = reason;
      position.status = 'CLOSED';

      // Remove from open positions
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
    const closedTrades = this.trades.filter(trade => trade.status === 'CLOSED');
    
    this.performanceMetrics.totalTrades = closedTrades.length;
    this.performanceMetrics.winningTrades = closedTrades.filter(trade => trade.pnl > 0).length;
    this.performanceMetrics.losingTrades = closedTrades.filter(trade => trade.pnl < 0).length;
    this.performanceMetrics.totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    this.performanceMetrics.winRate = this.performanceMetrics.totalTrades > 0 ? 
      (this.performanceMetrics.winningTrades / this.performanceMetrics.totalTrades) * 100 : 0;
    
    // Calculate drawdown
    if (this.maxEquity > 0) {
      this.performanceMetrics.maxDrawdown = ((this.maxEquity - this.minEquity) / this.maxEquity) * 100;
    }
    
    this.performanceMetrics.lastUpdate = new Date();
  }

  calculateFinalMetrics() {
    this.updateMetrics();
    
    const totalReturn = ((this.portfolio.equity - this.portfolio.initialCapital) / this.portfolio.initialCapital) * 100;
    
    this.performanceMetrics.totalReturn = totalReturn;
    this.performanceMetrics.finalEquity = this.portfolio.equity;
    this.performanceMetrics.duration = this.startTime ? new Date() - this.startTime : 0;
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
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      startTime: this.startTime,
      strategy: this.strategy.name,
      portfolio: this.getPortfolioSnapshot(),
      openPositions: this.openPositions.size,
      metrics: this.performanceMetrics,
      lastCandle: this.candleHistory.length > 0 ? this.candleHistory[this.candleHistory.length - 1] : null
    };
  }

  getTrades() {
    return [...this.trades];
  }

  getOpenPositions() {
    return Array.from(this.openPositions.values());
  }
}

module.exports = LiveTradingEngine;