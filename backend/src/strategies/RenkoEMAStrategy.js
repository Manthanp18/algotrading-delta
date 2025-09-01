/**
 * Renko EMA SuperTrend Trading Strategy
 * Implements the Python strategy logic in Node.js
 */

import RenkoCalculator from './RenkoCalculator.js';
import IndicatorCalculators from './IndicatorCalculators.js';
import { EventEmitter } from 'events';

class RenkoEMAStrategy extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Strategy configuration
    this.config = {
      symbol: config.symbol || 'BTCUSD',
      brickSize: config.brickSize || null,  // Will be calculated dynamically using ATR
      emaLength: config.emaLength || 21,
      atrPeriod: config.atrPeriod || 14,  // ATR period for Renko brick sizing
      supertrendAtrPeriod: config.supertrendAtrPeriod || 10,  // ATR period for SuperTrend (matches TradingView)
      supertrendMultipliers: config.supertrendMultipliers || [2.1, 3.1, 4.1],
      renkoAtrPeriod: config.renkoAtrPeriod || 14,  // Use same ATR for Renko as atrPeriod
      useDynamicBrickSize: config.useDynamicBrickSize || true,  // Enable ATR-based brick sizing
      ...config
    };

    // Initialize components
    this.renkoCalculator = new RenkoCalculator(this.config.brickSize);
    
    // Strategy state
    this.isRunning = false;
    this.position = {
      isActive: false,
      type: null, // 'long' or 'short'
      entryPrice: 0,
      quantity: 0,
      entryTime: null
    };
    
    // Data storage
    this.marketData = [];
    this.renkoBricks = [];
    this.indicators = {
      ema21: [],
      supertrends: {},
      marketSupertrends: {}  // SuperTrends calculated on actual market data
    };
    
    // Signal tracking
    this.lastSignal = null;
    this.signalHistory = [];
    this.trades = [];
  }

  /**
   * Initialize strategy with historical data
   */
  async initialize(historicalData = []) {
    try {
      console.log(`Initializing ${this.config.symbol} Renko EMA Strategy...`);
      
      if (historicalData && historicalData.length > 0) {
        this.marketData = historicalData;
        await this.calculateAllIndicators();
        console.log(`Strategy initialized with ${this.marketData.length} data points`);
        
        this.emit('initialized', {
          dataPoints: this.marketData.length,
          bricks: this.renkoBricks.length
        });
      } else {
        console.log('Strategy initialized with no historical data - waiting for live data');
      }
      
      this.isRunning = true;
      
    } catch (error) {
      console.error('Strategy initialization failed:', error);
      throw error;
    }
  }

  /**
   * Calculate all indicators for the current market data
   */
  async calculateAllIndicators() {
    if (this.marketData.length === 0) return;

    console.log(`\n🔧 calculateAllIndicators: Market data length: ${this.marketData.length}`);
    
    // Calculate dynamic brick size using ATR if enabled
    if (this.config.useDynamicBrickSize && this.marketData.length >= this.config.atrPeriod) {
      const atr = IndicatorCalculators.calculateATR(this.marketData, this.config.atrPeriod);
      const latestATR = atr[atr.length - 1];
      if (latestATR) {
        this.renkoCalculator.brickSize = latestATR;
        console.log(`🟢 Dynamic brick size updated to ATR(${this.config.atrPeriod}): ${latestATR.toFixed(2)}`);
      }
    }

    // Calculate Renko bricks
    this.renkoBricks = this.renkoCalculator.calculateRenko(this.marketData);
    console.log(`🧱 Renko calculation: ${this.renkoBricks.length} bricks created from ${this.marketData.length} data points`);
    
    if (this.renkoBricks.length === 0) {
      console.log('⚠️ No Renko bricks created - exiting calculateAllIndicators');
      return;
    }

    // Calculate EMA on Renko close prices
    const renkoPrices = this.renkoBricks.map(brick => brick.close);
    this.indicators.ema21 = IndicatorCalculators.calculateEMA(renkoPrices, this.config.emaLength);
    console.log(`📈 EMA21 calculation: ${this.indicators.ema21.filter(v => v !== null).length} valid values out of ${this.indicators.ema21.length} total`);

    // Check if we have enough market data for SuperTrend ATR calculation
    console.log(`🔧 SuperTrend check: Market data=${this.marketData.length}, SuperTrend ATR period needed=${this.config.supertrendAtrPeriod}, Renko ATR period=${this.config.atrPeriod}`);
    
    if (this.renkoBricks.length >= this.config.supertrendAtrPeriod) {
      console.log('✅ Enough Renko data for SuperTrend calculation, proceeding...');
      
      // Calculate multiple SuperTrends on RENKO BRICK data using ATR(10) to match TradingView Renko charts
      try {
        const marketSupertrends = IndicatorCalculators.calculateMultipleSuperTrend(
          this.renkoBricks,
          this.config.supertrendAtrPeriod,  // Use SuperTrend-specific ATR period (10)
          this.config.supertrendMultipliers
        );
        
        this.indicators.marketSupertrends = marketSupertrends;
        
        // Get latest ATR value for display
        const latestATR = marketSupertrends.supertrend_2_1?.atr?.slice(-1)[0];
        console.log('✅ Market SuperTrends calculated successfully!');
        console.log(`   📊 Current ATR: ${latestATR ? latestATR.toFixed(2) : 'N/A'}`);
        console.log(`   🟢 Brick size: ${this.renkoCalculator.brickSize.toFixed(2)}`);
        console.log(`   🧱 Total Renko bricks: ${this.renkoBricks.length}`);
        console.log(`   📈 EMA21 values: ${this.indicators.ema21.filter(v => v !== null).length} calculated\n`);
        
        // Debug SuperTrend result structure
        console.log('🔍 SuperTrend result keys:', Object.keys(marketSupertrends));
        if (marketSupertrends.supertrend_2_1) {
          console.log('🔍 ST 2.1 data length:', {
            supertrend: marketSupertrends.supertrend_2_1.supertrend?.length || 0,
            direction: marketSupertrends.supertrend_2_1.direction?.length || 0,
            atr: marketSupertrends.supertrend_2_1.atr?.length || 0
          });
        }
      } catch (error) {
        console.error('❌ SuperTrend calculation failed:', error.message);
        this.indicators.marketSupertrends = null;
      }
    } else {
      console.log(`⚠️ Not enough Renko data for SuperTrend. Need: ${this.config.supertrendAtrPeriod}, Have: ${this.renkoBricks.length}`);
    }

    // Optional: Keep Renko-based SuperTrends for comparison
    if (this.renkoBricks.length >= this.config.renkoAtrPeriod) {
      const renkoSupertrends = IndicatorCalculators.calculateMultipleSuperTrend(
        this.renkoBricks,
        this.config.renkoAtrPeriod,
        this.config.supertrendMultipliers
      );
      
      this.indicators.supertrends = renkoSupertrends;
    }
  }

  /**
   * Update Renko-based SuperTrend indicators (for Renko charts, SuperTrend uses Renko data)
   */
  async updateMarketIndicators() {
    if (this.renkoBricks.length < this.config.supertrendAtrPeriod) {
      console.log(`⚠️ Not enough Renko data for SuperTrend. Need: ${this.config.supertrendAtrPeriod}, Have: ${this.renkoBricks.length}`);
      return;
    }

    try {
      console.log('🔄 Updating Renko-based SuperTrends with new data...');
      
      // Calculate SuperTrends on RENKO BRICK data using ATR(10) to match TradingView Renko charts
      const renkoSupertrends = IndicatorCalculators.calculateMultipleSuperTrend(
        this.renkoBricks,
        this.config.supertrendAtrPeriod,
        this.config.supertrendMultipliers
      );
      
      this.indicators.marketSupertrends = renkoSupertrends;
      
      // Get latest ATR value
      const latestATR = renkoSupertrends.supertrend_2_1?.atr?.slice(-1)[0];
      console.log(`✅ Renko SuperTrends updated! ATR: ${latestATR ? latestATR.toFixed(2) : 'N/A'}`);
      
    } catch (error) {
      console.error('❌ Renko SuperTrend update failed:', error.message);
      this.indicators.marketSupertrends = null;
    }
  }

  /**
   * Process new market data point
   */
  async processNewData(newData) {
    if (!this.isRunning) return;

    try {
      // Add new data point
      this.marketData.push(newData);
      
      // Keep only recent data (performance optimization)
      if (this.marketData.length > 5000) {
        this.marketData = this.marketData.slice(-5000);
      }

      // Add price to Renko calculator
      const newBricks = this.renkoCalculator.addPrice(newData.close, newData.timestamp);
      
      if (newBricks.length > 0) {
        // New Renko bricks created, recalculate all indicators
        console.log(`🟢 New ${newBricks.length} Renko brick(s) created! Recalculating indicators...`);
        this.renkoBricks.push(...newBricks);
        await this.calculateAllIndicators();
        
        // Generate signals based on latest data
        await this.generateSignals();
      } else {
        // No new Renko bricks, but still update market-based SuperTrends
        await this.updateMarketIndicators();
        
        // Update current position PnL if active
        if (this.position.isActive) {
          this.updatePositionPnL(newData.close);
        }
      }
      
      // Show current indicator values on EVERY ticker update
      await this.showCurrentIndicatorValues(newData.close, newBricks.length);

      // Process trade signals after showing indicators
      console.log('🎯 Calling generateSignals() to process trade signals...');
      await this.generateSignals();

      this.emit('dataProcessed', {
        newBricks: newBricks.length,
        totalBricks: this.renkoBricks.length,
        latestPrice: newData.close
      });

    } catch (error) {
      console.error('Error processing new data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Generate trading signals based on current conditions
   */
  async generateSignals() {
    if (this.renkoBricks.length < 2 || this.indicators.ema21.length === 0) {
      console.log('Not enough data for signals - Renko bricks:', this.renkoBricks.length, 'EMA:', this.indicators.ema21.length);
      return;
    }

    const latestIndex = this.renkoBricks.length - 1;
    const latestBrick = this.renkoBricks[latestIndex];
    const ema21 = this.indicators.ema21[latestIndex];
    
    if (!ema21) {
      console.log('No EMA value available');
      return;
    }

    // Get Renko-based SuperTrend directions (matches TradingView Renko charts)
    const renkoIndex = this.renkoBricks.length - 1;
    
    // Check if Renko SuperTrends exists
    if (!this.indicators.marketSupertrends || !this.indicators.marketSupertrends.supertrend_2_1) {
      console.log('Renko SuperTrends not calculated yet');
      return;
    }
    
    const st21Direction = this.indicators.marketSupertrends.supertrend_2_1?.direction[renkoIndex];
    const st31Direction = this.indicators.marketSupertrends.supertrend_3_1?.direction[renkoIndex];
    const st41Direction = this.indicators.marketSupertrends.supertrend_4_1?.direction[renkoIndex];

    if (st21Direction === null || st31Direction === null || st41Direction === null || 
        st21Direction === undefined || st31Direction === undefined || st41Direction === undefined) {
      console.log('SuperTrend directions not available:', { st21Direction, st31Direction, st41Direction });
      return;
    }

    // Check entry conditions
    const bullishEMA = latestBrick.close > ema21;
    const bearishEMA = latestBrick.close < ema21;
    
    // SuperTrend alignment - ALL 3 must agree (original strategy)
    const bullishSuperTrend = st21Direction === 1 && st31Direction === 1 && st41Direction === 1;
    const bearishSuperTrend = st21Direction === -1 && st31Direction === -1 && st41Direction === -1;
    
    const bullishRenko = latestBrick.direction === 1;
    const bearishRenko = latestBrick.direction === -1;

    // Entry signals - original conservative approach
    const longEntry = bullishEMA && bullishSuperTrend && bullishRenko;
    const shortEntry = bearishEMA && bearishSuperTrend && bearishRenko;

    // Reset lastSignal if conditions change (allow new signals when market conditions align again)
    if (!longEntry && !shortEntry && this.lastSignal) {
      console.log(`🔄 Resetting lastSignal (was: ${this.lastSignal}) - no current signals`);
      this.lastSignal = null;
    }

    // Exit signals - original approach
    const longExit = bearishEMA || !bullishSuperTrend || bearishRenko;
    const shortExit = bullishEMA || !bearishSuperTrend || bullishRenko;

    // Get current indicator values for comparison with TradingView
    const currentATR = this.indicators.marketSupertrends?.supertrend_2_1?.atr[renkoIndex];
    const st21Value = this.indicators.marketSupertrends?.supertrend_2_1?.supertrend[renkoIndex];
    const st31Value = this.indicators.marketSupertrends?.supertrend_3_1?.supertrend[renkoIndex];
    const st41Value = this.indicators.marketSupertrends?.supertrend_4_1?.supertrend[renkoIndex];

    // Log all indicator values for TradingView comparison
    console.log('\n=== INDICATOR VALUES FOR TRADINGVIEW COMPARISON ===');
    console.log(`📊 Current Market Price: ${latestBrick.close.toFixed(2)}`);
    console.log(`📈 EMA 21 (Renko): ${ema21.toFixed(2)} ${bullishEMA ? '(ABOVE)' : '(BELOW)'}`);
    console.log(`📊 SuperTrend ATR(${this.config.supertrendAtrPeriod}): ${currentATR ? currentATR.toFixed(2) : 'N/A'}`);
    console.log(`🟢 Renko Brick Size: ${this.renkoCalculator.brickSize.toFixed(2)}`);
    console.log('\n📈 SUPERTREND VALUES:');
    console.log(`   ST 2.1: ${st21Value ? st21Value.toFixed(2) : 'N/A'} ${st21Direction === 1 ? '🟢 BULLISH' : '🔴 BEARISH'}`);
    console.log(`   ST 3.1: ${st31Value ? st31Value.toFixed(2) : 'N/A'} ${st31Direction === 1 ? '🟢 BULLISH' : '🔴 BEARISH'}`);
    console.log(`   ST 4.1: ${st41Value ? st41Value.toFixed(2) : 'N/A'} ${st41Direction === 1 ? '🟢 BULLISH' : '🔴 BEARISH'}`);
    console.log(`\n🎯 ALIGNMENT: ${bullishSuperTrend ? 'ALL BULLISH ✅' : bearishSuperTrend ? 'ALL BEARISH ✅' : 'NOT ALIGNED ❌'}`);
    console.log(`🟦 RENKO: ${bullishRenko ? 'UP BRICK ⬆️' : 'DOWN BRICK ⬇️'}`);
    console.log(`\n🚀 SIGNALS: Long=${longEntry ? '✅' : '❌'} | Short=${shortEntry ? '✅' : '❌'}`);
    console.log('================================================\n');

    // Debug signal processing
    console.log(`🔍 SIGNAL DEBUG: longEntry=${longEntry}, shortEntry=${shortEntry}, lastSignal=${this.lastSignal}, positionActive=${this.position.isActive}`);
    
    // Process signals
    await this.processSignals({
      longEntry,
      shortEntry,
      longExit,
      shortExit,
      price: latestBrick.close,
      timestamp: latestBrick.timestamp,
      indicators: {
        ema21,
        st21: this.indicators.marketSupertrends?.supertrend_2_1?.supertrend[renkoIndex] || 0,
        st31: this.indicators.marketSupertrends?.supertrend_3_1?.supertrend[renkoIndex] || 0,
        st41: this.indicators.marketSupertrends?.supertrend_4_1?.supertrend[renkoIndex] || 0,
        atr: this.indicators.marketSupertrends?.supertrend_2_1?.atr[renkoIndex] || 0
      }
    });
  }

  /**
   * Process trading signals and execute simulated trades
   */
  async processSignals(signals) {
    const { longEntry, shortEntry, longExit, shortExit, price, timestamp, indicators } = signals;

    try {
      // Exit conditions (process first)
      if (this.position.isActive) {
        let shouldExit = false;
        let exitType = '';

        if (this.position.type === 'long' && longExit) {
          shouldExit = true;
          exitType = 'long_exit';
        } else if (this.position.type === 'short' && shortExit) {
          shouldExit = true;
          exitType = 'short_exit';
        }

        if (shouldExit) {
          await this.exitPosition(price, timestamp, exitType, indicators);
        }
      }

      // Entry conditions (only if not in position)
      if (!this.position.isActive) {
        console.log(`🎯 ENTRY CHECK: longEntry=${longEntry}, this.lastSignal=${this.lastSignal}, condition=${longEntry && this.lastSignal !== 'long_entry'}`);
        if (longEntry && this.lastSignal !== 'long_entry') {
          console.log('🚀 EXECUTING LONG ENTRY!');
          await this.enterPosition('long', price, timestamp, indicators);
          this.lastSignal = 'long_entry';
        } else if (shortEntry && this.lastSignal !== 'short_entry') {
          console.log('🚀 EXECUTING SHORT ENTRY!');
          await this.enterPosition('short', price, timestamp, indicators);
          this.lastSignal = 'short_entry';
        } else {
          console.log('❌ Entry condition not met - either no signal or duplicate signal');
        }
      } else {
        console.log('💼 Position already active, skipping entry');
      }

    } catch (error) {
      console.error('Error processing signals:', error);
    }
  }

  /**
   * Enter a new simulated position
   */
  async enterPosition(side, price, timestamp, indicators) {
    try {
      const quantity = this.calculatePositionSize(price);
      
      // Create position
      this.position = {
        isActive: true,
        type: side,
        entryPrice: price,
        quantity,
        entryTime: timestamp
      };

      // Create trade record
      const trade = {
        id: `trade_${Date.now()}`,
        symbol: this.config.symbol,
        side: side === 'long' ? 'buy' : 'sell',
        type: 'entry',
        price,
        quantity,
        timestamp,
        pnl: 0,
        signalData: {
          ema21: indicators.ema21,
          supertrend_2_1: indicators.st21,
          supertrend_3_1: indicators.st31,
          supertrend_4_1: indicators.st41,
          atr: indicators.atr,
          renkoBrick: this.renkoBricks[this.renkoBricks.length - 1]
        },
        strategy: 'RenkoEMA',
        isSimulated: true
      };

      this.trades.push(trade);

      // Create signal record
      this.signalHistory.push({
        signalType: side === 'long' ? 'buy_entry' : 'sell_entry',
        price,
        timestamp,
        indicators
      });

      console.log(`Entered ${side} position at ${price} with quantity ${quantity}`);
      
      this.emit('positionEntered', {
        side,
        price,
        quantity,
        timestamp,
        trade
      });

    } catch (error) {
      console.error('Error entering position:', error);
    }
  }

  /**
   * Exit current simulated position
   */
  async exitPosition(price, timestamp, exitType, indicators) {
    try {
      if (!this.position.isActive) return;

      const pnl = this.calculatePnL(this.position, price);
      const side = this.position.type === 'long' ? 'sell' : 'buy';

      // Create trade record
      const trade = {
        id: `trade_${Date.now()}`,
        symbol: this.config.symbol,
        side,
        type: 'exit',
        price,
        quantity: this.position.quantity,
        timestamp,
        pnl,
        signalData: {
          ema21: indicators.ema21,
          supertrend_2_1: indicators.st21,
          supertrend_3_1: indicators.st31,
          supertrend_4_1: indicators.st41,
          atr: indicators.atr,
          renkoBrick: this.renkoBricks[this.renkoBricks.length - 1]
        },
        strategy: 'RenkoEMA',
        isSimulated: true
      };

      this.trades.push(trade);

      // Create signal record
      this.signalHistory.push({
        signalType: exitType,
        price,
        timestamp,
        indicators
      });

      console.log(`Exited ${this.position.type} position at ${price}, PnL: ${pnl}`);
      
      this.emit('positionExited', {
        side: this.position.type,
        entryPrice: this.position.entryPrice,
        exitPrice: price,
        pnl,
        timestamp,
        trade
      });

      // Reset position
      this.position = {
        isActive: false,
        type: null,
        entryPrice: 0,
        quantity: 0,
        entryTime: null
      };

    } catch (error) {
      console.error('Error exiting position:', error);
    }
  }

  /**
   * Calculate position size based on risk management
   */
  calculatePositionSize(price) {
    // Simple fixed quantity for simulation
    return this.config.defaultQuantity || 0.001;
  }

  /**
   * Calculate PnL for a position
   */
  calculatePnL(position, currentPrice) {
    if (!position.isActive) return 0;

    if (position.type === 'long') {
      return (currentPrice - position.entryPrice) * position.quantity;
    } else if (position.type === 'short') {
      return (position.entryPrice - currentPrice) * position.quantity;
    }
    
    return 0;
  }

  /**
   * Show current indicator values for TradingView comparison on every ticker
   */
  async showCurrentIndicatorValues(currentPrice, newBricksCount = 0) {
    console.log(`🔍 DEBUG: Renko bricks: ${this.renkoBricks.length}, EMA21 length: ${this.indicators.ema21.length}, Market data: ${this.marketData.length}`);
    
    if (this.renkoBricks.length < 2) {
      console.log('⚠️ Not enough Renko bricks for display (need at least 2)');
      return;
    }
    
    if (this.indicators.ema21.length === 0) {
      console.log('⚠️ EMA21 not calculated yet');
      return;
    }

    const latestIndex = this.renkoBricks.length - 1;
    const latestBrick = this.renkoBricks[latestIndex];
    const ema21 = this.indicators.ema21[latestIndex];
    const renkoIndex = this.renkoBricks.length - 1;
    
    if (!this.indicators.marketSupertrends) {
      console.log('⚠️ Renko SuperTrends not calculated yet');
      return;
    }

    // Get current indicator values (now using Renko-based SuperTrends)
    const currentATR = this.indicators.marketSupertrends?.supertrend_2_1?.atr[renkoIndex];
    const st21Value = this.indicators.marketSupertrends?.supertrend_2_1?.supertrend[renkoIndex];
    const st31Value = this.indicators.marketSupertrends?.supertrend_3_1?.supertrend[renkoIndex];
    const st41Value = this.indicators.marketSupertrends?.supertrend_4_1?.supertrend[renkoIndex];
    const st21Direction = this.indicators.marketSupertrends?.supertrend_2_1?.direction[renkoIndex];
    const st31Direction = this.indicators.marketSupertrends?.supertrend_3_1?.direction[renkoIndex];
    const st41Direction = this.indicators.marketSupertrends?.supertrend_4_1?.direction[renkoIndex];

    // Check conditions
    const bullishEMA = latestBrick.close > ema21;
    const bearishEMA = latestBrick.close < ema21;
    const bullishSuperTrend = st21Direction === 1 && st31Direction === 1 && st41Direction === 1;
    const bearishSuperTrend = st21Direction === -1 && st31Direction === -1 && st41Direction === -1;
    const bullishRenko = latestBrick.direction === 1;
    const bearishRenko = latestBrick.direction === -1;
    
    // Entry signals
    const longEntry = bullishEMA && bullishSuperTrend && bullishRenko;
    const shortEntry = bearishEMA && bearishSuperTrend && bearishRenko;

    // Display values on EVERY ticker update
    console.log('\n=== 🗺️ TRADINGVIEW INDICATOR COMPARISON (EVERY TICKER) ===');
    console.log(`🔄 Live Price: $${currentPrice.toFixed(2)} | Renko Price: $${latestBrick.close.toFixed(2)}`);
    console.log(`🧱 New Bricks: ${newBricksCount} | Total Bricks: ${this.renkoBricks.length}`);
    console.log(`📈 EMA 21 (Renko): $${ema21.toFixed(2)} ${bullishEMA ? '🟢 ABOVE' : '🔴 BELOW'}`);
    console.log(`📊 SuperTrend ATR(${this.config.supertrendAtrPeriod}): ${currentATR ? currentATR.toFixed(2) : 'N/A'} | Renko Brick Size: ${this.renkoCalculator.brickSize.toFixed(2)}`);
    
    // Check if SuperTrends are properly calculated
    if (!this.indicators.marketSupertrends) {
      console.log('\n⚠️ SUPERTREND VALUES: NOT CALCULATED - Market data insufficient');
    } else {
      console.log('\n🐈 SUPERTREND VALUES:');
      console.log(`   ST 2.1: $${st21Value ? st21Value.toFixed(2) : 'N/A'} ${st21Direction === 1 ? '🟢 BULLISH' : st21Direction === -1 ? '🔴 BEARISH' : '⚫ UNKNOWN'}`);
      console.log(`   ST 3.1: $${st31Value ? st31Value.toFixed(2) : 'N/A'} ${st31Direction === 1 ? '🟢 BULLISH' : st31Direction === -1 ? '🔴 BEARISH' : '⚫ UNKNOWN'}`);
      console.log(`   ST 4.1: $${st41Value ? st41Value.toFixed(2) : 'N/A'} ${st41Direction === 1 ? '🟢 BULLISH' : st41Direction === -1 ? '🔴 BEARISH' : '⚫ UNKNOWN'}`);
    }
    
    console.log(`\n🎯 ALIGNMENT: ${bullishSuperTrend ? 'ALL BULLISH ✅' : bearishSuperTrend ? 'ALL BEARISH ✅' : 'NOT ALIGNED ❌'}`);
    console.log(`🟦 RENKO DIRECTION: ${bullishRenko ? 'UP BRICK ⬆️' : 'DOWN BRICK ⬇️'}`);
    console.log(`\n🚀 TRADE SIGNALS:`);
    console.log(`   LONG: ${longEntry ? '✅ TRIGGERED' : '❌ NO'} | SHORT: ${shortEntry ? '✅ TRIGGERED' : '❌ NO'}`);
    
    // Show live P&L if position is active
    if (this.position.isActive) {
      const unrealizedPnL = this.calculatePnL(this.position, currentPrice);
      const pnlPercentage = ((currentPrice - this.position.entryPrice) / this.position.entryPrice) * 100;
      const duration = Date.now() - new Date(this.position.entryTime).getTime();
      const durationMinutes = Math.floor(duration / 60000);
      
      console.log(`\n💰 LIVE P&L:`);
      console.log(`   Position: ${this.position.type.toUpperCase()}`);
      console.log(`   Entry Price: $${this.position.entryPrice.toFixed(2)}`);
      console.log(`   Current Price: $${currentPrice.toFixed(2)}`);
      console.log(`   Quantity: ${this.position.quantity} ${this.config.symbol.replace('USD', '')}`);
      console.log(`   Unrealized P&L: ${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(4)}`);
      console.log(`   Return: ${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%`);
      console.log(`   Duration: ${durationMinutes} minutes`);
      console.log(`   Status: ${unrealizedPnL > 0 ? '🟢 PROFIT' : unrealizedPnL < 0 ? '🔴 LOSS' : '🟡 BREAKEVEN'}`);
    } else {
      console.log(`\n💤 POSITION STATUS: No active position`);
    }
    console.log('================================================================\n');
  }

  /**
   * Update position PnL in real-time
   */
  updatePositionPnL(currentPrice) {
    if (!this.position.isActive) return;

    const unrealizedPnL = this.calculatePnL(this.position, currentPrice);
    const pnlPercentage = ((currentPrice - this.position.entryPrice) / this.position.entryPrice) * 100;
    const duration = Date.now() - new Date(this.position.entryTime).getTime();
    const durationMinutes = Math.floor(duration / 60000);
    
    // Update position with current P&L data
    this.position.currentPrice = currentPrice;
    this.position.unrealizedPnL = unrealizedPnL;
    this.position.pnlPercentage = pnlPercentage;
    this.position.durationMinutes = durationMinutes;
    
    this.emit('pnlUpdated', {
      position: { ...this.position },
      currentPrice,
      unrealizedPnL,
      pnlPercentage,
      durationMinutes
    });
  }

  /**
   * Get current strategy status
   */
  getStatus() {
    const stats = this.getTradeStatistics();
    
    return {
      isRunning: this.isRunning,
      symbol: this.config.symbol,
      position: this.position,
      marketDataPoints: this.marketData.length,
      renkoBricks: this.renkoBricks.length,
      lastSignal: this.lastSignal,
      config: this.config,
      renkoStats: this.renkoCalculator.getStatistics(),
      tradeStats: stats,
      totalTrades: this.trades.length,
      signals: this.signalHistory.length
    };
  }

  /**
   * Get trade statistics
   */
  getTradeStatistics() {
    if (this.trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0
      };
    }

    const completedTrades = this.trades.filter(trade => trade.pnl !== 0);
    const winningTrades = completedTrades.filter(trade => trade.pnl > 0);
    const losingTrades = completedTrades.filter(trade => trade.pnl < 0);
    
    const totalPnL = completedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalWins = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
    
    const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;

    return {
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: Math.round(winRate * 100) / 100,
      totalPnL: Math.round(totalPnL * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100
    };
  }

  /**
   * Get all trades
   */
  getTrades() {
    return this.trades;
  }

  /**
   * Get all signals
   */
  getSignals() {
    return this.signalHistory;
  }

  /**
   * Stop the strategy
   */
  stop() {
    this.isRunning = false;
    this.emit('stopped');
    console.log(`Strategy stopped for ${this.config.symbol}`);
  }

  /**
   * Start the strategy
   */
  start() {
    this.isRunning = true;
    this.emit('started');
    console.log(`Strategy started for ${this.config.symbol}`);
  }
}

export default RenkoEMAStrategy;