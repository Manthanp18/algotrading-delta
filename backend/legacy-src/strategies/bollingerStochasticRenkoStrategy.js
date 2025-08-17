const BaseStrategy = require('./baseStrategy');
const RenkoEngine = require('../engines/RenkoEngine');

/**
 * Bollinger Stochastic Renko Strategy
 * 
 * SECONDARY SYSTEM FOR RANGING MARKETS
 * 
 * Components:
 * - Renko bricks (ATR-based sizing)
 * - Bollinger Bands (20, 2.0)
 * - Stochastic Oscillator (14, 3, 3)
 * - 21-period EMA for trend filter
 * 
 * Entry Rules:
 * BUY SIGNAL:
 * - Price creates GREEN brick after touching lower Bollinger Band
 * - Stochastic crosses ABOVE 20 (oversold exit)
 * - Price above 21 EMA
 * - Brick change confirms reversal
 * 
 * SELL SIGNAL:
 * - Price creates RED brick after touching upper Bollinger Band
 * - Stochastic crosses BELOW 80 (overbought exit)
 * - Price below 21 EMA
 * - Brick change confirms reversal
 * 
 * Risk Management:
 * - 1.5% risk per trade (more conservative for ranging markets)
 * - 2:1 risk/reward ratio
 * - Stop loss: Beyond opposite Bollinger Band
 * - Take profit: Middle Bollinger Band or opposite extreme
 */
