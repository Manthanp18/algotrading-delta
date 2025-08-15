const BaseStrategy = require('./baseStrategy');

class SmartVolumeV5Strategy extends BaseStrategy {
  constructor(positionSize = 0.1) {
    super('Smart Volume V5 Strategy');
    this.positionSize = positionSize;
    this.lastTradeTime = null;
    this.cooldownMinutes = 18;
    this.maxLossPercent = 0.5; // Exit if loss exceeds 0.5%
    this.takeProfitPercent = 0.7; // Take profit at 0.7%
  }

  calculateVolumeMA(data, period) {
    if (data.length < period) return null;
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.volume, 0);
    return sum / period;
  }

  // Check if we should exit based on profit/loss targets
  shouldExitPosition(entryPrice, currentPrice, entrySignal, currentRsi) {
    let pnlPercent = 0;

    if (entrySignal === 'BUY') {
      pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    } else {
      pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
    }

    // Take profit conditions
    if (pnlPercent >= this.takeProfitPercent) {
      return { shouldExit: true, reason: `Take profit: ${pnlPercent.toFixed(2)}%` };
    }

    // Stop loss conditions
    if (pnlPercent <= -this.maxLossPercent) {
      return { shouldExit: true, reason: `Cut loss: ${pnlPercent.toFixed(2)}%` };
    }

    // RSI reversal exit (early exit on RSI extreme)
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
            reason: `Smart exit: ${exitCheck.reason}`,
            signal_type: 'SMART_EXIT'
          };
        } else {
          return {
            action: 'BUY',
            quantity: Math.abs(currentPosition.quantity),
            reason: `Smart exit: ${exitCheck.reason}`,
            signal_type: 'SMART_EXIT'
          };
        }
      }
    }

    // Regular cooldown between new trades (but allow exits anytime)
    if (this.lastTradeTime &&
      (currentCandle.timestamp - this.lastTradeTime) < (this.cooldownMinutes * 60 * 1000)) {
      return null;
    }

    const baseQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));

    // LONG SIGNAL with improved filtering
    if (rsi <= 28 &&
      volumeRatio >= 1.6 &&
      currentPrice > ema21 * 0.995 && // Must be near or above EMA
      currentPosition.quantity <= 0) {

      this.lastTradeTime = currentCandle.timestamp;
      this.lastEntryPrice = currentPrice;

      if (currentPosition.quantity < 0) {
        const closeQuantity = Math.abs(currentPosition.quantity);
        return {
          action: 'BUY',
          quantity: closeQuantity + baseQuantity,
          reason: `V5 long: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'LONG_ENTRY'
        };
      } else {
        return {
          action: 'BUY',
          quantity: baseQuantity,
          reason: `V5 long: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'LONG_ENTRY'
        };
      }
    }

    // SHORT SIGNAL with improved filtering
    else if (rsi >= 72 &&
      volumeRatio >= 1.6 &&
      currentPrice < ema21 * 1.005 && // Must be near or below EMA
      currentPosition.quantity >= 0) {

      this.lastTradeTime = currentCandle.timestamp;
      this.lastEntryPrice = currentPrice;

      if (currentPosition.quantity > 0) {
        const closeQuantity = currentPosition.quantity;
        return {
          action: 'SELL',
          quantity: closeQuantity + baseQuantity,
          reason: `V5 short: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'SHORT_ENTRY'
        };
      } else {
        return {
          action: 'SELL',
          quantity: baseQuantity,
          reason: `V5 short: RSI ${rsi.toFixed(1)}, ${volumeRatio.toFixed(1)}x vol, EMA trend`,
          signal_type: 'SHORT_ENTRY'
        };
      }
    }

    return null;
  }
}

module.exports = SmartVolumeV5Strategy;