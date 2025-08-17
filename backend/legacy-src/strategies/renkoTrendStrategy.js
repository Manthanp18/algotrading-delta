const BaseStrategy = require('./baseStrategy');
const RenkoEngine = require('../engines/RenkoEngine');

/**
 * RenkoTrendStrategy - Trend-following strategy using Renko charts
 * 
 * Entry Rules:
 * - Minimum 3 consecutive bricks in same direction
 * - Strong trend momentum with good consecutive count
 * - Volume confirmation (if available)
 * 
 * Exit Rules:
 * - 2 consecutive bricks in opposite direction (trend reversal)
 * - Trend exhaustion after 15 bricks
 * - Stop loss: Below/above recent 5-brick low/high minus 0.5 brick buffer
 * - Take profit: 2.5x risk-reward ratio from stop distance
 * 
 * Risk Management:
 * - 2% default risk per trade
 * - Dynamic position sizing based on stop distance
 * - Maximum position limits
 */
class RenkoTrendStrategy extends BaseStrategy {
  constructor(options = {}) {
    super('Renko Trend Strategy');
    
    // Strategy parameters
    this.riskPercentage = options.riskPercentage || 0.02; // 2% risk per trade
    this.minConsecutiveBricks = options.minConsecutiveBricks || 3;
    this.maxTrendLength = options.maxTrendLength || 15;
    this.exitConsecutiveBricks = options.exitConsecutiveBricks || 2;
    this.stopLossLookback = options.stopLossLookback || 5;
    this.stopLossBufferMultiplier = options.stopLossBufferMultiplier || 0.5;
    this.riskRewardRatio = options.riskRewardRatio || 2.5;
    this.maxPositionSize = options.maxPositionSize || 0.1; // 10% of portfolio max
    
    // Renko engine configuration
    this.renkoOptions = {
      priceSource: options.priceSource || 'close',
      atrPeriod: options.atrPeriod || 14,
      atrMultiplier: options.atrMultiplier || 0.5,
      autoCalculateBrickSize: options.autoCalculateBrickSize !== false
    };
    
    // Initialize Renko engine
    this.renkoEngine = new RenkoEngine(this.renkoOptions);
    
    // Strategy state
    this.currentPosition = null;
    this.entryBrick = null;
    this.lastSignalTime = null;
    this.signalCount = 0;
    this.consecutiveTrendLength = 0;
    
    // Performance tracking
    this.totalSignals = 0;
    this.entrySignals = 0;
    this.exitSignals = 0;
    this.trendExhaustionExits = 0;
    this.stopLossExits = 0;
    this.takeProfitExits = 0;
    
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
      this.onTrendChange(data);
    });

    this.renkoEngine.on('error', (error) => {
      console.error('RenkoEngine Error:', error);
    });
  }

  /**
   * Handle new brick formation
   * @param {Object} brick - New brick data
   */
  onNewBrick(brick) {
    // Update trend length tracking
    if (brick.direction === this.renkoEngine.currentDirection) {
      this.consecutiveTrendLength++;
    } else {
      this.consecutiveTrendLength = 1;
    }
  }

  /**
   * Handle trend direction change
   * @param {Object} data - Trend change data
   */
  onTrendChange(data) {
    console.log(`Renko Trend Change: ${data.oldDirection} -> ${data.newDirection} (${data.consecutiveCount} consecutive)`);
    this.consecutiveTrendLength = 1;
  }

  /**
   * Main signal generation method (BaseStrategy interface)
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

      const allBricks = this.renkoEngine.getAllBricks();
      if (allBricks.length < this.minConsecutiveBricks) {
        return null; // Not enough bricks for analysis
      }

      // Get current position from portfolio
      const currentPosition = portfolio.getPosition ? 
        portfolio.getPosition('BTCUSD') : 
        portfolio.positions?.get('BTCUSD') || { quantity: 0 };

      this.currentPosition = currentPosition;

      // Analyze the new brick for signals
      const signal = this.analyzeBrick(allBricks[allBricks.length - 1], allBricks);
      
      if (signal) {
        this.totalSignals++;
        this.lastSignalTime = new Date();
        
        // Add strategy-specific information
        signal.strategy = this.name;
        signal.brickSize = this.renkoEngine.getCurrentBrickSize();
        signal.consecutiveCount = this.renkoEngine.getConsecutiveBricks().count;
        signal.trendStrength = this.renkoEngine.getRenkoTrendStrength();
        
        if (signal.action === 'BUY' || signal.action === 'SELL') {
          this.entrySignals++;
        } else {
          this.exitSignals++;
        }
      }

      return signal;

    } catch (error) {
      console.error('RenkoTrendStrategy.generateSignal Error:', error);
      return null;
    }
  }

  /**
   * Analyze brick for trading signals
   * @param {Object} newBrick - Latest brick
   * @param {Array} allBricks - All bricks
   * @returns {Object|null} Signal object or null
   */
  analyzeBrick(newBrick, allBricks) {
    // Check exit signals first (if in position)
    if (this.currentPosition && Math.abs(this.currentPosition.quantity) > 0) {
      const exitSignal = this.checkExitSignal(allBricks);
      if (exitSignal) {
        return exitSignal;
      }
    }

    // Check entry signals (if not in position)
    if (!this.currentPosition || this.currentPosition.quantity === 0) {
      const entrySignal = this.checkEntrySignal(allBricks);
      if (entrySignal) {
        this.entryBrick = newBrick;
        return entrySignal;
      }
    }

    return null;
  }

  /**
   * Check for entry signals
   * @param {Array} bricks - All bricks
   * @returns {Object|null} Entry signal or null
   */
  checkEntrySignal(bricks) {
    if (bricks.length < this.minConsecutiveBricks) {
      return null;
    }

    const consecutiveInfo = this.renkoEngine.getConsecutiveBricks();
    const { count, direction } = consecutiveInfo;

    // Must have minimum consecutive bricks
    if (count < this.minConsecutiveBricks) {
      return null;
    }

    // Don't enter if trend is too exhausted
    if (count > this.maxTrendLength) {
      return null;
    }

    const recentBricks = bricks.slice(-this.minConsecutiveBricks);
    const latestBrick = bricks[bricks.length - 1];
    const currentPrice = latestBrick.close;

    // Confirm all recent bricks are in same direction
    const allSameDirection = recentBricks.every(brick => brick.direction === direction);
    if (!allSameDirection) {
      return null;
    }

    // Calculate entry parameters
    let action, stopLoss, takeProfit, confidence;

    if (direction === 'UP') {
      action = 'BUY';
      stopLoss = this.calculateStopLoss(bricks, 'LONG');
      takeProfit = this.calculateTakeProfit(bricks, 'LONG');
      confidence = this.calculateConfidence(count, bricks);
    } else if (direction === 'DOWN') {
      action = 'SELL';
      stopLoss = this.calculateStopLoss(bricks, 'SHORT');
      takeProfit = this.calculateTakeProfit(bricks, 'SHORT');
      confidence = this.calculateConfidence(count, bricks);
    } else {
      return null;
    }

    // Validate stop loss and take profit
    if (!stopLoss || !takeProfit || stopLoss === currentPrice) {
      return null;
    }

    // Calculate position size based on risk
    const riskAmount = this.calculateRiskAmount();
    const stopDistance = Math.abs(currentPrice - stopLoss);
    const positionSize = this.calculatePositionSize(riskAmount, stopDistance, currentPrice);

    if (positionSize <= 0) {
      return null;
    }

    return {
      action,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      positionSize,
      confidence,
      reason: `Renko ${direction} trend: ${count} consecutive bricks (confidence: ${(confidence * 100).toFixed(1)}%)`,
      signal_type: action === 'BUY' ? 'LONG_ENTRY' : 'SHORT_ENTRY',
      riskAmount,
      stopDistance,
      riskReward: Math.abs(takeProfit - currentPrice) / stopDistance
    };
  }

  /**
   * Check for exit signals
   * @param {Array} bricks - All bricks
   * @returns {Object|null} Exit signal or null
   */
  checkExitSignal(bricks) {
    if (!this.currentPosition || this.currentPosition.quantity === 0 || !this.entryBrick) {
      return null;
    }

    const currentBrick = bricks[bricks.length - 1];
    const currentPrice = currentBrick.close;
    const isLongPosition = this.currentPosition.quantity > 0;
    const consecutiveInfo = this.renkoEngine.getConsecutiveBricks();
    const { count, direction } = consecutiveInfo;

    let exitReason = null;

    // Exit Rule 1: Opposite direction bricks (trend reversal)
    if (isLongPosition && direction === 'DOWN' && count >= this.exitConsecutiveBricks) {
      exitReason = `Trend reversal: ${count} DOWN bricks`;
      this.exitSignals++;
    } else if (!isLongPosition && direction === 'UP' && count >= this.exitConsecutiveBricks) {
      exitReason = `Trend reversal: ${count} UP bricks`;
      this.exitSignals++;
    }

    // Exit Rule 2: Trend exhaustion
    if (!exitReason && this.consecutiveTrendLength >= this.maxTrendLength) {
      exitReason = `Trend exhaustion: ${this.consecutiveTrendLength} bricks`;
      this.trendExhaustionExits++;
    }

    if (exitReason) {
      return {
        action: isLongPosition ? 'SELL' : 'BUY',
        entryPrice: currentPrice,
        positionSize: Math.abs(this.currentPosition.quantity),
        confidence: 0.8, // High confidence on trend-based exits
        reason: `Renko Exit: ${exitReason}`,
        signal_type: 'EXIT',
        exitType: exitReason.includes('reversal') ? 'TREND_REVERSAL' : 'TREND_EXHAUSTION'
      };
    }

    return null;
  }

  /**
   * Calculate stop loss price
   * @param {Array} bricks - All bricks
   * @param {string} direction - 'LONG' or 'SHORT'
   * @returns {number} Stop loss price
   */
  calculateStopLoss(bricks, direction) {
    if (bricks.length < this.stopLossLookback) {
      return null;
    }

    const recentBricks = bricks.slice(-this.stopLossLookback);
    const brickSize = this.renkoEngine.getCurrentBrickSize();
    const buffer = brickSize * this.stopLossBufferMultiplier;

    if (direction === 'LONG') {
      // Stop below recent low
      const recentLow = Math.min(...recentBricks.map(brick => Math.min(brick.open, brick.close)));
      return recentLow - buffer;
    } else {
      // Stop above recent high
      const recentHigh = Math.max(...recentBricks.map(brick => Math.max(brick.open, brick.close)));
      return recentHigh + buffer;
    }
  }

  /**
   * Calculate take profit price
   * @param {Array} bricks - All bricks
   * @param {string} direction - 'LONG' or 'SHORT'
   * @returns {number} Take profit price
   */
  calculateTakeProfit(bricks, direction) {
    const currentPrice = bricks[bricks.length - 1].close;
    const stopLoss = this.calculateStopLoss(bricks, direction);
    
    if (!stopLoss) {
      return null;
    }

    const stopDistance = Math.abs(currentPrice - stopLoss);
    const profitDistance = stopDistance * this.riskRewardRatio;

    if (direction === 'LONG') {
      return currentPrice + profitDistance;
    } else {
      return currentPrice - profitDistance;
    }
  }

  /**
   * Calculate confidence score based on trend strength
   * @param {number} consecutive - Consecutive brick count
   * @param {Array} bricks - All bricks
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(consecutive, bricks) {
    // Base confidence from consecutive count
    let confidence = Math.min(consecutive / 10, 0.8); // Max 0.8 from consecutive

    // Add trend strength component
    const trendStrength = Math.abs(this.renkoEngine.getRenkoTrendStrength());
    confidence += trendStrength * 0.2; // Up to 0.2 from trend strength

    // Reduce confidence if trend is too long (exhaustion risk)
    if (consecutive > this.maxTrendLength * 0.7) {
      confidence *= 0.8;
    }

    // Ensure confidence is within bounds
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate risk amount based on portfolio
   * @returns {number} Risk amount in dollars
   */
  calculateRiskAmount() {
    // This would typically get portfolio value from the portfolio object
    // For now, assume a default portfolio value
    const portfolioValue = 100000; // You can modify this based on your portfolio system
    return portfolioValue * this.riskPercentage;
  }

  /**
   * Calculate position size based on risk management
   * @param {number} riskAmount - Amount to risk
   * @param {number} stopDistance - Distance to stop loss
   * @param {number} currentPrice - Current price
   * @returns {number} Position size
   */
  calculatePositionSize(riskAmount, stopDistance, currentPrice) {
    if (stopDistance <= 0) {
      return 0;
    }

    // Basic position sizing: risk amount / stop distance
    let positionSize = riskAmount / stopDistance;

    // Apply maximum position size limit
    const maxPositionValue = currentPrice * this.maxPositionSize;
    const maxQuantity = maxPositionValue / currentPrice;
    
    positionSize = Math.min(positionSize, maxQuantity);

    // Ensure minimum position size
    const minPositionSize = 0.001; // Minimum trade size
    if (positionSize < minPositionSize) {
      return 0;
    }

    // Round to reasonable precision
    return parseFloat(positionSize.toFixed(6));
  }

  /**
   * Get strategy statistics
   * @returns {Object} Strategy performance statistics
   */
  getStatistics() {
    const renkoStats = this.renkoEngine.getStatistics();
    
    return {
      strategy: this.name,
      totalSignals: this.totalSignals,
      entrySignals: this.entrySignals,
      exitSignals: this.exitSignals,
      trendExhaustionExits: this.trendExhaustionExits,
      stopLossExits: this.stopLossExits,
      takeProfitExits: this.takeProfitExits,
      lastSignalTime: this.lastSignalTime,
      consecutiveTrendLength: this.consecutiveTrendLength,
      currentPosition: this.currentPosition,
      renkoEngine: renkoStats,
      parameters: {
        riskPercentage: this.riskPercentage,
        minConsecutiveBricks: this.minConsecutiveBricks,
        maxTrendLength: this.maxTrendLength,
        riskRewardRatio: this.riskRewardRatio,
        stopLossLookback: this.stopLossLookback
      }
    };
  }

  /**
   * Reset strategy state
   */
  reset() {
    this.renkoEngine.reset();
    this.currentPosition = null;
    this.entryBrick = null;
    this.lastSignalTime = null;
    this.signalCount = 0;
    this.consecutiveTrendLength = 0;
    this.totalSignals = 0;
    this.entrySignals = 0;
    this.exitSignals = 0;
  }

  /**
   * Update strategy parameters
   * @param {Object} params - New parameters
   */
  updateParameters(params) {
    Object.keys(params).forEach(key => {
      if (this.hasOwnProperty(key)) {
        this[key] = params[key];
      }
    });
  }

  /**
   * Get current Renko bricks for analysis
   * @param {number} count - Number of recent bricks
   * @returns {Array} Recent bricks
   */
  getRecentBricks(count = 10) {
    return this.renkoEngine.getRecentBricks(count);
  }

  /**
   * Get Renko engine instance (for advanced usage)
   * @returns {RenkoEngine} Renko engine instance
   */
  getRenkoEngine() {
    return this.renkoEngine;
  }
}

module.exports = RenkoTrendStrategy;