#!/usr/bin/env node

const axios = require('axios');
const ConfluenceScalpingStrategy = require('./src/strategies/confluenceScalpingStrategy');
const LiveTradingEngine = require('./src/liveTradingEngine');
const DashboardServer = require('./dashboard/server');

class ServerLiveTrader {
  constructor(symbol, initialCapital, dashboardPort = 3000) {
    this.symbol = symbol;
    this.initialCapital = initialCapital;
    this.baseUrl = 'https://api.india.delta.exchange';
    this.tradingEngine = new LiveTradingEngine(initialCapital, ConfluenceScalpingStrategy, { positionSize: 0.1 });
    this.dashboard = new DashboardServer(dashboardPort);
    
    this.candleHistory = [];
    this.maxHistoryLength = 100;
    this.isRunning = false;
    this.pollInterval = null;
    this.lastCandleTime = 0;
    this.pollIntervalMs = 5000; // Check every 5 seconds for new candles
    this.startTime = null;
    this.lastPrice = null;
    
    // Session tracking
    this.sessionData = {
      symbol: this.symbol,
      strategy: 'Confluence Scalping Strategy',
      initialCapital: this.initialCapital,
      startTime: null,
      portfolio: null,
      metrics: null,
      lastCandleTime: null,
      lastPrice: null,
      openPositions: 0
    };
  }

