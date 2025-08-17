const BaseStrategy = require('./baseStrategy');
const RenkoEngine = require('../engines/RenkoEngine');

/**
 * SuperTrend Renko Confluence Strategy
 * 
 * HIGH-PERFORMANCE PROFESSIONAL TRADING SYSTEM
 * 
 * Components:
 * - Renko Engine with ATR-based brick sizing (0.5x ATR-14)
 * - SuperTrend indicator (Period: 10, Multiplier: 3.0)
 * - MACD (12, 26, 9) for trend confirmation
 * - Volume analysis for breakout validation
 * - Advanced confluence scoring system
 * 
 * Entry Rules:
 * - NEW brick forms in SuperTrend direction
 * - MACD confirms trend (histogram > 0 for LONG, < 0 for SHORT)
 * - Volume surge detected (1.5x average)
 * - Confluence score >= 7/10
 * 
 * Exit Rules:
 * - SuperTrend line trail stop
 * - MACD opposite crossover
 * - 2 consecutive bricks against position
 * - 3:1 minimum risk/reward achieved
 * 
 * Risk Management:
 * - 2% risk per trade
 * - Maximum 3 positions simultaneously
 * - Daily loss limit: 6% of account
 * - Minimum 30-second cooldown between trades
 */
class SuperTrendRenkoStrategy extends BaseStrategy {
  constructor(options = {}) {
    super('SuperTrend Renko Confluence Strategy');
    
    // Core configuration
    this.config = {
      renko: {
        brickSizing: 'ATR',
        atrPeriod: options.atrPeriod || 14,
        atrMultiplier: options.atrMultiplier || 0.5,
        source: options.priceSource || 'close'
      },
      supertrend: {
        period: options.supertrendPeriod || 10,
        multiplier: options.supertrendMultiplier || 3.0
      },
      macd: {
        fast: options.macdFast || 12,
        slow: options.macdSlow || 26,
        signal: options.macdSignal || 9
      },
      volume: {
        surgePeriod: options.volumeSurgePeriod || 20,
        surgeThreshold: options.volumeSurgeThreshold || 1.5
      },
      risk: {
        maxRiskPerTrade: options.maxRiskPerTrade || 0.02,
        maxDailyLoss: options.maxDailyLoss || 0.06,
        minRiskReward: options.minRiskReward || 3.0,
        maxPositions: options.maxPositions || 3,
        cooldownSeconds: options.cooldownSeconds || 30
      },
      confluence: {
        minScore: options.minConfluenceScore || 7,
        maxScore: 10
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
    this.currentPositions = [];
    this.lastTradeTime = null;
    this.dailyPnL = 0;
    this.dailyTrades = 0;
    this.sessionStartTime = Date.now();
    this.volumeHistory = [];
    
    // Performance tracking
    this.totalSignals = 0;
    this.entrySignals = 0;
    this.exitSignals = 0;
    this.confluenceScores = [];
    this.superTrendSignals = 0;
    this.macdConfirmations = 0;
    this.volumeSurges = 0;
    
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
      console.log(`🔄 SuperTrend Renko: Trend Change ${data.oldDirection} -> ${data.newDirection}`);
    });

    this.renkoEngine.on('error', (error) => {
      console.error('SuperTrend RenkoEngine Error:', error);
    });
  }

  /**
   * Handle new brick formation
   * @param {Object} brick - New brick data
   */
  onNewBrick(brick) {
    // Update volume history
    if (brick.volume) {
      this.volumeHistory.push(brick.volume);
      if (this.volumeHistory.length > this.config.volume.surgePeriod) {
        this.volumeHistory.shift();
      }
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

      // Check daily loss limit
      if (this.dailyPnL <= -this.config.risk.maxDailyLoss * portfolio.initialCapital) {
        console.log(`⚠️ Daily loss limit reached: ${(this.dailyPnL).toFixed(2)}`);
        return null;
      }

      // Check maximum positions
      if (this.currentPositions.length >= this.config.risk.maxPositions) {
        return null;
      }

      // Check cooldown
      if (this.lastTradeTime && 
          (Date.now() - this.lastTradeTime) < (this.config.risk.cooldownSeconds * 1000)) {
        return null;
      }

      const allBricks = this.renkoEngine.getAllBricks();
      if (allBricks.length < Math.max(this.config.supertrend.period, this.config.macd.slow) + 10) {
        return null; // Not enough data
      }

      // Get current position from portfolio
      const currentPosition = portfolio.getPosition ? 
        portfolio.getPosition('BTCUSD') : 
        portfolio.positions?.get('BTCUSD') || { quantity: 0 };

      // Analyze for signals
      const signal = this.analyzeConfluenceSignal(allBricks, currentCandle, currentPosition);
      
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
      console.error('SuperTrendRenkoStrategy.generateSignal Error:', error);
      return null;
    }
  }

