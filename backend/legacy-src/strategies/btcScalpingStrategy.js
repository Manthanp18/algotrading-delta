const BaseStrategy = require('./baseStrategy');

/**
 * BTC Aggressive Scalping Strategy
 * 
 * Optimized for quick 200-400 point scalps on BTC with high-frequency trading.
 * Uses minimal confluence requirements for maximum trade frequency.
 * 
 * Target: 200-400 points per trade
 * Stop Loss: 100-150 points
 * Timeframe: 1-minute candles
 * Trade Frequency: High (multiple trades per hour expected)
 */
class BTCScalpingStrategy extends BaseStrategy {
  constructor(positionSize = 0.05) {
    super('BTC Aggressive Scalping Strategy');
    this.positionSize = positionSize;
    this.lastTradeTime = null;
    this.cooldownMinutes = 0.5; // 30 seconds cooldown between trades
    
    // Aggressive scalping parameters
    this.targetPoints = 250; // 250 points target (middle of 200-400 range)
    this.stopLossPoints = 120; // 120 points stop loss
    this.minVolume = 100; // Very low volume requirement for 1m candles
    this.volumeSpikeThreshold = 1.2; // Low spike threshold
    
    // Very relaxed RSI parameters for more signals
    this.rsiOversold = 50; // Higher oversold for more buy signals
    this.rsiOverbought = 50; // Lower overbought for more sell signals
    this.rsiExtreme = 30; // For extreme exit conditions
    
    // Short-term moving averages for scalping
    this.emaFast = 5;
    this.emaSlow = 12;
    
    // Momentum parameters (very short-term)
    this.momentumCandles = 2; // Only look at last 2 candles
    this.minPriceMove = 5; // Minimum 5 point move to consider momentum (very sensitive)
    
    // Volume confirmation
    this.volumeAvgPeriod = 10; // Short volume average for quick decisions
    
    // Price action parameters
    this.breakoutBuffer = 5; // Small buffer for breakouts
    this.trendConfirmationCandles = 3; // Minimal trend confirmation
  }

