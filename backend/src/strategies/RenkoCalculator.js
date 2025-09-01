/**
 * Renko Brick Calculator
 * Converts OHLC data to Renko bricks based on price movements
 */

class RenkoCalculator {
  constructor(brickSize = 10.0) {
    this.brickSize = brickSize;
    this.renkoBricks = [];
    this.lastBrickClose = null;
    this.direction = 0; // 0: no direction, 1: up, -1: down
  }

  /**
   * Calculate Renko bricks from OHLC data
   * @param {Array} ohlcData - Array of OHLC objects with {open, high, low, close, timestamp}
   * @returns {Array} Array of Renko bricks
   */
  calculateRenko(ohlcData) {
    this.renkoBricks = [];
    this.lastBrickClose = null;
    this.direction = 0;

    if (!ohlcData || ohlcData.length === 0) {
      return [];
    }

    // Sort by timestamp to ensure chronological order
    const sortedData = ohlcData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const candle of sortedData) {
      this.processCandle(candle);
    }

    return this.renkoBricks;
  }

  /**
   * Process a single candle and generate Renko bricks
   * @param {Object} candle - OHLC candle data
   */
  processCandle(candle) {
    const { open, high, low, close, timestamp } = candle;
    
    // Initialize with first candle
    if (this.lastBrickClose === null) {
      this.lastBrickClose = close;
      this.createBrick(timestamp, close, close, Math.max(open, close), Math.min(open, close), 0);
      return;
    }

    // Check high and low prices for potential bricks
    const prices = [high, low, close].sort((a, b) => a - b);
    
    for (const price of [high, low, close]) {
      this.checkForNewBrick(timestamp, price, high, low);
    }
  }

  /**
   * Check if a new brick should be created based on price movement
   * @param {Date} timestamp - Current timestamp
   * @param {number} price - Current price to check
   * @param {number} high - High of current candle
   * @param {number} low - Low of current candle
   */
  checkForNewBrick(timestamp, price, high, low) {
    // Calculate price difference from last brick close
    const priceDiff = price - this.lastBrickClose;
    const absDiff = Math.abs(priceDiff);

    // Check if we need to create new brick(s)
    if (absDiff >= this.brickSize) {
      const numBricks = Math.floor(absDiff / this.brickSize);
      const newDirection = priceDiff > 0 ? 1 : -1;

      // Check for direction change (reversal)
      if (this.direction !== 0 && this.direction !== newDirection) {
        // Need at least 2 brick sizes for reversal
        if (absDiff >= 2 * this.brickSize) {
          this.createReversalBricks(timestamp, price, high, low, newDirection, numBricks);
        }
      } else {
        // Continue in same direction or set initial direction
        this.createContinuationBricks(timestamp, price, high, low, newDirection, numBricks);
      }
    }
  }

  /**
   * Create bricks when continuing in the same direction
   */
  createContinuationBricks(timestamp, price, high, low, direction, numBricks) {
    for (let i = 0; i < numBricks; i++) {
      const brickOpen = this.lastBrickClose;
      const brickClose = this.lastBrickClose + (direction * this.brickSize);
      
      const brickHigh = direction > 0 ? brickClose : Math.max(brickOpen, high);
      const brickLow = direction < 0 ? brickClose : Math.min(brickOpen, low);

      this.createBrick(timestamp, brickOpen, brickClose, brickHigh, brickLow, direction);
      this.lastBrickClose = brickClose;
      this.direction = direction;
    }
  }

  /**
   * Create bricks when reversing direction
   */
  createReversalBricks(timestamp, price, high, low, direction, numBricks) {
    // First brick is the reversal brick
    const firstBrickOpen = this.lastBrickClose;
    const firstBrickClose = this.lastBrickClose + (direction * this.brickSize);
    
    const firstBrickHigh = direction > 0 ? firstBrickClose : Math.max(firstBrickOpen, high);
    const firstBrickLow = direction < 0 ? firstBrickClose : Math.min(firstBrickOpen, low);

    this.createBrick(timestamp, firstBrickOpen, firstBrickClose, firstBrickHigh, firstBrickLow, direction);
    this.lastBrickClose = firstBrickClose;
    this.direction = direction;

    // Create remaining bricks
    for (let i = 1; i < numBricks; i++) {
      const brickOpen = this.lastBrickClose;
      const brickClose = this.lastBrickClose + (direction * this.brickSize);
      
      const brickHigh = direction > 0 ? brickClose : Math.max(brickOpen, high);
      const brickLow = direction < 0 ? brickClose : Math.min(brickOpen, low);

      this.createBrick(timestamp, brickOpen, brickClose, brickHigh, brickLow, direction);
      this.lastBrickClose = brickClose;
    }
  }

  /**
   * Create a single Renko brick
   */
  createBrick(timestamp, open, close, high, low, direction) {
    const brick = {
      timestamp: new Date(timestamp),
      open: parseFloat(open.toFixed(8)),
      close: parseFloat(close.toFixed(8)),
      high: parseFloat(high.toFixed(8)),
      low: parseFloat(low.toFixed(8)),
      direction,
      brickSize: this.brickSize
    };

    this.renkoBricks.push(brick);
  }

  /**
   * Add a single price update (for real-time processing)
   */
  addPrice(price, timestamp = new Date()) {
    const initialBricksCount = this.renkoBricks.length;
    
    // Create a temporary candle for processing
    const tempCandle = {
      open: price,
      high: price,
      low: price,
      close: price,
      timestamp
    };

    this.processCandle(tempCandle);
    
    // Return new bricks created
    return this.renkoBricks.slice(initialBricksCount);
  }

  /**
   * Get the latest Renko brick
   */
  getLatestBrick() {
    return this.renkoBricks.length > 0 ? this.renkoBricks[this.renkoBricks.length - 1] : null;
  }

  /**
   * Get brick statistics
   */
  getStatistics() {
    if (this.renkoBricks.length === 0) {
      return {
        totalBricks: 0,
        upBricks: 0,
        downBricks: 0,
        currentDirection: this.direction,
        lastPrice: this.lastBrickClose
      };
    }

    const upBricks = this.renkoBricks.filter(brick => brick.direction === 1).length;
    const downBricks = this.renkoBricks.filter(brick => brick.direction === -1).length;

    return {
      totalBricks: this.renkoBricks.length,
      upBricks,
      downBricks,
      upPercentage: ((upBricks / this.renkoBricks.length) * 100).toFixed(2),
      downPercentage: ((downBricks / this.renkoBricks.length) * 100).toFixed(2),
      currentDirection: this.direction,
      lastPrice: this.lastBrickClose,
      brickSize: this.brickSize
    };
  }

  /**
   * Clear all bricks and reset state
   */
  reset() {
    this.renkoBricks = [];
    this.lastBrickClose = null;
    this.direction = 0;
  }
}

export default RenkoCalculator;