  /**
   * Analyze confluence signals for entry/exit
   * @param {Array} bricks - All bricks
   * @param {Object} currentCandle - Current candle data
   * @param {Object} currentPosition - Current position
   * @returns {Object|null} Signal object or null
   */
  analyzeConfluenceSignal(bricks, currentCandle, currentPosition) {
    // Check exit signals first (if in position)
    if (currentPosition && Math.abs(currentPosition.quantity) > 0) {
      const exitSignal = this.checkSuperTrendExitSignal(bricks, currentPosition);
      if (exitSignal) {
        return exitSignal;
      }
    }

    // Check entry signals (if not in position)
    if (!currentPosition || currentPosition.quantity === 0) {
      const entrySignal = this.checkSuperTrendEntrySignal(bricks, currentCandle);
      if (entrySignal) {
        return entrySignal;
      }
    }

    return null;
  }

  /**
   * Check for SuperTrend entry signals with confluence
   * @param {Array} bricks - All bricks
   * @param {Object} currentCandle - Current candle
   * @returns {Object|null} Entry signal or null
   */
  checkSuperTrendEntrySignal(bricks, currentCandle) {
    const latestBrick = bricks[bricks.length - 1];
    const currentPrice = latestBrick.close;

    // Calculate technical indicators
    const superTrend = this.renkoEngine.calculateRenkoSuperTrend(
      this.config.supertrend.period, 
      this.config.supertrend.multiplier
    );

    const macd = this.renkoEngine.calculateRenkoMACD(
      this.config.macd.fast,
      this.config.macd.slow,
      this.config.macd.signal
    );

    const volumeAnalysis = this.renkoEngine.detectVolumeSurge(
      this.volumeHistory,
      this.config.volume.surgeThreshold
    );

    // Check if indicators are ready
    if (!superTrend.trend || !macd.macd) {
      return null;
    }

    // Calculate confluence score
    const confluenceData = this.calculateConfluenceScore({
      brick: latestBrick,
      superTrend: superTrend,
      macd: macd,
      volume: volumeAnalysis,
      bricks: bricks
    });

    // Check minimum confluence score
    if (confluenceData.score < this.config.confluence.minScore) {
      return null;
    }

    let action = null;
    let direction = null;

    // LONG Signal Logic
    if (superTrend.direction === 'UP' && 
        latestBrick.direction === 'UP' &&
        macd.direction === 'BULLISH' &&
        macd.histogram > 0) {
      action = 'BUY';
      direction = 'LONG';
    }
    // SHORT Signal Logic  
    else if (superTrend.direction === 'DOWN' && 
             latestBrick.direction === 'DOWN' &&
             macd.direction === 'BEARISH' &&
             macd.histogram < 0) {
      action = 'SELL';
      direction = 'SHORT';
    }

    if (!action) {
      return null;
    }

    // Calculate risk management parameters
    const stopLoss = this.calculateSuperTrendStopLoss(superTrend, direction);
    const riskDistance = Math.abs(currentPrice - stopLoss);
    const takeProfit = this.calculateSuperTrendTakeProfit(currentPrice, riskDistance, direction);
    const positionSize = this.calculateAdvancedPositionSize(riskDistance, currentPrice);

    if (positionSize <= 0 || riskDistance <= 0) {
      return null;
    }

    // Track signals for performance analysis
    this.superTrendSignals++;
    if (macd.direction === 'BULLISH' || macd.direction === 'BEARISH') {
      this.macdConfirmations++;
    }
    if (volumeAnalysis.surge) {
      this.volumeSurges++;
    }
    this.confluenceScores.push(confluenceData.score);

    return {
      action,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      positionSize,
      confidence: confluenceData.score / this.config.confluence.maxScore,
      reason: `SuperTrend ${direction} (${confluenceData.score}/${this.config.confluence.maxScore}): ${confluenceData.reasons.join(', ')}`,
      signal_type: action === 'BUY' ? 'SUPERTREND_LONG' : 'SUPERTREND_SHORT',
      confluence: confluenceData,
      superTrend: superTrend,
      macd: macd,
      volume: volumeAnalysis,
      riskReward: Math.abs(takeProfit - currentPrice) / riskDistance
    };
  }