  calculateVolumeMA(data, period) {
    if (data.length < period) return null;
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.volume, 0);
    return sum / period;
  }

  // Quick momentum check using price action
  checkMomentum(data, currentIndex, direction) {
    if (currentIndex < this.momentumCandles) return false;
    
    const current = data[currentIndex];
    const previous = data[currentIndex - 1];
    
    if (direction === 'UP') {
      // Check for upward price momentum
      const priceMove = current.close - previous.close;
      const bodyStrength = current.close > current.open; // Green candle
      return priceMove >= this.minPriceMove && bodyStrength;
    } else {
      // Check for downward price momentum
      const priceMove = previous.close - current.close;
      const bodyStrength = current.close < current.open; // Red candle
      return priceMove >= this.minPriceMove && bodyStrength;
    }
  }

  // Simple trend check using EMAs
  checkTrend(data, currentIndex, direction) {
    if (currentIndex < this.emaSlow) return false;
    
    const emaFast = this.calculateEMA(data.slice(0, currentIndex + 1), this.emaFast);
    const emaSlow = this.calculateEMA(data.slice(0, currentIndex + 1), this.emaSlow);
    
    if (!emaFast || !emaSlow) return false;
    
    if (direction === 'UP') {
      return emaFast > emaSlow; // Fast EMA above slow EMA
    } else {
      return emaFast < emaSlow; // Fast EMA below slow EMA
    }
  }

  // Volume confirmation (relaxed)
  checkVolume(data, currentIndex) {
    const currentVolume = data[currentIndex].volume;
    const avgVolume = this.calculateVolumeMA(data, this.volumeAvgPeriod);
    
    if (!avgVolume || currentVolume < this.minVolume) return false;
    
    // Accept any volume above minimum (very relaxed)
    return currentVolume > this.minVolume;
  }

  // Price breakout detection
  checkBreakout(data, currentIndex, direction) {
    if (currentIndex < 3) return false;
    
    const current = data[currentIndex];
    const recent = data.slice(currentIndex - 2, currentIndex); // Last 2 candles
    
    if (direction === 'UP') {
      const recentHigh = Math.max(...recent.map(c => c.high));
      return current.close > (recentHigh + this.breakoutBuffer);
    } else {
      const recentLow = Math.min(...recent.map(c => c.low));
      return current.close < (recentLow - this.breakoutBuffer);
    }
  }

  // Exit position check with tight targets
  shouldExitPosition(entryPrice, currentPrice, entrySignal) {
    let pnlPoints = 0;
    
    if (entrySignal === 'BUY') {
      pnlPoints = currentPrice - entryPrice;
    } else {
      pnlPoints = entryPrice - currentPrice;
    }
    
    // Take profit at target
    if (pnlPoints >= this.targetPoints) {
      return { shouldExit: true, reason: `Target hit: +${pnlPoints.toFixed(0)} points` };
    }
    
    // Stop loss
    if (pnlPoints <= -this.stopLossPoints) {
      return { shouldExit: true, reason: `Stop loss: ${pnlPoints.toFixed(0)} points` };
    }
    
    return { shouldExit: false, reason: null };
  }

  generateSignal(currentCandle, historicalData, portfolio) {
    if (historicalData.length < this.emaSlow) {
      return null;
    }

    const currentIndex = historicalData.length - 1;
    const currentPrice = currentCandle.close;
    const currentPosition = portfolio.getPosition('BTCUSD');
    const availableCash = portfolio.cash;
    
    // Calculate RSI for basic overbought/oversold
    const rsi = this.calculateRSI(historicalData, 14);
    if (!rsi) return null;

    // Debug signals (first few)
    if (!this.debugCount) this.debugCount = 0;
    if (this.debugCount < 10) {
      console.log(`BTC Scalping Debug: RSI=${rsi.toFixed(1)}, Price=${currentPrice.toFixed(2)}, Volume=${currentCandle.volume}`);
      this.debugCount++;
    }

    // Check if we should exit current position first
    if (Math.abs(currentPosition.quantity) > 0 && this.lastEntryPrice) {
      const entrySignal = currentPosition.quantity > 0 ? 'BUY' : 'SELL';
      const exitCheck = this.shouldExitPosition(this.lastEntryPrice, currentPrice, entrySignal);

      if (exitCheck.shouldExit) {
        if (currentPosition.quantity > 0) {
          return {
            action: 'SELL',
            quantity: currentPosition.quantity,
            reason: `Exit: ${exitCheck.reason}`,
            signal_type: 'EXIT'
          };
        } else {
          return {
            action: 'BUY',
            quantity: Math.abs(currentPosition.quantity),
            reason: `Exit: ${exitCheck.reason}`,
            signal_type: 'EXIT'
          };
        }
      }
    }

    // Cooldown check (very short for scalping)
    if (this.lastTradeTime &&
      (currentCandle.timestamp - this.lastTradeTime) < (this.cooldownMinutes * 60 * 1000)) {
      return null;
    }

    const baseQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));

    // LONG SIGNAL - Super aggressive scalping (momentum-based)
    if (this.checkVolume(historicalData, currentIndex) && // Basic volume check
        this.checkMomentum(historicalData, currentIndex, 'UP') && // Upward momentum
        currentPosition.quantity <= 0) { // Not already long

      if (this.debugCount < 15) {
        console.log(`LONG Signal: RSI=${rsi.toFixed(1)}, Momentum=UP, Volume=OK`);
      }

      this.lastTradeTime = currentCandle.timestamp;
      this.lastEntryPrice = currentPrice;

      return {
        action: 'BUY',
        quantity: baseQuantity,
        reason: `Scalp LONG: Momentum up, target +${this.targetPoints}pts`,
        signal_type: 'LONG_ENTRY',
        takeProfitPrice: currentPrice + this.targetPoints,
        stopLossPrice: currentPrice - this.stopLossPoints
      };
    }

    // SHORT SIGNAL - Super aggressive scalping (momentum-based)
    else if (this.checkVolume(historicalData, currentIndex) && // Basic volume check
             this.checkMomentum(historicalData, currentIndex, 'DOWN') && // Downward momentum
             currentPosition.quantity >= 0) { // Not already short

      if (this.debugCount < 15) {
        console.log(`SHORT Signal: RSI=${rsi.toFixed(1)}, Momentum=DOWN, Volume=OK`);
      }

      this.lastTradeTime = currentCandle.timestamp;
      this.lastEntryPrice = currentPrice;

      return {
        action: 'SELL',
        quantity: baseQuantity,
        reason: `Scalp SHORT: Momentum down, target +${this.targetPoints}pts`,
        signal_type: 'SHORT_ENTRY',
        takeProfitPrice: currentPrice - this.targetPoints,
        stopLossPrice: currentPrice + this.stopLossPoints
      };
    }

    return null;
  }
}

module.exports = BTCScalpingStrategy;