class BollingerStochasticRenkoStrategy extends BaseStrategy {
  constructor(options = {}) {
    super('Bollinger Stochastic Renko Strategy');
    
    // Strategy configuration
    this.config = {
      renko: {
        atrPeriod: options.atrPeriod || 14,
        atrMultiplier: options.atrMultiplier || 0.4, // Smaller bricks for ranging markets
        source: options.priceSource || 'close'
      },
      bollinger: {
        period: options.bollingerPeriod || 20,
        stdDev: options.bollingerStdDev || 2.0
      },
      stochastic: {
        kPeriod: options.stochasticK || 14,
        dPeriod: options.stochasticD || 3,
        smooth: options.stochasticSmooth || 3
      },
      ema: {
        period: options.emaPeriod || 21
      },
      risk: {
        maxRiskPerTrade: options.maxRiskPerTrade || 0.015, // 1.5% for ranging markets
        riskRewardRatio: options.riskRewardRatio || 2.0,
        maxPositions: options.maxPositions || 2,
        cooldownSeconds: options.cooldownSeconds || 45
      },
      signals: {
        oversoldLevel: options.oversoldLevel || 20,
        overboughtLevel: options.overboughtLevel || 80,
        confirmationBricks: options.confirmationBricks || 2
      }
    };
    
    // Initialize Renko engine
    this.renkoEngine = new RenkoEngine({
      priceSource: this.config.renko.source,
      atrPeriod: this.config.renko.atrPeriod,
      atrMultiplier: this.config.renko.atrMultiplier,
      autoCalculateBrickSize: true
    });
    
    // Strategy state
    this.lastTradeTime = null;
    this.currentPositions = [];
    this.bandTouches = [];
    
    // Performance tracking
    this.totalSignals = 0;
    this.entrySignals = 0;
    this.exitSignals = 0;
    this.bollingerBounces = 0;
    this.stochasticCrossovers = 0;
    this.emaTrendFilters = 0;
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup Renko engine event listeners
   */
  setupEventListeners() {
    this.renkoEngine.on('newBrick', (brick) => {
      this.onNewBrick(brick);
    });

    this.renkoEngine.on('trendChange', (data) => {
      console.log(`🔄 Bollinger Renko: Trend Change ${data.oldDirection} -> ${data.newDirection}`);
    });

    this.renkoEngine.on('error', (error) => {
      console.error('Bollinger RenkoEngine Error:', error);
    });
  }

  /**
   * Handle new brick formation
   * @param {Object} brick - New brick data
   */
  onNewBrick(brick) {
    // Track band touches for reversal signals
    this.trackBollingerTouches(brick);
  }

  /**
   * Track Bollinger Band touches
   * @param {Object} brick - Brick data
   */
  trackBollingerTouches(brick) {
    const bollingerData = this.calculateBollingerBands();
    if (!bollingerData) return;

    const { upperBand, lowerBand } = bollingerData;
    const brickHigh = Math.max(brick.open, brick.close);
    const brickLow = Math.min(brick.open, brick.close);

    // Track touches
    const touch = {
      timestamp: brick.timestamp,
      price: brick.close,
      touchedUpper: brickHigh >= upperBand,
      touchedLower: brickLow <= lowerBand,
      brickDirection: brick.direction
    };

    this.bandTouches.push(touch);
    
    // Keep only recent touches
    if (this.bandTouches.length > 50) {
      this.bandTouches = this.bandTouches.slice(-25);
    }
  }

  /**
   * Main signal generation method
   * @param {Object} currentCandle - Current price candle
   * @param {Array} historicalData - Historical candle data
   * @param {Object} portfolio - Portfolio instance
   * @returns {Object|null} Trading signal or null
   */
  generateSignal(currentCandle, historicalData, portfolio) {
    try {
      // Update Renko engine with new price data
      const newBrickFormed = this.renkoEngine.updatePrice(currentCandle);
      
      if (!newBrickFormed) {
        return null; // No new brick, no signal
      }

      // Check cooldown
      if (this.lastTradeTime && 
          (Date.now() - this.lastTradeTime) < (this.config.risk.cooldownSeconds * 1000)) {
        return null;
      }

      // Check maximum positions
      if (this.currentPositions.length >= this.config.risk.maxPositions) {
        return null;
      }

      const allBricks = this.renkoEngine.getAllBricks();
      const minDataPoints = Math.max(
        this.config.bollinger.period,
        this.config.stochastic.kPeriod,
        this.config.ema.period
      ) + 10;

      if (allBricks.length < minDataPoints) {
        return null; // Not enough data
      }

      // Get current position from portfolio
      const currentPosition = portfolio.getPosition ? 
        portfolio.getPosition('BTCUSD') : 
        portfolio.positions?.get('BTCUSD') || { quantity: 0 };

      // Analyze for signals
      const signal = this.analyzeBollingerStochasticSignal(allBricks, currentCandle, currentPosition);
      
      if (signal) {
        this.totalSignals++;
        this.lastTradeTime = Date.now();
        
        // Add strategy-specific information
        signal.strategy = this.name;
        signal.brickSize = this.renkoEngine.getCurrentBrickSize();
        signal.timestamp = new Date().toISOString();
        
        if (signal.action === 'BUY' || signal.action === 'SELL') {
          this.entrySignals++;
        } else {
          this.exitSignals++;
        }
      }

      return signal;

    } catch (error) {
      console.error('BollingerStochasticRenkoStrategy.generateSignal Error:', error);
      return null;
    }
  }

  /**
   * Analyze Bollinger-Stochastic signals
   * @param {Array} bricks - All bricks
   * @param {Object} currentCandle - Current candle
   * @param {Object} currentPosition - Current position
   * @returns {Object|null} Signal or null
   */
  analyzeBollingerStochasticSignal(bricks, currentCandle, currentPosition) {
    // Check exit signals first (if in position)
    if (currentPosition && Math.abs(currentPosition.quantity) > 0) {
      const exitSignal = this.checkBollingerExitSignal(bricks, currentPosition);
      if (exitSignal) {
        return exitSignal;
      }
    }

    // Check entry signals (if not in position)
    if (!currentPosition || currentPosition.quantity === 0) {
      const entrySignal = this.checkBollingerEntrySignal(bricks, currentCandle);
      if (entrySignal) {
        return entrySignal;
      }
    }

    return null;
  }

  /**
   * Check for Bollinger-Stochastic entry signals
   * @param {Array} bricks - All bricks
   * @param {Object} currentCandle - Current candle
   * @returns {Object|null} Entry signal or null
   */
  checkBollingerEntrySignal(bricks, currentCandle) {
    const latestBrick = bricks[bricks.length - 1];
    const currentPrice = latestBrick.close;

    // Calculate technical indicators
    const bollingerData = this.calculateBollingerBands();
    const stochasticData = this.calculateStochastic(bricks);
    const emaData = this.calculate21EMA(bricks);

    if (!bollingerData || !stochasticData || !emaData) {
      return null;
    }

    // Check for recent band touch
    const recentTouch = this.getRecentBandTouch();
    if (!recentTouch) {
      return null;
    }

    let action = null;
    let direction = null;
    let confidence = 0;
    const reasons = [];

    // BUY Signal Logic
    if (recentTouch.touchedLower && 
        latestBrick.direction === 'UP' &&
        stochasticData.k > this.config.signals.oversoldLevel &&
        currentPrice > emaData.value) {
      
      action = 'BUY';
      direction = 'LONG';
      confidence += 0.3; // Base confidence
      reasons.push('Lower BB bounce');
      
      // Additional confirmations
      if (stochasticData.k > stochasticData.d) {
        confidence += 0.2;
        reasons.push('Stoch K>D');
      }
      
      if (this.hasConfirmationBricks(bricks, 'UP')) {
        confidence += 0.2;
        reasons.push('Brick confirmation');
      }
      
      this.bollingerBounces++;
      if (stochasticData.crossover === 'BULLISH') {
        this.stochasticCrossovers++;
      }
      this.emaTrendFilters++;
    }
    // SELL Signal Logic
    else if (recentTouch.touchedUpper && 
             latestBrick.direction === 'DOWN' &&
             stochasticData.k < this.config.signals.overboughtLevel &&
             currentPrice < emaData.value) {
      
      action = 'SELL';
      direction = 'SHORT';
      confidence += 0.3; // Base confidence
      reasons.push('Upper BB bounce');
      
      // Additional confirmations
      if (stochasticData.k < stochasticData.d) {
        confidence += 0.2;
        reasons.push('Stoch K<D');
      }
      
      if (this.hasConfirmationBricks(bricks, 'DOWN')) {
        confidence += 0.2;
        reasons.push('Brick confirmation');
      }
      
      this.bollingerBounces++;
      if (stochasticData.crossover === 'BEARISH') {
        this.stochasticCrossovers++;
      }
      this.emaTrendFilters++;
    }

    if (!action || confidence < 0.5) {
      return null;
    }

    // Calculate risk management parameters
    const stopLoss = this.calculateBollingerStopLoss(bollingerData, direction);
    const riskDistance = Math.abs(currentPrice - stopLoss);
    const takeProfit = this.calculateBollingerTakeProfit(currentPrice, riskDistance, direction, bollingerData);
    const positionSize = this.calculateBollingerPositionSize(riskDistance, currentPrice);

    if (positionSize <= 0 || riskDistance <= 0) {
      return null;
    }

    return {
      action,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      positionSize,
      confidence,
      reason: `Bollinger ${direction} (${(confidence * 100).toFixed(0)}%): ${reasons.join(', ')}`,
      signal_type: action === 'BUY' ? 'BOLLINGER_LONG' : 'BOLLINGER_SHORT',
      indicators: {
        bollinger: bollingerData,
        stochastic: stochasticData,
        ema: emaData
      },
      riskReward: Math.abs(takeProfit - currentPrice) / riskDistance
    };
  }

  /**
   * Check for Bollinger exit signals
   * @param {Array} bricks - All bricks
   * @param {Object} currentPosition - Current position
   * @returns {Object|null} Exit signal or null
   */
  checkBollingerExitSignal(bricks, currentPosition) {
    const latestBrick = bricks[bricks.length - 1];
    const currentPrice = latestBrick.close;
    const isLongPosition = currentPosition.quantity > 0;

    const bollingerData = this.calculateBollingerBands();
    const stochasticData = this.calculateStochastic(bricks);

    if (!bollingerData || !stochasticData) {
      return null;
    }

    let exitReason = null;

    // Exit Rule 1: Opposite Bollinger Band touch
    if (isLongPosition && currentPrice >= bollingerData.upperBand) {
      exitReason = 'Upper Bollinger Band reached';
    } else if (!isLongPosition && currentPrice <= bollingerData.lowerBand) {
      exitReason = 'Lower Bollinger Band reached';
    }

    // Exit Rule 2: Stochastic overbought/oversold exit
    if (!exitReason) {
      if (isLongPosition && stochasticData.k >= this.config.signals.overboughtLevel) {
        exitReason = 'Stochastic overbought';
      } else if (!isLongPosition && stochasticData.k <= this.config.signals.oversoldLevel) {
        exitReason = 'Stochastic oversold';
      }
    }

    // Exit Rule 3: Middle band reversion
    if (!exitReason) {
      const middleBand = bollingerData.middleBand;
      if (isLongPosition && currentPrice <= middleBand && latestBrick.direction === 'DOWN') {
        exitReason = 'Middle band reversion';
      } else if (!isLongPosition && currentPrice >= middleBand && latestBrick.direction === 'UP') {
        exitReason = 'Middle band reversion';
      }
    }

    if (exitReason) {
      return {
        action: isLongPosition ? 'SELL' : 'BUY',
        entryPrice: currentPrice,
        positionSize: Math.abs(currentPosition.quantity),
        confidence: 0.8,
        reason: `Bollinger Exit: ${exitReason}`,
        signal_type: 'BOLLINGER_EXIT',
        exitType: exitReason
      };
    }

    return null;
  }

  /**
   * Calculate Bollinger Bands for Renko bricks
   * @returns {Object|null} Bollinger Bands data
   */
  calculateBollingerBands() {
    const brickData = this.renkoEngine.getBrickOHLC(this.config.bollinger.period + 10);
    
    if (brickData.length < this.config.bollinger.period) {
      return null;
    }

    const closes = brickData.map(brick => brick.close);
    const period = this.config.bollinger.period;
    const stdDevMultiplier = this.config.bollinger.stdDev;

    // Calculate SMA (Middle Band)
    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((sum, price) => sum + price, 0) / period;

    // Calculate Standard Deviation
    const variance = recentCloses.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    // Calculate Bands
    const upperBand = sma + (stdDev * stdDevMultiplier);
    const lowerBand = sma - (stdDev * stdDevMultiplier);

    return {
      upperBand,
      middleBand: sma,
      lowerBand,
      stdDev,
      currentPrice: closes[closes.length - 1],
      bandwidth: ((upperBand - lowerBand) / sma) * 100
    };
  }

  /**
   * Calculate Stochastic Oscillator for Renko bricks
   * @param {Array} bricks - Brick data
   * @returns {Object|null} Stochastic data
   */
  calculateStochastic(bricks) {
    const brickData = this.renkoEngine.getBrickOHLC(this.config.stochastic.kPeriod + 10);
    
    if (brickData.length < this.config.stochastic.kPeriod) {
      return null;
    }

    const period = this.config.stochastic.kPeriod;
    const recentData = brickData.slice(-period);
    const currentClose = brickData[brickData.length - 1].close;

    // Find highest high and lowest low
    const highestHigh = Math.max(...recentData.map(brick => brick.high));
    const lowestLow = Math.min(...recentData.map(brick => brick.low));

    if (highestHigh === lowestLow) {
      return { k: 50, d: 50, crossover: 'NONE' };
    }

    // Calculate %K
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // For simplicity, use %K as %D (in practice, %D is SMA of %K)
    const d = k;

    // Detect crossovers
    let crossover = 'NONE';
    if (brickData.length >= period + 1) {
      const prevData = brickData.slice(-(period + 1), -1);
      const prevClose = prevData[prevData.length - 1].close;
      const prevHighest = Math.max(...prevData.map(brick => brick.high));
      const prevLowest = Math.min(...prevData.map(brick => brick.low));
      
      if (prevHighest !== prevLowest) {
        const prevK = ((prevClose - prevLowest) / (prevHighest - prevLowest)) * 100;
        
        if (prevK <= this.config.signals.oversoldLevel && k > this.config.signals.oversoldLevel) {
          crossover = 'BULLISH';
        } else if (prevK >= this.config.signals.overboughtLevel && k < this.config.signals.overboughtLevel) {
          crossover = 'BEARISH';
        }
      }
    }

    return { k, d, crossover };
  }

  /**
   * Calculate 21-period EMA for trend filter
   * @param {Array} bricks - Brick data
   * @returns {Object|null} EMA data
   */
  calculate21EMA(bricks) {
    const brickData = this.renkoEngine.getBrickOHLC(this.config.ema.period + 10);
    
    if (brickData.length < this.config.ema.period) {
      return null;
    }

    const closes = brickData.map(brick => brick.close);
    const emaArray = this.renkoEngine.calculateEMAArray(closes, this.config.ema.period);

    if (!emaArray || emaArray.length === 0) {
      return null;
    }

    const currentEMA = emaArray[emaArray.length - 1];
    const currentPrice = closes[closes.length - 1];

    return {
      value: currentEMA,
      currentPrice: currentPrice,
      trend: currentPrice > currentEMA ? 'UP' : 'DOWN'
    };
  }

  /**
   * Get recent Bollinger Band touch
   * @returns {Object|null} Recent band touch
   */
  getRecentBandTouch() {
    if (this.bandTouches.length === 0) return null;

    // Look for touches in last 5 bricks
    const recentTouches = this.bandTouches.slice(-5);
    return recentTouches.find(touch => touch.touchedUpper || touch.touchedLower) || null;
  }

  /**
   * Check for confirmation bricks
   * @param {Array} bricks - All bricks
   * @param {string} direction - Expected direction
   * @returns {boolean} Has confirmation
   */
  hasConfirmationBricks(bricks, direction) {
    if (bricks.length < this.config.signals.confirmationBricks) return false;

    const recentBricks = bricks.slice(-this.config.signals.confirmationBricks);
    return recentBricks.every(brick => brick.direction === direction);
  }

  /**
   * Calculate Bollinger-based stop loss
   * @param {Object} bollingerData - Bollinger Bands data
   * @param {string} direction - Position direction
   * @returns {number} Stop loss price
   */
  calculateBollingerStopLoss(bollingerData, direction) {
    const buffer = (bollingerData.upperBand - bollingerData.lowerBand) * 0.1; // 10% buffer

    if (direction === 'LONG') {
      return bollingerData.lowerBand - buffer;
    } else {
      return bollingerData.upperBand + buffer;
    }
  }

  /**
   * Calculate Bollinger-based take profit
   * @param {number} entryPrice - Entry price
   * @param {number} riskDistance - Distance to stop loss
   * @param {string} direction - Position direction
   * @param {Object} bollingerData - Bollinger Bands data
   * @returns {number} Take profit price
   */
  calculateBollingerTakeProfit(entryPrice, riskDistance, direction, bollingerData) {
    const rewardDistance = riskDistance * this.config.risk.riskRewardRatio;

    if (direction === 'LONG') {
      // Target upper band or calculated reward
      const upperTarget = bollingerData.upperBand;
      const calculatedTarget = entryPrice + rewardDistance;
      return Math.min(upperTarget, calculatedTarget);
    } else {
      // Target lower band or calculated reward
      const lowerTarget = bollingerData.lowerBand;
      const calculatedTarget = entryPrice - rewardDistance;
      return Math.max(lowerTarget, calculatedTarget);
    }
  }

  /**
   * Calculate position size for Bollinger strategy
   * @param {number} riskDistance - Distance to stop loss
   * @param {number} currentPrice - Current price
   * @returns {number} Position size
   */
  calculateBollingerPositionSize(riskDistance, currentPrice) {
    if (riskDistance <= 0) return 0;

    const portfolioValue = 100000; // Modify based on your portfolio system
    const riskAmount = portfolioValue * this.config.risk.maxRiskPerTrade;
    let positionSize = riskAmount / riskDistance;

    // Apply constraints
    const maxPositionValue = portfolioValue * 0.08; // Max 8% for ranging strategy
    const maxQuantity = maxPositionValue / currentPrice;
    positionSize = Math.min(positionSize, maxQuantity);

    const minPositionSize = 0.001;
    if (positionSize < minPositionSize) {
      return 0;
    }

    return parseFloat(positionSize.toFixed(6));
  }

  /**
   * Get strategy statistics
   * @returns {Object} Performance statistics
   */
  getStatistics() {
    const renkoStats = this.renkoEngine.getStatistics();
    
    return {
      strategy: this.name,
      totalSignals: this.totalSignals,
      entrySignals: this.entrySignals,
      exitSignals: this.exitSignals,
      bollingerBounces: this.bollingerBounces,
      stochasticCrossovers: this.stochasticCrossovers,
      emaTrendFilters: this.emaTrendFilters,
      activePositions: this.currentPositions.length,
      lastTradeTime: this.lastTradeTime,
      renkoEngine: renkoStats,
      config: this.config
    };
  }

  /**
   * Get current Bollinger Bands for monitoring
   * @returns {Object} Bollinger Bands data
   */
  getCurrentBollingerBands() {
    return this.calculateBollingerBands();
  }

  /**
   * Get current Stochastic for monitoring
   * @returns {Object} Stochastic data
   */
  getCurrentStochastic() {
    return this.calculateStochastic(this.renkoEngine.getAllBricks());
  }

  /**
   * Reset strategy state
   */
  reset() {
    this.renkoEngine.reset();
    this.lastTradeTime = null;
    this.currentPositions = [];
    this.bandTouches = [];
    this.totalSignals = 0;
    this.entrySignals = 0;
    this.exitSignals = 0;
    this.bollingerBounces = 0;
    this.stochasticCrossovers = 0;
    this.emaTrendFilters = 0;
  }

  /**
   * Get Renko engine instance
   * @returns {RenkoEngine} Renko engine
   */
  getRenkoEngine() {
    return this.renkoEngine;
  }
}

module.exports = BollingerStochasticRenkoStrategy;