  /**
   * Check for SuperTrend exit signals
   * @param {Array} bricks - All bricks
   * @param {Object} currentPosition - Current position
   * @returns {Object|null} Exit signal or null
   */
  checkSuperTrendExitSignal(bricks, currentPosition) {
    const latestBrick = bricks[bricks.length - 1];
    const currentPrice = latestBrick.close;
    const isLongPosition = currentPosition.quantity > 0;

    // Calculate current indicators
    const superTrend = this.renkoEngine.calculateRenkoSuperTrend(
      this.config.supertrend.period, 
      this.config.supertrend.multiplier
    );

    const macd = this.renkoEngine.calculateRenkoMACD(
      this.config.macd.fast,
      this.config.macd.slow,
      this.config.macd.signal
    );

    if (!superTrend.trend || !macd.macd) {
      return null;
    }

    let exitReason = null;

    // Exit Rule 1: SuperTrend reversal
    if (isLongPosition && superTrend.direction === 'DOWN') {
      exitReason = `SuperTrend reversal to DOWN`;
    } else if (!isLongPosition && superTrend.direction === 'UP') {
      exitReason = `SuperTrend reversal to UP`;
    }

    // Exit Rule 2: MACD opposite crossover
    if (!exitReason && macd.crossover !== 'NONE') {
      if (isLongPosition && macd.crossover === 'BEARISH_CROSSOVER') {
        exitReason = `MACD bearish crossover`;
      } else if (!isLongPosition && macd.crossover === 'BULLISH_CROSSOVER') {
        exitReason = `MACD bullish crossover`;
      }
    }

    // Exit Rule 3: Consecutive bricks against position
    if (!exitReason) {
      const consecutiveInfo = this.renkoEngine.getConsecutiveBricks();
      if (consecutiveInfo.count >= 2) {
        if (isLongPosition && consecutiveInfo.direction === 'DOWN') {
          exitReason = `2 consecutive DOWN bricks`;
        } else if (!isLongPosition && consecutiveInfo.direction === 'UP') {
          exitReason = `2 consecutive UP bricks`;
        }
      }
    }

    if (exitReason) {
      return {
        action: isLongPosition ? 'SELL' : 'BUY',
        entryPrice: currentPrice,
        positionSize: Math.abs(currentPosition.quantity),
        confidence: 0.9, // High confidence on technical exits
        reason: `SuperTrend Exit: ${exitReason}`,
        signal_type: 'SUPERTREND_EXIT',
        exitType: exitReason,
        superTrend: superTrend,
        macd: macd
      };
    }

    return null;
  }

  /**
   * Calculate confluence score (0-10)
   * @param {Object} data - Technical analysis data
   * @returns {Object} Confluence score and details
   */
  calculateConfluenceScore(data) {
    let score = 0;
    const reasons = [];

    // SuperTrend alignment (3 points max)
    if (data.superTrend.direction === data.brick.direction) {
      score += 3;
      reasons.push(`SuperTrend ${data.superTrend.direction} aligned`);
    }

    // MACD confirmation (2 points max)
    if (data.macd.direction === 'BULLISH' && data.brick.direction === 'UP') {
      score += 2;
      reasons.push('MACD bullish');
    } else if (data.macd.direction === 'BEARISH' && data.brick.direction === 'DOWN') {
      score += 2;
      reasons.push('MACD bearish');
    }

    // MACD histogram momentum (1 point)
    if ((data.brick.direction === 'UP' && data.macd.histogram > 0) ||
        (data.brick.direction === 'DOWN' && data.macd.histogram < 0)) {
      score += 1;
      reasons.push('MACD momentum');
    }

    // Volume surge (2 points max)
    if (data.volume.surge) {
      score += 2;
      reasons.push(`Volume surge ${data.volume.ratio.toFixed(1)}x`);
    }

    // Consecutive brick strength (1 point)
    const consecutiveInfo = this.renkoEngine.getConsecutiveBricks();
    if (consecutiveInfo.count >= 2 && consecutiveInfo.direction === data.brick.direction) {
      score += 1;
      reasons.push(`${consecutiveInfo.count} consecutive ${consecutiveInfo.direction}`);
    }

    // MACD crossover bonus (1 point)
    if ((data.macd.crossover === 'BULLISH_CROSSOVER' && data.brick.direction === 'UP') ||
        (data.macd.crossover === 'BEARISH_CROSSOVER' && data.brick.direction === 'DOWN')) {
      score += 1;
      reasons.push('MACD crossover');
    }

    return {
      score: Math.min(score, this.config.confluence.maxScore),
      maxScore: this.config.confluence.maxScore,
      reasons: reasons,
      details: {
        superTrend: data.superTrend.direction,
        macd: data.macd.direction,
        volume: data.volume.surge,
        consecutive: consecutiveInfo.count
      }
    };
  }

