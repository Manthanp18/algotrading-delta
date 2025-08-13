const BaseStrategy = require('./baseStrategy');

class ScalpingMasterV1Strategy extends BaseStrategy {
  constructor(positionSize = 0.1) {
    super('Scalping Master V1 Strategy');
    this.positionSize = positionSize;
    this.lastTradeTime = null;
    this.cooldownMinutes = 5; // Shorter cooldown for scalping
    this.maxLossPercent = 0.3; // Tighter stop loss for scalping
    this.takeProfitPercent = 0.5; // Quicker take profit for scalping
  }

  calculateVolumeMA(data, period) {
    if (data.length < period) return null;
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.volume, 0);
    return sum / period;
  }

  // Check if we should exit based on profit/loss targets (same as V5 but faster)
  shouldExitPosition(entryPrice, currentPrice, entrySignal, currentRsi) {
    let pnlPercent = 0;

    if (entrySignal === 'BUY') {
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    // Take profit conditions (faster than V5)
    if (pnlPercent >= this.takeProfitPercent) {
      return { shouldExit: true, reason: `Take profit: ${pnlPercent.toFixed(2)}%` };
    }

    // Stop loss conditions (tighter than V5)
    if (pnlPercent <= -this.maxLossPercent) {
      return { shouldExit: true, reason: `Cut loss: ${pnlPercent.toFixed(2)}%` };
    }

    // RSI reversal exit (faster exit than V5)
    if (entrySignal === 'BUY' && currentRsi >= 75) {
      return { shouldExit: true, reason: `RSI extreme exit: ${currentRsi.toFixed(1)}` };
    }

    if (entrySignal === 'SELL' && currentRsi <= 25) {
      return { shouldExit: true, reason: `RSI extreme exit: ${currentRsi.toFixed(1)}` };
    }

    return { shouldExit: false, reason: null };
  }

  generateSignal(currentCandle, historicalData, portfolio) {
    if (historicalData.length < 30) {
      return null;
    }

    const rsi = this.calculateRSI(historicalData, 14);
    const ema21 = this.calculateEMA(historicalData, 21);
    const avgVolume = this.calculateVolumeMA(historicalData, 20);

    if (!rsi || !ema21 || !avgVolume) return null;

    // Debug first few signals
    if (!this.debugCount) this.debugCount = 0;
    if (this.debugCount < 5) {
      console.log(`ScalpingV1 Debug: RSI=${rsi.toFixed(1)}, Volume=${(currentCandle.volume/avgVolume).toFixed(2)}x, Price/EMA=${(currentCandle.close/ema21).toFixed(4)}`);
      this.debugCount++;
    }

    const volumeRatio = currentCandle.volume / avgVolume;
    const currentPosition = portfolio.getPosition('BTCUSD');
    const availableCash = portfolio.cash;
    const currentPrice = currentCandle.close;

    // Check if we should exit current position first
    if (Math.abs(currentPosition.quantity) > 0 && this.lastTradeTime) {
      const entryPrice = this.lastEntryPrice || currentPrice;
      const entrySignal = currentPosition.quantity > 0 ? 'BUY' : 'SELL';

      const exitCheck = this.shouldExitPosition(entryPrice, currentPrice, entrySignal, rsi);

      if (exitCheck.shouldExit) {
        // Force exit current position
        if (currentPosition.quantity > 0) {
          return {
            action: 'SELL',
            quantity: currentPosition.quantity,
            reason: `Scalp exit: ${exitCheck.reason}`,
            signal_type: 'SCALP_EXIT'
          };
        } else {
          return {
            action: 'BUY',
            quantity: Math.abs(currentPosition.quantity),
            reason: `Scalp exit: ${exitCheck.reason}`,
            signal_type: 'SCALP_EXIT'
          };
        }
      }
    }

    // Regular cooldown between new trades (shorter than V5)
    if (this.lastTradeTime &&
      (currentCandle.timestamp - this.lastTradeTime) < (this.cooldownMinutes * 60 * 1000)) {
      return null;
    }

    const baseQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));

    // LONG SIGNAL - scalping version (adjusted for current market RSI range)
    if (rsi <= 72 &&  // Adjusted for market data showing RSI 68-72 range
      volumeRatio >= 0.5 &&  // Much lower than V5's 1.6
      currentPrice > ema21 * 0.95 && // More lenient EMA condition
      currentPosition.quantity <= 0) {

      // Debug trade signal
      if (this.debugCount < 10) {
        console.log(`LONG Signal triggered: RSI=${rsi.toFixed(1)} (≤72), Vol=${volumeRatio.toFixed(2)} (≥0.5), Price/EMA=${(currentPrice/ema21).toFixed(4)} (>0.95), Position=${currentPosition.quantity}`);
      }

      this.lastTradeTime = currentCandle.timestamp;
      this.lastEntryPrice = currentPrice;

      if (currentPosition.quantity < 0) {
        const closeQuantity = Math.abs(currentPosition.quantity);
        return {
          action: 'BUY',
          quantity: closeQuantity + baseQuantity,
          reason: `Scalp long: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'LONG_ENTRY'
        };
      } else {
        return {
          action: 'BUY',
          quantity: baseQuantity,
          reason: `Scalp long: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'LONG_ENTRY'
        };
      }
    }

    // SHORT SIGNAL - scalping version (adjusted for current market RSI range)
    else if (rsi >= 68 &&  // Adjusted for market data showing RSI 68-72 range
      volumeRatio >= 0.5 &&  // Much lower than V5's 1.6
      currentPrice < ema21 * 1.05 && // More lenient EMA condition
      currentPosition.quantity >= 0) {

      this.lastTradeTime = currentCandle.timestamp;
      this.lastEntryPrice = currentPrice;

      if (currentPosition.quantity > 0) {
        const closeQuantity = currentPosition.quantity;
        return {
          action: 'SELL',
          quantity: closeQuantity + baseQuantity,
          reason: `Scalp short: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'SHORT_ENTRY'
        };
      } else {
        return {
          action: 'SELL',
          quantity: baseQuantity,
          reason: `Scalp short: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'SHORT_ENTRY'
        };
      }
    }

    return null;
  }
}

module.exports = ScalpingMasterV1Strategy;