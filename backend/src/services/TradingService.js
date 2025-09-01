/**
 * Trading Service - Manages the trading strategy and data flow
 */

import RenkoEMAStrategy from '../strategies/RenkoEMAStrategy.js';
import DeltaAPIService from './DeltaAPIService.js';
import { EventEmitter } from 'events';
import deltaConfig from '../config/deltaConfig.js';

class TradingService extends EventEmitter {
  constructor() {
    super();
    this.deltaAPI = new DeltaAPIService();
    this.strategy = null;
    this.isRunning = false;
    this.dataInterval = null;
    this.currentSymbol = 'BTCUSD';
  }

  /**
   * Initialize trading service
   */
  async initialize(config = {}) {
    try {
      console.log('Initializing Trading Service...');
      
      // Create strategy instance with config from deltaConfig
      this.strategy = new RenkoEMAStrategy({
        symbol: config.symbol || deltaConfig.defaultSymbol,
        brickSize: config.brickSize || deltaConfig.strategy.brickSize,
        emaLength: config.emaLength || deltaConfig.strategy.emaLength,
        atrPeriod: config.atrPeriod || deltaConfig.strategy.atrPeriod,
        supertrendAtrPeriod: config.supertrendAtrPeriod || deltaConfig.strategy.supertrendAtrPeriod,
        supertrendMultipliers: config.supertrendMultipliers || deltaConfig.strategy.supertrendMultipliers,
        useDynamicBrickSize: config.useDynamicBrickSize !== false,
        defaultQuantity: config.defaultQuantity || deltaConfig.defaultQuantity
      });

      // Set up strategy event listeners
      this.setupStrategyListeners();

      // Get initial market data
      const marketData = await this.fetchInitialData();
      
      // Initialize strategy with historical data
      await this.strategy.initialize(marketData);
      
      console.log('Trading Service initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      console.error('Trading Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for strategy
   */
  setupStrategyListeners() {
    this.strategy.on('positionEntered', (data) => {
      console.log(`Position entered: ${data.side} at ${data.price}`);
      this.emit('positionEntered', data);
    });

    this.strategy.on('positionExited', (data) => {
      console.log(`Position exited: PnL ${data.pnl}`);
      this.emit('positionExited', data);
    });

    this.strategy.on('dataProcessed', (data) => {
      this.emit('dataProcessed', data);
    });

    this.strategy.on('pnlUpdated', (data) => {
      this.emit('pnlUpdated', data);
    });

    this.strategy.on('error', (error) => {
      console.error('Strategy error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Fetch initial historical data
   */
  async fetchInitialData() {
    try {
      console.log(`Fetching initial data for ${this.currentSymbol}...`);
      
      // Get historical candles (last 500 1-minute candles for better performance)
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (500 * 60); // 500 minutes ago (~8.3 hours)
      
      console.log(`📈 Fetching historical candles from ${new Date(startTime * 1000).toLocaleString()} to ${new Date(endTime * 1000).toLocaleString()}`);
      const response = await this.deltaAPI.getCandles(this.currentSymbol, '1m', startTime, endTime);
      
      if (response?.result && response.result.length > 0) {
        const marketData = response.result.map(candle => ({
          timestamp: new Date(candle.time * 1000),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume || 0)
        }));

        console.log(`Fetched ${marketData.length} historical candles`);
        return marketData;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching initial data:', error);
      return [];
    }
  }

  /**
   * Start the trading service
   */
  async start() {
    if (this.isRunning) {
      console.log('Trading service already running');
      return;
    }

    try {
      this.isRunning = true;
      this.strategy?.start();
      
      // WebSocket temporarily disabled for maximum reliability - using 1-second API polling
      // this.setupWebSocketConnection();
      
      // High-frequency API polling (every 1 second) + WebSocket for maximum real-time data
      console.log('🚀 Setting up high-frequency polling (1 second)...');
      this.dataInterval = setInterval(async () => {
        console.log('⏰ Real-time interval triggered - calling fetchLatestData');
        try {
          await this.fetchLatestData();
        } catch (error) {
          console.error('❌ Error in interval fetchLatestData:', error);
        }
      }, 1000);

      console.log('Trading Service started with 1-second real-time data');
      console.log(`📊 Data interval ID: ${this.dataInterval}`);
      
      // Fetch data immediately
      console.log('🔥 Fetching initial data immediately...');
      await this.fetchLatestData();
      this.emit('started');
      
    } catch (error) {
      console.error('Error starting trading service:', error);
      throw error;
    }
  }

  /**
   * Stop the trading service
   */
  stop() {
    this.isRunning = false;
    this.strategy?.stop();
    
    if (this.dataInterval) {
      clearInterval(this.dataInterval);
      this.dataInterval = null;
    }

    // Disconnect WebSocket
    if (this.deltaAPI) {
      this.deltaAPI.disconnectWebSocket();
    }

    console.log('Trading Service stopped');
    this.emit('stopped');
  }

  /**
   * Fetch latest market data
   */
  async fetchLatestData() {
    if (!this.isRunning) {
      console.log('⚠️ fetchLatestData called but service not running');
      return;
    }

    console.log(`🔍 Fetching latest candle data for symbol: ${this.currentSymbol}`);
    try {
      // Get latest candles (last 3 minutes) to ensure we get the most recent data
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (3 * 60); // Last 3 minutes
      
      const candleResponse = await this.deltaAPI.getCandles(this.currentSymbol, '1m', startTime, endTime);
      console.log(`📥 Candle API Response:`, candleResponse ? 'SUCCESS' : 'FAILED');
      
      if (candleResponse?.result && candleResponse.result.length > 0) {
        // Get the most recent candle
        const latestCandle = candleResponse.result[candleResponse.result.length - 1];
        
        // Check if this is a new candle to avoid processing duplicates
        const candleTimestamp = latestCandle.time;
        if (this.lastProcessedCandle && this.lastProcessedCandle === candleTimestamp) {
          console.log('⏭️ Same candle as last update, skipping duplicate processing');
          return;
        }
        
        this.lastProcessedCandle = candleTimestamp;
        console.log(`✅ Processing new candle data for: ${this.currentSymbol}`);
        
        // 📊 LOG RAW CANDLE DATA FROM DELTA EXCHANGE
        console.log('\n🔴 ===== LIVE CANDLE DATA FROM DELTA EXCHANGE =====');
        console.log(`📡 Symbol: ${this.currentSymbol}`);
        console.log(`💰 Close Price: $${latestCandle.close}`);
        console.log(`📈 High: $${latestCandle.high}`);
        console.log(`📉 Low: $${latestCandle.low}`);
        console.log(`🌅 Open: $${latestCandle.open}`);
        console.log(`📊 Volume: ${latestCandle.volume || 0}`);
        console.log(`📅 Timestamp: ${new Date(latestCandle.time * 1000).toLocaleString()}`);
        console.log('===============================================');
        
        const latestData = {
          timestamp: new Date(latestCandle.time * 1000),
          open: parseFloat(latestCandle.open),
          high: parseFloat(latestCandle.high),
          low: parseFloat(latestCandle.low),
          close: parseFloat(latestCandle.close),
          volume: parseFloat(latestCandle.volume || 0)
        };

        // 🎯 LOG PROCESSED CANDLE DATA
        console.log('🟢 ===== PROCESSED CANDLE DATA =====');
        console.log(`🕐 Time: ${latestData.timestamp.toLocaleTimeString()}`);
        console.log(`📊 OHLCV: O:$${latestData.open} H:$${latestData.high} L:$${latestData.low} C:$${latestData.close} V:${latestData.volume}`);
        console.log('==================================');

        // Process new data with strategy
        console.log('🎯 Processing through Renko + EMA + SuperTrend strategy...');
        await this.strategy.processNewData(latestData);
        
        // Log strategy state after processing
        if (this.strategy.getRenkoStats) {
          const renkoStats = this.strategy.getRenkoStats();
          console.log('🧱 RENKO STATUS:');
          console.log(`   Total Bricks: ${renkoStats.totalBricks}`);
          console.log(`   Direction: ${renkoStats.currentDirection === 1 ? '🟢 Bullish' : renkoStats.currentDirection === -1 ? '🔴 Bearish' : '⚪ Neutral'}`);
          console.log(`   Last Price: $${renkoStats.lastPrice}`);
          
          // Show current position status
          const position = this.strategy.position;
          if (position && position.isActive) {
            const currentPrice = renkoStats.lastPrice || 0;
            const pnl = (currentPrice - position.entryPrice) * position.quantity;
            const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
            
            console.log('💰 CURRENT TRADE STATUS:');
            console.log(`   Position: ${position.type.toUpperCase()}`);
            console.log(`   Entry Price: $${position.entryPrice.toFixed(2)}`);
            console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
            console.log(`   Quantity: ${position.quantity} BTC`);
            console.log(`   Unrealized PnL: $${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}`);
            console.log(`   Return: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`);
            console.log(`   Status: ${pnl > 0 ? '🟢 PROFIT' : pnl < 0 ? '🔴 LOSS' : '🟡 BREAKEVEN'}`);
          } else {
            console.log('💤 POSITION STATUS: Waiting for entry signal...');
          }
        }
        
        // Update counter
        this.marketDataPoints = (this.marketDataPoints || 0) + 1;
        console.log(`📈 Total Data Points Processed: ${this.marketDataPoints}`);
        console.log('─'.repeat(60) + '\n');
        
        // Emit latest data for real-time updates
        this.emit('latestData', {
          ...latestData,
          symbol: this.currentSymbol
        });
      } else {
        console.log('❌ No candle data received or empty result array');
        console.log('🔍 Debug candle response:', JSON.stringify(candleResponse, null, 2));
      }
      
      // OLD TICKER CODE REMOVED - All processing now done with candle data above
      if (false) { // Disabled old ticker processing
        console.log(`✅ Processing ticker data for: ${ticker.symbol}`);
        
        // 📊 LOG RAW DATA FROM DELTA EXCHANGE
        console.log('\n🔴 ===== LIVE DATA FROM DELTA EXCHANGE =====');
        console.log(`📡 Symbol: ${ticker.symbol}`);
        console.log(`💰 Current Price: $${ticker.close}`);
        console.log(`📈 24h High: $${ticker.high}`);
        console.log(`📉 24h Low: $${ticker.low}`);
        console.log(`🌅 24h Open: $${ticker.open || ticker.close}`);
        console.log(`📊 Volume: ${ticker.volume || 0}`);
        console.log(`⚡ Mark Price: $${ticker.mark_price}`);
        console.log(`🔄 Funding Rate: ${ticker.funding_rate}%`);
        console.log(`📅 Timestamp: ${ticker.time}`);
        console.log(`💹 Best Bid: $${ticker.quotes?.best_bid || 'N/A'}`);
        console.log(`💸 Best Ask: $${ticker.quotes?.best_ask || 'N/A'}`);
        console.log('===============================================');
        
        const latestData = {
          timestamp: new Date(),
          open: parseFloat(ticker.open || ticker.close),
          high: parseFloat(ticker.high || ticker.close),
          low: parseFloat(ticker.low || ticker.close),
          close: parseFloat(ticker.close),
          volume: parseFloat(ticker.volume || 0)
        };

        // 🎯 LOG PROCESSED CANDLE DATA
        console.log('🟢 ===== PROCESSED CANDLE DATA =====');
        console.log(`🕐 Time: ${latestData.timestamp.toLocaleTimeString()}`);
        console.log(`📊 OHLCV: O:$${latestData.open} H:$${latestData.high} L:$${latestData.low} C:$${latestData.close} V:${latestData.volume}`);
        console.log('==================================');

        // Process new data with strategy
        console.log('🎯 Processing through Renko + EMA + SuperTrend strategy...');
        await this.strategy.processNewData(latestData);
        
        // Log strategy state after processing
        if (this.strategy.getRenkoStats) {
          const renkoStats = this.strategy.getRenkoStats();
          console.log('🧱 RENKO STATUS:');
          console.log(`   Total Bricks: ${renkoStats.totalBricks}`);
          console.log(`   Direction: ${renkoStats.currentDirection === 1 ? '🟢 Bullish' : renkoStats.currentDirection === -1 ? '🔴 Bearish' : '⚪ Neutral'}`);
          console.log(`   Last Price: $${renkoStats.lastPrice}`);
          
          // Show current position status
          const position = this.strategy.position;
          if (position && position.isActive) {
            const currentPrice = renkoStats.lastPrice || 0;
            const pnl = (currentPrice - position.entryPrice) * position.quantity;
            const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
            
            console.log('💰 CURRENT TRADE STATUS:');
            console.log(`   Position: ${position.type.toUpperCase()}`);
            console.log(`   Entry Price: $${position.entryPrice.toFixed(2)}`);
            console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
            console.log(`   Quantity: ${position.quantity} BTC`);
            console.log(`   Unrealized PnL: $${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)}`);
            console.log(`   Return: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`);
            console.log(`   Status: ${pnl > 0 ? '🟢 PROFIT' : pnl < 0 ? '🔴 LOSS' : '🟡 BREAKEVEN'}`);
          } else {
            console.log('💤 POSITION STATUS: Waiting for entry signal...');
          }
        }
        
        // Update counter
        this.marketDataPoints = (this.marketDataPoints || 0) + 1;
        console.log(`📈 Total Data Points Processed: ${this.marketDataPoints}`);
        console.log('─'.repeat(60) + '\n');
        
        // Emit latest data for real-time updates
        this.emit('latestData', {
          ...latestData,
          symbol: this.currentSymbol
        });
      } else {
        console.log('❌ No candle data received, skipping this update');
      }
      
    } catch (error) {
      console.error('❌ Error fetching latest candle data:', error);
    }
  }

  /**
   * Process real-time price update
   */
  async processRealTimePrice(price, timestamp = new Date()) {
    if (!this.isRunning || !this.strategy) return;

    const priceData = {
      timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0
    };

    await this.strategy.processNewData(priceData);
  }

  /**
   * Get current strategy status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      symbol: this.currentSymbol,
      strategy: this.strategy ? this.strategy.getStatus() : null,
      service: 'TradingService'
    };
  }

  /**
   * Get strategy trades
   */
  getTrades() {
    return this.strategy ? this.strategy.getTrades() : [];
  }

  /**
   * Get strategy signals
   */
  getSignals() {
    return this.strategy ? this.strategy.getSignals() : [];
  }

  /**
   * Get current position
   */
  getCurrentPosition() {
    return this.strategy ? this.strategy.position : null;
  }

  /**
   * Change trading symbol
   */
  async changeSymbol(newSymbol) {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.currentSymbol = newSymbol;
    
    if (this.strategy) {
      this.strategy.config.symbol = newSymbol;
      // Reset strategy data for new symbol
      await this.strategy.initialize(await this.fetchInitialData());
    }

    if (wasRunning) {
      await this.start();
    }

    this.emit('symbolChanged', newSymbol);
  }
  /**
   * Setup WebSocket connection for real-time data
   */
  setupWebSocketConnection() {
    if (!this.deltaAPI) return;

    // Connect to WebSocket
    this.deltaAPI.connectWebSocket([this.currentSymbol]);

    // Listen for real-time price updates
    this.deltaAPI.on('priceUpdate', (data) => {
      this.processRealTimeData(data);
    });

    // Handle WebSocket events
    this.deltaAPI.on('wsConnected', () => {
      console.log('✅ Real-time data feed connected');
    });

    this.deltaAPI.on('wsDisconnected', () => {
      console.log('⚠️ Real-time data feed disconnected');
    });

    this.deltaAPI.on('wsError', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  }

  /**
   * Process real-time data from WebSocket
   */
  processRealTimeData(data) {
    if (!this.isRunning || !this.strategy) return;

    try {
      // Convert WebSocket data to candle format
      const candle = {
        timestamp: data.timestamp,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume
      };

      console.log(`📊 Real-time price: ${data.symbol} = $${data.close}`);

      // Process through strategy
      this.strategy.processNewData([candle]);

      // Emit latest data event
      this.emit('latestData', candle);

      // Update statistics
      if (this.strategy.dataPoints) {
        this.marketDataPoints = this.strategy.dataPoints.length;
      }

    } catch (error) {
      console.error('Error processing real-time data:', error);
    }
  }
}

export default TradingService;