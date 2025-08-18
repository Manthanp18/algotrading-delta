const EventEmitter = require('events');

/**
 * RenkoEngine - Core Renko chart calculation engine
 * 
 * Features:
 * - ATR-based optimal brick sizing
 * - Real-time price updates with multi-brick formation
 * - Multiple price source support (close, hl2, hlc3, ohlc4)
 * - Event emission for monitoring
 * - Consecutive brick counting and trend analysis
 * 
 * Events:
 * - 'newBrick': Emitted when new brick forms
 * - 'multipleBricks': Emitted when multiple bricks form at once
 * - 'trendChange': Emitted when trend direction changes
 * - 'error': Emitted on calculation errors
 */
class RenkoEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.brickSize = options.brickSize || null; // Will be calculated if null
    this.priceSource = options.priceSource || 'close'; // close, hl2, hlc3, ohlc4
    this.atrPeriod = options.atrPeriod || 14;
    this.atrMultiplier = options.atrMultiplier || 0.5;
    this.autoCalculateBrickSize = options.autoCalculateBrickSize !== false;
    
    // Internal state
    this.bricks = [];
    this.currentPrice = null;
    this.lastBrickPrice = null;
    this.consecutiveCount = 0;
    this.currentDirection = null; // 'UP' or 'DOWN'
    this.trendStrength = 0; // -1 to 1 scale
    this.priceHistory = [];
    
    // Performance tracking
    this.totalBricks = 0;
    this.maxConsecutive = 0;
    this.trendChanges = 0;
    
    // Error handling
    this.lastError = null;
    this.errorCount = 0;
  }

  /**
   * Calculate optimal brick size using ATR
   * @param {Array} priceData - Array of OHLCV candles
   * @param {number} atrPeriod - ATR calculation period
   * @param {number} multiplier - ATR multiplier for brick size
   * @returns {number} Optimal brick size
   */
  calculateOptimalBrickSize(priceData, atrPeriod = 14, multiplier = 0.5) {
    try {
      if (!priceData || priceData.length < atrPeriod + 1) {
        throw new Error(`Insufficient data for ATR calculation. Need ${atrPeriod + 1} candles, got ${priceData?.length || 0}`);
      }

      // Calculate True Range for each period
      const trueRanges = [];
      for (let i = 1; i < priceData.length; i++) {
        const current = priceData[i];
        const previous = priceData[i - 1];
        
        if (!current || !previous || 
            typeof current.high !== 'number' || typeof current.low !== 'number' ||
            typeof previous.close !== 'number') {
          throw new Error(`Invalid price data at index ${i}`);
        }
        
        const tr1 = current.high - current.low;
        const tr2 = Math.abs(current.high - previous.close);
        const tr3 = Math.abs(current.low - previous.close);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
      }

      // Calculate ATR (Simple Moving Average of True Ranges)
      if (trueRanges.length < atrPeriod) {
        throw new Error(`Insufficient true ranges for ATR calculation`);
      }

      const recentTR = trueRanges.slice(-atrPeriod);
      const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / atrPeriod;
      
      if (atr <= 0) {
        throw new Error(`Invalid ATR calculated: ${atr}`);
      }

      const brickSize = atr * multiplier;
      
      // Ensure minimum reasonable brick size (prevent micro bricks)
      const minBrickSize = this.getAveragePrice(priceData.slice(-10)) * 0.0001; // 0.01% of price
      const optimalSize = Math.max(brickSize, minBrickSize);
      
      // Round to reasonable precision
      const rounded = this.roundToPrecision(optimalSize, this.detectPricePrecision(priceData));
      
      this.emit('brickSizeCalculated', {
        atr,
        multiplier,
        rawBrickSize: brickSize,
        optimalBrickSize: rounded,
        minBrickSize
      });
      
      return rounded;
      
    } catch (error) {
      this.handleError('calculateOptimalBrickSize', error);
      // Return fallback brick size based on average price
      const avgPrice = this.getAveragePrice(priceData.slice(-10)) || 100;
      return this.roundToPrecision(avgPrice * 0.001, 2); // 0.1% of average price
    }
  }

  /**
   * Get price value based on configured source
   * @param {Object} candle - OHLCV candle data
   * @returns {number} Price value
   */
  getPrice(candle) {
    if (!candle) return null;
    
    switch (this.priceSource) {
      case 'close':
        return candle.close;
      case 'hl2':
        return (candle.high + candle.low) / 2;
      case 'hlc3':
        return (candle.high + candle.low + candle.close) / 3;
      case 'ohlc4':
        return (candle.open + candle.high + candle.low + candle.close) / 4;
      default:
        return candle.close;
    }
  }

  /**
   * Update price and potentially create new bricks
   * @param {Object} tickData - Price tick data (can be candle or tick)
   * @returns {boolean} True if new brick(s) formed
   */
  updatePrice(tickData) {
    try {
      if (!tickData) {
        throw new Error('Tick data is required');
      }

      const newPrice = this.getPrice(tickData);
      if (typeof newPrice !== 'number' || isNaN(newPrice) || newPrice <= 0) {
        throw new Error(`Invalid price: ${newPrice}`);
      }

      this.currentPrice = newPrice;
      this.priceHistory.push({
        price: newPrice,
        timestamp: tickData.timestamp || new Date()
      });

      // Keep price history manageable
      if (this.priceHistory.length > 1000) {
        this.priceHistory = this.priceHistory.slice(-500);
      }

      // Auto-calculate brick size if needed
      if (!this.brickSize && this.autoCalculateBrickSize && this.priceHistory.length >= this.atrPeriod + 1) {
        const priceData = this.priceHistory.map(p => ({
          high: p.price * 1.001, // Approximate OHLC from price
          low: p.price * 0.999,
          close: p.price,
          open: p.price
        }));
        this.brickSize = this.calculateOptimalBrickSize(priceData, this.atrPeriod, this.atrMultiplier);
      }

      if (!this.brickSize) {
        return false; // Can't form bricks without brick size
      }

      // Initialize first brick if needed
      if (this.bricks.length === 0) {
        this.initializeFirstBrick(newPrice, tickData.timestamp);
        return true;
      }

      // Check for new brick formation
      return this.checkBrickFormation(newPrice, tickData.timestamp);

    } catch (error) {
      this.handleError('updatePrice', error);
      return false;
    }
  }

  /**
   * Initialize the first brick
   * @param {number} price - Initial price
   * @param {Date} timestamp - Timestamp
   */
  initializeFirstBrick(price, timestamp = new Date()) {
    const firstBrick = {
      id: this.generateBrickId(),
      open: price,
      close: price,
      direction: 'INIT',
      timestamp: timestamp,
      brickNumber: 1,
      consecutiveCount: 1
    };

    this.bricks.push(firstBrick);
    this.lastBrickPrice = price;
    this.totalBricks = 1;
    this.consecutiveCount = 1;
    this.currentDirection = 'INIT';

    this.emit('newBrick', firstBrick);
  }

  /**
   * Check if new brick(s) should be formed
   * @param {number} newPrice - Current price
   * @param {Date} timestamp - Timestamp
   * @returns {boolean} True if brick(s) formed
   */
  checkBrickFormation(newPrice, timestamp = new Date()) {
    const lastBrick = this.bricks[this.bricks.length - 1];
    const priceDiff = newPrice - this.lastBrickPrice;
    const absDiff = Math.abs(priceDiff);

    if (absDiff < this.brickSize) {
      return false; // Not enough movement for new brick
    }

    // Calculate how many bricks should be formed
    const bricksToForm = Math.floor(absDiff / this.brickSize);
    const direction = priceDiff > 0 ? 'UP' : 'DOWN';
    
    if (bricksToForm === 0) {
      return false;
    }

    // Form multiple bricks if needed
    const newBricks = [];
    let currentBrickPrice = this.lastBrickPrice;

    for (let i = 0; i < bricksToForm; i++) {
      const brickMove = direction === 'UP' ? this.brickSize : -this.brickSize;
      const brickOpen = currentBrickPrice;
      const brickClose = currentBrickPrice + brickMove;

      const newBrick = {
        id: this.generateBrickId(),
        open: brickOpen,
        close: brickClose,
        direction: direction,
        timestamp: timestamp,
        brickNumber: this.totalBricks + i + 1,
        consecutiveCount: this.calculateNewConsecutiveCount(direction),
        priceMove: Math.abs(brickMove),
        brickSize: this.brickSize
      };

      newBricks.push(newBrick);
      currentBrickPrice = brickClose;
    }

    // Add bricks to collection
    this.bricks.push(...newBricks);
    this.lastBrickPrice = currentBrickPrice;
    this.totalBricks += bricksToForm;

    // Update trend tracking
    this.updateTrendTracking(direction, bricksToForm);

    // Emit events
    if (newBricks.length === 1) {
      this.emit('newBrick', newBricks[0]);
    } else {
      this.emit('multipleBricks', newBricks);
      newBricks.forEach(brick => this.emit('newBrick', brick));
    }

    // Check for trend change
    if (this.hasTrendChanged(direction)) {
      this.emit('trendChange', {
        oldDirection: this.currentDirection,
        newDirection: direction,
        consecutiveCount: this.consecutiveCount
      });
      this.trendChanges++;
    }

    this.currentDirection = direction;

    // Keep brick history manageable
    if (this.bricks.length > 1000) {
      this.bricks = this.bricks.slice(-500);
    }

    return true;
  }

  /**
   * Calculate consecutive count for new direction
   * @param {string} newDirection - 'UP' or 'DOWN'
   * @returns {number} New consecutive count
   */
  calculateNewConsecutiveCount(newDirection) {
    if (this.currentDirection === newDirection) {
      this.consecutiveCount++;
    } else {
      this.consecutiveCount = 1;
    }
    
    // Track maximum consecutive
    this.maxConsecutive = Math.max(this.maxConsecutive, this.consecutiveCount);
    
    return this.consecutiveCount;
  }

  /**
   * Update trend tracking metrics
   * @param {string} direction - Brick direction
   * @param {number} brickCount - Number of bricks formed
   */
  updateTrendTracking(direction, brickCount) {
    // Update trend strength (-1 to 1 scale)
    const strengthIncrement = brickCount * (direction === 'UP' ? 0.1 : -0.1);
    this.trendStrength = Math.max(-1, Math.min(1, this.trendStrength + strengthIncrement));
    
    // Decay trend strength over time to prevent extreme values
    this.trendStrength *= 0.98;
  }

  /**
   * Check if trend direction has changed
   * @param {string} newDirection - New brick direction
   * @returns {boolean} True if trend changed
   */
  hasTrendChanged(newDirection) {
    return this.currentDirection && 
           this.currentDirection !== 'INIT' && 
           this.currentDirection !== newDirection;
  }

  /**
   * Get consecutive bricks information
   * @returns {Object} {count, direction}
   */
  getConsecutiveBricks() {
    return {
      count: this.consecutiveCount,
      direction: this.currentDirection,
      maxConsecutive: this.maxConsecutive
    };
  }

  /**
   * Get Renko trend strength
   * @returns {number} Trend strength from -1 (strong down) to 1 (strong up)
   */
  getRenkoTrendStrength() {
    return this.trendStrength;
  }

  /**
   * Get recent bricks
   * @param {number} count - Number of recent bricks to return
   * @returns {Array} Recent bricks
   */
  getRecentBricks(count = 10) {
    return this.bricks.slice(-count);
  }

  /**
   * Get brick data formatted for technical analysis
   * @param {number} count - Number of bricks to return
   * @returns {Array} Brick data with OHLC format
   */
  getBrickOHLC(count = 50) {
    const recentBricks = this.bricks.slice(-count);
    return recentBricks.map(brick => ({
      timestamp: brick.timestamp,
      open: brick.open,
      high: Math.max(brick.open, brick.close),
      low: Math.min(brick.open, brick.close),
      close: brick.close,
      volume: brick.volume || 1000 // Default volume if not available
    }));
  }

  /**
   * Calculate SuperTrend for Renko bricks
   * @param {number} period - ATR period
   * @param {number} multiplier - SuperTrend multiplier
   * @returns {Object} SuperTrend data
   */
  calculateRenkoSuperTrend(period = 10, multiplier = 3.0) {
    const brickData = this.getBrickOHLC(Math.max(period + 10, 30));
    
    if (brickData.length < period) {
      return { trend: null, value: null, direction: null };
    }

    // Calculate ATR for SuperTrend
    const atrValues = [];
    for (let i = 1; i < brickData.length; i++) {
      const current = brickData[i];
      const previous = brickData[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      atrValues.push(Math.max(tr1, tr2, tr3));
    }

    if (atrValues.length < period) {
      return { trend: null, value: null, direction: null };
    }

    // Calculate current ATR
    const currentATR = atrValues.slice(-period).reduce((sum, val) => sum + val, 0) / period;
    const currentBrick = brickData[brickData.length - 1];
    const hl2 = (currentBrick.high + currentBrick.low) / 2;

    // SuperTrend calculation with proper trend persistence
    const basicUpperBand = hl2 + (multiplier * currentATR);
    const basicLowerBand = hl2 - (multiplier * currentATR);

    // Get previous SuperTrend data for trend persistence
    const prevSuperTrend = this.lastSuperTrend || { direction: null, value: null };
    
    let finalUpperBand = basicUpperBand;
    let finalLowerBand = basicLowerBand;
    
    // Apply trend persistence rules
    if (brickData.length > 1) {
      const prevClose = brickData[brickData.length - 2].close;
      
      // Upper band: only move down if price is above previous upper band
      if (basicUpperBand < prevSuperTrend.upperBand && prevClose > prevSuperTrend.upperBand) {
        finalUpperBand = prevSuperTrend.upperBand;
      }
      
      // Lower band: only move up if price is below previous lower band  
      if (basicLowerBand > prevSuperTrend.lowerBand && prevClose < prevSuperTrend.lowerBand) {
        finalLowerBand = prevSuperTrend.lowerBand;
      }
    }

    // Determine trend direction with proper logic
    let superTrendValue, direction;
    const currentClose = currentBrick.close;
    const prevDirection = prevSuperTrend.direction;

    // SuperTrend direction logic
    if (prevDirection === 'UP' && currentClose <= finalLowerBand) {
      direction = 'DOWN';
      superTrendValue = finalUpperBand;
    } else if (prevDirection === 'DOWN' && currentClose >= finalUpperBand) {
      direction = 'UP';
      superTrendValue = finalLowerBand;
    } else if (prevDirection === 'UP') {
      direction = 'UP';
      superTrendValue = finalLowerBand;
    } else if (prevDirection === 'DOWN') {
      direction = 'DOWN';
      superTrendValue = finalUpperBand;
    } else {
      // Initial determination
      direction = currentClose > hl2 ? 'UP' : 'DOWN';
      superTrendValue = direction === 'UP' ? finalLowerBand : finalUpperBand;
    }

    // Cache current SuperTrend data for next calculation
    this.lastSuperTrend = {
      direction: direction,
      value: superTrendValue,
      upperBand: finalUpperBand,
      lowerBand: finalLowerBand
    };

    return {
      trend: direction,
      value: superTrendValue,
      direction: direction,
      atr: currentATR,
      upperBand: finalUpperBand,
      lowerBand: finalLowerBand,
      currentPrice: currentClose
    };
  }

  /**
   * Calculate MACD for Renko bricks
   * @param {number} fast - Fast EMA period
   * @param {number} slow - Slow EMA period
   * @param {number} signal - Signal line period
   * @returns {Object} MACD data
   */
  calculateRenkoMACD(fast = 12, slow = 26, signal = 9) {
    const brickData = this.getBrickOHLC(Math.max(slow + signal + 10, 50));
    
    if (brickData.length < slow + signal) {
      return { macd: null, signal: null, histogram: null };
    }

    const closes = brickData.map(brick => brick.close);

    // Calculate EMAs
    const fastEMA = this.calculateEMAArray(closes, fast);
    const slowEMA = this.calculateEMAArray(closes, slow);

    if (!fastEMA || !slowEMA || fastEMA.length < signal || slowEMA.length < signal) {
      return { macd: null, signal: null, histogram: null };
    }

    // Calculate MACD line
    const macdLine = [];
    const minLength = Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = 0; i < minLength; i++) {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }

    // Calculate Signal line (EMA of MACD)
    const signalLine = this.calculateEMAArray(macdLine, signal);

    if (!signalLine || signalLine.length === 0) {
      return { macd: null, signal: null, histogram: null };
    }

    // Calculate Histogram
    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const histogram = currentMACD - currentSignal;

    return {
      macd: currentMACD,
      signal: currentSignal,
      histogram: histogram,
      direction: currentMACD > currentSignal ? 'BULLISH' : 'BEARISH',
      crossover: this.detectMACDCrossover(macdLine, signalLine)
    };
  }

  /**
   * Calculate EMA array for given data
   * @param {Array} data - Price data
   * @param {number} period - EMA period
   * @returns {Array} EMA values
   */
  calculateEMAArray(data, period) {
    if (data.length < period) return null;

    const ema = [];
    const multiplier = 2 / (period + 1);

    // First EMA value is SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    ema.push(sum / period);

    // Calculate subsequent EMA values
    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
      ema.push(currentEMA);
    }

    return ema;
  }

  /**
   * Detect MACD crossover
   * @param {Array} macdLine - MACD line values
   * @param {Array} signalLine - Signal line values
   * @returns {string} Crossover type
   */
  detectMACDCrossover(macdLine, signalLine) {
    if (macdLine.length < 2 || signalLine.length < 2) return 'NONE';

    const currentMACD = macdLine[macdLine.length - 1];
    const prevMACD = macdLine[macdLine.length - 2];
    const currentSignal = signalLine[signalLine.length - 1];
    const prevSignal = signalLine[signalLine.length - 2];

    if (prevMACD <= prevSignal && currentMACD > currentSignal) {
      return 'BULLISH_CROSSOVER';
    } else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
      return 'BEARISH_CROSSOVER';
    }

    return 'NONE';
  }

  /**
   * Detect volume surge
   * @param {Array} volumeData - Volume data
   * @param {number} threshold - Surge threshold multiplier
   * @returns {Object} Volume analysis
   */
  detectVolumeSurge(volumeData, threshold = 1.5) {
    if (!volumeData || volumeData.length < 20) {
      return { surge: false, ratio: 1, avgVolume: 0 };
    }

    const recentVolume = volumeData.slice(-20);
    const currentVolume = recentVolume[recentVolume.length - 1];
    const avgVolume = recentVolume.slice(0, -1).reduce((sum, vol) => sum + vol, 0) / (recentVolume.length - 1);

    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    return {
      surge: volumeRatio >= threshold,
      ratio: volumeRatio,
      avgVolume: avgVolume,
      currentVolume: currentVolume,
      threshold: threshold
    };
  }

  /**
   * Get all bricks
   * @returns {Array} All bricks
   */
  getAllBricks() {
    return [...this.bricks];
  }

  /**
   * Get current brick size
   * @returns {number} Current brick size
   */
  getCurrentBrickSize() {
    return this.brickSize;
  }

  /**
   * Get engine statistics
   * @returns {Object} Performance and state statistics
   */
  getStatistics() {
    return {
      totalBricks: this.totalBricks,
      consecutiveCount: this.consecutiveCount,
      currentDirection: this.currentDirection,
      trendStrength: this.trendStrength,
      maxConsecutive: this.maxConsecutive,
      trendChanges: this.trendChanges,
      brickSize: this.brickSize,
      currentPrice: this.currentPrice,
      lastBrickPrice: this.lastBrickPrice,
      errorCount: this.errorCount,
      lastError: this.lastError
    };
  }

  /**
   * Reset engine state
   */
  reset() {
    this.bricks = [];
    this.currentPrice = null;
    this.lastBrickPrice = null;
    this.consecutiveCount = 0;
    this.currentDirection = null;
    this.trendStrength = 0;
    this.totalBricks = 0;
    this.maxConsecutive = 0;
    this.trendChanges = 0;
    this.errorCount = 0;
    this.lastError = null;
    
    this.emit('reset');
  }

  /**
   * Utility: Generate unique brick ID
   * @returns {string} Unique brick identifier
   */
  generateBrickId() {
    return `brick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility: Get average price from data
   * @param {Array} priceData - Array of price data
   * @returns {number} Average price
   */
  getAveragePrice(priceData) {
    if (!priceData || priceData.length === 0) return null;
    
    const sum = priceData.reduce((acc, item) => {
      const price = typeof item === 'number' ? item : 
                   item.price || item.close || item.high || item.low;
      return acc + (price || 0);
    }, 0);
    
    return sum / priceData.length;
  }

  /**
   * Utility: Detect price precision from data
   * @param {Array} priceData - Price data array
   * @returns {number} Number of decimal places
   */
  detectPricePrecision(priceData) {
    if (!priceData || priceData.length === 0) return 2;
    
    let maxDecimals = 0;
    for (const item of priceData.slice(-10)) {
      const price = item.close || item.price || item;
      if (typeof price === 'number') {
        const decimals = (price.toString().split('.')[1] || '').length;
        maxDecimals = Math.max(maxDecimals, decimals);
      }
    }
    
    return Math.min(maxDecimals, 8); // Cap at 8 decimal places
  }

  /**
   * Utility: Round to specific precision
   * @param {number} value - Value to round
   * @param {number} precision - Number of decimal places
   * @returns {number} Rounded value
   */
  roundToPrecision(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Error handling
   * @param {string} method - Method where error occurred
   * @param {Error} error - Error object
   */
  handleError(method, error) {
    this.errorCount++;
    this.lastError = {
      method,
      message: error.message,
      timestamp: new Date(),
      stack: error.stack
    };
    
    this.emit('error', this.lastError);
    
    // Log error (you can replace with your logging system)
    console.error(`RenkoEngine.${method} Error:`, error.message);
  }
}

module.exports = RenkoEngine;