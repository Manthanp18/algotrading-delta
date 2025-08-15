const BaseStrategy = require('./baseStrategy');

class ShortLongStrategy extends BaseStrategy {
  constructor(rsiPeriod = 14, overbought = 70, oversold = 30, positionSize = 0.1) {
    super('Short-Long RSI Strategy');
    this.rsiPeriod = rsiPeriod;
    this.overbought = overbought;
    this.oversold = oversold;
    this.positionSize = positionSize;
  }

  generateSignal(currentCandle, historicalData, portfolio) {
    if (historicalData.length < this.rsiPeriod + 1) {
      return null;
    }

    const rsi = this.calculateRSI(historicalData, this.rsiPeriod);
    
    if (!rsi) {
      return null;
    }

    const currentPosition = portfolio.getPosition('BTCUSD');
    const availableCash = portfolio.cash;
    const currentPrice = currentCandle.close;
    
    // LONG ENTRY: Buy when oversold
    if (rsi <= this.oversold && currentPosition.quantity <= 0) {
      if (currentPosition.quantity < 0) {
        // Close short position first, then go long
        const closeQuantity = Math.abs(currentPosition.quantity);
        const longQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));
        return {
          action: 'BUY',
          quantity: closeQuantity + longQuantity,
          reason: `Close short + Go long - RSI oversold (${rsi.toFixed(2)})`,
          rsi: rsi,
          signal_type: 'LONG_ENTRY'
        };
      } else {
        // Open long position
        const quantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));
        return {
          action: 'BUY',
          quantity: quantity,
          reason: `Go long - RSI oversold (${rsi.toFixed(2)})`,
          rsi: rsi,
          signal_type: 'LONG_ENTRY'
        };
      }
    }
    
    // SHORT ENTRY: Sell when overbought
    else if (rsi >= this.overbought && currentPosition.quantity >= 0) {
      if (currentPosition.quantity > 0) {
        // Close long position first, then go short
        const closeQuantity = currentPosition.quantity;
        const shortQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));
        return {
          action: 'SELL',
          quantity: closeQuantity + shortQuantity,
          reason: `Close long + Go short - RSI overbought (${rsi.toFixed(2)})`,
          rsi: rsi,
          signal_type: 'SHORT_ENTRY'
        };
      } else {
        // Open short position
        const quantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));
        return {
          action: 'SELL',
          quantity: quantity,
          reason: `Go short - RSI overbought (${rsi.toFixed(2)})`,
          rsi: rsi,
          signal_type: 'SHORT_ENTRY'
        };
      }
    }

    return null;
  }
}

module.exports = ShortLongStrategy;