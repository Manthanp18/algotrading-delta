/**
 * Technical Indicator Calculators
 * EMA, SuperTrend, ATR calculations for trading strategy
 */

class IndicatorCalculators {
  
  /**
   * Calculate Exponential Moving Average (EMA)
   * @param {Array} prices - Array of price values
   * @param {number} period - EMA period (default: 21)
   * @returns {Array} Array of EMA values
   */
  static calculateEMA(prices, period = 21) {
    if (!prices || prices.length === 0) return [];
    if (prices.length < period) return new Array(prices.length).fill(null);

    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Calculate initial SMA for first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
      ema.push(null); // Fill with null until we have enough data
    }
    
    // First EMA value is the SMA
    ema[period - 1] = sum / period;
    
    // Calculate subsequent EMA values
    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
      ema.push(currentEMA);
    }
    
    return ema;
  }

  /**
   * Calculate Average True Range (ATR) using RMA (Running Moving Average) 
   * This matches TradingView's default ATR calculation method
   * @param {Array} ohlcData - Array of OHLC objects
   * @param {number} period - ATR period (default: 14)
   * @returns {Array} Array of ATR values
   */
  static calculateATR(ohlcData, period = 14) {
    if (!ohlcData || ohlcData.length === 0) return [];
    if (ohlcData.length < period) return new Array(ohlcData.length).fill(null);

    const trueRanges = [];
    const atr = [];

    // Calculate True Range for each period
    for (let i = 0; i < ohlcData.length; i++) {
      const current = ohlcData[i];
      let tr;

      if (i === 0) {
        // First candle: TR = High - Low
        tr = current.high - current.low;
      } else {
        const previous = ohlcData[i - 1];
        // TR = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
        const hl = current.high - current.low;
        const hc = Math.abs(current.high - previous.close);
        const lc = Math.abs(current.low - previous.close);
        tr = Math.max(hl, hc, lc);
      }
      
      trueRanges.push(tr);
    }

    // Calculate ATR using RMA (Running Moving Average) method - matches TradingView
    for (let i = 0; i < ohlcData.length; i++) {
      if (i < period - 1) {
        atr.push(null);
      } else if (i === period - 1) {
        // First ATR is SMA of True Ranges (same as before)
        const sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
        atr.push(sum / period);
      } else {
        // RMA formula: previous_atr * (period - 1) / period + current_tr / period
        // This is equivalent to TradingView's ta.rma() function
        const currentATR = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
        atr.push(currentATR);
      }
    }

    return atr;
  }

  /**
   * Calculate SuperTrend indicator
   * @param {Array} ohlcData - Array of OHLC objects
   * @param {number} atrPeriod - ATR period (default: 10)
   * @param {number} multiplier - ATR multiplier (default: 3.0)
   * @returns {Object} Object containing supertrend values and trend direction
   */
  static calculateSuperTrend(ohlcData, atrPeriod = 10, multiplier = 3.0) {
    if (!ohlcData || ohlcData.length === 0) {
      return { supertrend: [], direction: [] };
    }

    const atr = this.calculateATR(ohlcData, atrPeriod);
    const supertrend = [];
    const direction = []; // 1 for uptrend, -1 for downtrend
    const upperBand = [];
    const lowerBand = [];

    for (let i = 0; i < ohlcData.length; i++) {
      const current = ohlcData[i];
      const hl2 = (current.high + current.low) / 2; // Median price

      if (atr[i] === null) {
        supertrend.push(null);
        direction.push(null);
        upperBand.push(null);
        lowerBand.push(null);
        continue;
      }

      // Calculate basic upper and lower bands
      const basicUpperBand = hl2 + (multiplier * atr[i]);
      const basicLowerBand = hl2 - (multiplier * atr[i]);

      // Calculate final upper and lower bands
      let finalUpperBand, finalLowerBand;

      if (i === 0 || upperBand[i - 1] === null) {
        finalUpperBand = basicUpperBand;
        finalLowerBand = basicLowerBand;
      } else {
        finalUpperBand = (basicUpperBand < upperBand[i - 1] || ohlcData[i - 1].close > upperBand[i - 1]) 
          ? basicUpperBand 
          : upperBand[i - 1];

        finalLowerBand = (basicLowerBand > lowerBand[i - 1] || ohlcData[i - 1].close < lowerBand[i - 1]) 
          ? basicLowerBand 
          : lowerBand[i - 1];
      }

      upperBand.push(finalUpperBand);
      lowerBand.push(finalLowerBand);

      // Determine SuperTrend value and direction
      let currentSupertrend, currentDirection;

      if (i === 0 || direction[i - 1] === null) {
        // Initial direction based on close vs bands
        if (current.close <= finalLowerBand) {
          currentSupertrend = finalUpperBand;
          currentDirection = -1; // Downtrend
        } else {
          currentSupertrend = finalLowerBand;
          currentDirection = 1; // Uptrend
        }
      } else {
        const prevDirection = direction[i - 1];

        if (prevDirection === 1) {
          // Previous trend was up
          if (current.close > finalLowerBand) {
            currentSupertrend = finalLowerBand;
            currentDirection = 1;
          } else {
            currentSupertrend = finalUpperBand;
            currentDirection = -1;
          }
        } else {
          // Previous trend was down
          if (current.close < finalUpperBand) {
            currentSupertrend = finalUpperBand;
            currentDirection = -1;
          } else {
            currentSupertrend = finalLowerBand;
            currentDirection = 1;
          }
        }
      }

      supertrend.push(currentSupertrend);
      direction.push(currentDirection);
    }

    return {
      supertrend,
      direction,
      upperBand,
      lowerBand,
      atr
    };
  }

  /**
   * Calculate multiple SuperTrend indicators with different multipliers
   * @param {Array} ohlcData - Array of OHLC objects  
   * @param {number} atrPeriod - ATR period
   * @param {Array} multipliers - Array of multiplier values
   * @returns {Object} Object containing all SuperTrend calculations
   */
  static calculateMultipleSuperTrend(ohlcData, atrPeriod = 1, multipliers = [2.1, 3.1, 4.1]) {
    const results = {};
    
    for (const multiplier of multipliers) {
      const key = `supertrend_${multiplier.toString().replace('.', '_')}`;
      results[key] = this.calculateSuperTrend(ohlcData, atrPeriod, multiplier);
    }

    return results;
  }

  /**
   * Calculate Simple Moving Average (SMA)
   * @param {Array} prices - Array of price values
   * @param {number} period - SMA period
   * @returns {Array} Array of SMA values
   */
  static calculateSMA(prices, period) {
    if (!prices || prices.length === 0) return [];
    if (prices.length < period) return new Array(prices.length).fill(null);

    const sma = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    
    return sma;
  }
}

export default IndicatorCalculators;