  async makeRequest(endpoint, params = {}) {
    const url = this.baseUrl + endpoint + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
    
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'server-live-trader/1.0.0'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  formatCandleData(rawData) {
    if (!rawData || !rawData.result) {
      throw new Error('Invalid candle data received');
    }

    return rawData.result.map(candle => ({
      timestamp: new Date(candle.time * 1000),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume || 0)
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  async loadInitialHistory() {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (100 * 60); // Last 100 minutes
    
    const params = {
      symbol: this.symbol,
      resolution: '1m',
      start: startTime,
      end: endTime
    };

    console.log(`📊 Loading initial history for ${this.symbol}...`);
    const data = await this.makeRequest('/v2/history/candles', params);
    const candles = this.formatCandleData(data);
    
    this.candleHistory = candles;
    if (candles.length > 0) {
      this.lastCandleTime = candles[candles.length - 1].timestamp.getTime();
      this.lastPrice = candles[candles.length - 1].close;
      console.log(`✅ Loaded ${candles.length} historical candles`);
      console.log(`📈 Latest: ${new Date(this.lastCandleTime).toISOString()} | Close: $${this.lastPrice}`);
    }
    
    return candles;
  }

  async checkForNewCandles() {
    if (!this.isRunning) return;

    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = Math.floor(this.lastCandleTime / 1000) - 60; // Check from 1 minute before last candle
      
      const params = {
        symbol: this.symbol,
        resolution: '1m',
        start: startTime,
        end: endTime
      };

      const data = await this.makeRequest('/v2/history/candles', params);
      const latestCandles = this.formatCandleData(data);
      
      // Find new candles
      const newCandles = latestCandles.filter(candle => 
        candle.timestamp.getTime() > this.lastCandleTime
      );

      if (newCandles.length > 0) {
        console.log(`\n🕐 NEW CANDLES FOUND: ${newCandles.length}`);
        
        for (const candle of newCandles) {
          // Add to history
          this.candleHistory.push(candle);
          
          // Trim history
          if (this.candleHistory.length > this.maxHistoryLength) {
            this.candleHistory = this.candleHistory.slice(-this.maxHistoryLength);
          }
          
          // Update tracking
          this.lastCandleTime = candle.timestamp.getTime();
          this.lastPrice = candle.close;
          
          // Display candle
          console.log(`📊 ${candle.timestamp.toISOString().substring(11, 19)} | O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);
          
          // Process with trading engine
          this.tradingEngine.processNewCandle(candle, [...this.candleHistory]);
          
          // Update session data
          await this.updateSessionData();
        }
      } else {
        // Periodic session update even without new candles
        if (!this.lastSessionUpdate || (Date.now() - this.lastSessionUpdate) > 30000) {
          await this.updateSessionData();
          this.lastSessionUpdate = Date.now();
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error checking for new candles: ${error.message}`);
    }
  }

  async updateSessionData() {
    try {
      const engineStatus = this.tradingEngine.getStatus();
      
      this.sessionData = {
        ...this.sessionData,
        startTime: this.startTime.toISOString(),
        portfolio: engineStatus.portfolio,
        metrics: engineStatus.metrics,
        lastCandleTime: this.lastCandleTime ? new Date(this.lastCandleTime).toISOString() : null,
        lastPrice: this.lastPrice,
        openPositions: engineStatus.openPositions || 0
      };
      
      await this.dashboard.updateSessionData(this.sessionData);
      
    } catch (error) {
      console.error('Error updating session data:', error.message);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Already running');
      return;
    }

    console.log(`🚀 STARTING SERVER LIVE TRADER WITH DASHBOARD`);
    console.log(`📊 Symbol: ${this.symbol}`);
    console.log(`💰 Capital: $${this.initialCapital.toLocaleString()}`);
    console.log(`⏱️  Polling every ${this.pollIntervalMs/1000} seconds for new candles`);
    console.log('');

    try {
      // Start dashboard server first
      console.log('🌐 Starting dashboard server...');
      await this.dashboard.start();
      
      // Load initial history
      await this.loadInitialHistory();
      
      // Start trading engine
      this.tradingEngine.start(this.symbol);
      this.startTime = new Date();
      
      // Set up trading engine events with dashboard integration
      this.tradingEngine.on('trade', async (tradeData) => {
        const trade = {
          type: tradeData.signal.action,
          signal_type: tradeData.signal.signal_type,
          quantity: tradeData.signal.quantity,
          entryPrice: tradeData.candle.close,
          entryTime: tradeData.candle.timestamp,
          reason: tradeData.signal.reason,
          status: 'OPEN'
        };
        
        console.log(`\n💰 TRADE: ${trade.type} ${trade.quantity.toFixed(6)} at $${trade.entryPrice.toLocaleString()}`);
        console.log(`📋 Reason: ${trade.reason}`);
        
        // Save trade to dashboard
        await this.dashboard.saveTrade(trade);
        await this.updateSessionData();
      });

      this.tradingEngine.on('positionClosed', async (positionData) => {
        const position = positionData.position;
        const pnl = position.pnl || 0;
        const pnlPercent = position.pnlPercent || 0;
        const side = position.type === 'BUY' ? 'LONG' : 'SHORT';
        
        console.log(`\n🔄 CLOSED ${side}: PnL $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
        
        // Update trade record with exit info
        const updatedTrade = {
          ...position,
          status: 'CLOSED',
          exitTime: position.exitTime,
          exitPrice: position.exitPrice,
          pnl: pnl,
          pnlPercent: pnlPercent
        };
        
        await this.dashboard.saveTrade(updatedTrade);
        await this.updateSessionData();
      });

      // Initial session data update
      await this.updateSessionData();

      // Start polling for new candles
      this.isRunning = true;
      this.pollInterval = setInterval(() => {
        this.checkForNewCandles();
      }, this.pollIntervalMs);

      console.log('✅ Server live trading started!');
      console.log(`🌐 Dashboard URL: ${this.dashboard.getUrl()}`);
      console.log('💡 Press Ctrl+C to stop\n');

      // Display dashboard URL periodically
      setInterval(() => {
        if (this.isRunning) {
          console.log(`\n📊 Dashboard: ${this.dashboard.getUrl()}`);
        }
      }, 300000); // Every 5 minutes

    } catch (error) {
      console.error(`❌ Failed to start: ${error.message}`);
      await this.stop();
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    console.log('\n🛑 Stopping server live trader...');
    
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.tradingEngine) {
      this.tradingEngine.stop();
    }

    // Stop dashboard server
    await this.dashboard.stop();

    const status = this.tradingEngine.getStatus();
    console.log('\n📊 FINAL RESULTS:');
    console.log(`💰 Final Equity: $${status.portfolio.equity.toLocaleString()}`);
    console.log(`📈 Total Return: ${status.portfolio.totalReturn.toFixed(2)}%`);
    console.log(`🔄 Total Trades: ${status.metrics.totalTrades}`);
    if (status.metrics.totalTrades > 0) {
      console.log(`🎯 Win Rate: ${status.metrics.winRate.toFixed(1)}%`);
      console.log(`💵 Total PnL: $${status.metrics.totalPnL.toFixed(2)}`);
    }
    console.log('');
    console.log('✅ Session stopped');
  }

  getStatus() {
    const engineStatus = this.tradingEngine.getStatus();
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      startTime: this.startTime,
      candleCount: this.candleHistory.length,
      lastCandleTime: this.lastCandleTime ? new Date(this.lastCandleTime) : null,
      portfolio: engineStatus.portfolio,
      metrics: engineStatus.metrics,
      dashboardUrl: this.dashboard.getUrl()
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const symbol = args[0] || process.env.TRADING_SYMBOL || 'BTCUSD';
  const capital = parseFloat(args[1]) || parseFloat(process.env.INITIAL_CAPITAL) || 50000;
  const port = parseInt(args[2]) || parseInt(process.env.PORT) || 3000;

  const trader = new ServerLiveTrader(symbol, capital, port);

  try {
    await trader.start();

    // Keep process alive
    process.stdin.resume();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await trader.stop();
      process.exit(0);
    });

    // Handle unexpected exits
    process.on('SIGTERM', async () => {
      await trader.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught exception:', error);
      await trader.stop();
      process.exit(1);
    });

  } catch (error) {
    console.error(`❌ Trading failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ServerLiveTrader;