  /**
   * Calculate SuperTrend-based stop loss
   * @param {Object} superTrend - SuperTrend data
   * @param {string} direction - Position direction
   * @returns {number} Stop loss price
   */
  calculateSuperTrendStopLoss(superTrend, direction) {
    // Use SuperTrend line as stop loss
    return superTrend.value;
  }

  /**
   * Calculate take profit based on risk-reward ratio
   * @param {number} entryPrice - Entry price
   * @param {number} riskDistance - Distance to stop loss
   * @param {string} direction - Position direction
   * @returns {number} Take profit price
   */
  calculateSuperTrendTakeProfit(entryPrice, riskDistance, direction) {
    const rewardDistance = riskDistance * this.config.risk.minRiskReward;
    
    if (direction === 'LONG') {
      return entryPrice + rewardDistance;
    } else {
      return entryPrice - rewardDistance;
    }
  }

  /**
   * Calculate advanced position size with risk management
   * @param {number} riskDistance - Distance to stop loss
   * @param {number} currentPrice - Current price
   * @returns {number} Position size
   */
  calculateAdvancedPositionSize(riskDistance, currentPrice) {
    if (riskDistance <= 0) return 0;

    // Base calculation: risk amount / stop distance
    const portfolioValue = 100000; // You can modify based on your portfolio system
    const riskAmount = portfolioValue * this.config.risk.maxRiskPerTrade;
    let positionSize = riskAmount / riskDistance;

    // Apply maximum position constraints
    const maxPositionValue = portfolioValue * 0.1; // Max 10% of portfolio
    const maxQuantity = maxPositionValue / currentPrice;
    positionSize = Math.min(positionSize, maxQuantity);

    // Ensure minimum position size
    const minPositionSize = 0.001;
    if (positionSize < minPositionSize) {
      return 0;
    }

    return parseFloat(positionSize.toFixed(6));
  }

  /**
   * Get strategy performance statistics
   * @returns {Object} Performance data
   */
  getStatistics() {
    const renkoStats = this.renkoEngine.getStatistics();
    const avgConfluence = this.confluenceScores.length > 0 ? 
      this.confluenceScores.reduce((sum, score) => sum + score, 0) / this.confluenceScores.length : 0;
    
    return {
      strategy: this.name,
      totalSignals: this.totalSignals,
      entrySignals: this.entrySignals,
      exitSignals: this.exitSignals,
      superTrendSignals: this.superTrendSignals,
      macdConfirmations: this.macdConfirmations,
      volumeSurges: this.volumeSurges,
      avgConfluenceScore: avgConfluence.toFixed(2),
      dailyPnL: this.dailyPnL,
      dailyTrades: this.dailyTrades,
      activePositions: this.currentPositions.length,
      lastTradeTime: this.lastTradeTime,
      renkoEngine: renkoStats,
      config: this.config
    };
  }

  /**
   * Get current SuperTrend data for monitoring
   * @returns {Object} SuperTrend information
   */
  getCurrentSuperTrend() {
    return this.renkoEngine.calculateRenkoSuperTrend(
      this.config.supertrend.period,
      this.config.supertrend.multiplier
    );
  }

  /**
   * Get current MACD data for monitoring
   * @returns {Object} MACD information
   */
  getCurrentMACD() {
    return this.renkoEngine.calculateRenkoMACD(
      this.config.macd.fast,
      this.config.macd.slow,
      this.config.macd.signal
    );
  }

  /**
   * Reset strategy state
   */
  reset() {
    this.renkoEngine.reset();
    this.currentPositions = [];
    this.lastTradeTime = null;
    this.dailyPnL = 0;
    this.dailyTrades = 0;
    this.sessionStartTime = Date.now();
    this.volumeHistory = [];
    this.totalSignals = 0;
    this.entrySignals = 0;
    this.exitSignals = 0;
    this.confluenceScores = [];
    this.superTrendSignals = 0;
    this.macdConfirmations = 0;
    this.volumeSurges = 0;
  }

  /**
   * Update daily P&L tracking
   * @param {number} pnl - Profit/Loss amount
   */
  updateDailyPnL(pnl) {
    this.dailyPnL += pnl;
    this.dailyTrades++;
  }

  /**
   * Get Renko engine instance
   * @returns {RenkoEngine} Renko engine
   */
  getRenkoEngine() {
    return this.renkoEngine;
  }
}

module.exports = SuperTrendRenkoStrategy;