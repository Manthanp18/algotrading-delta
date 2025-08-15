class Portfolio {
  constructor(initialCapital = 100000) {
    this.initialCapital = initialCapital;
    this.cash = initialCapital;
    this.positions = new Map();
    this.trades = [];
    this.equity = initialCapital;
  }

  getCurrentValue(currentPrices) {
    let totalValue = this.cash;
    
    for (const [symbol, position] of this.positions) {
      const currentPrice = currentPrices[symbol] || position.avgPrice;
      totalValue += position.quantity * currentPrice;
    }
    
    this.equity = totalValue;
    return totalValue;
  }

  canBuy(symbol, quantity, price) {
    const totalCost = quantity * price;
    return this.cash >= totalCost;
  }

  buy(symbol, quantity, price, timestamp) {
    const totalCost = quantity * price;
    
    if (!this.canBuy(symbol, quantity, price)) {
      throw new Error('Insufficient funds');
    }

    this.cash -= totalCost;
    
    if (this.positions.has(symbol)) {
      const existing = this.positions.get(symbol);
      const newQuantity = existing.quantity + quantity;
      const newAvgPrice = ((existing.avgPrice * existing.quantity) + (price * quantity)) / newQuantity;
      
      this.positions.set(symbol, {
        quantity: newQuantity,
        avgPrice: newAvgPrice
      });
    } else {
      this.positions.set(symbol, {
        quantity: quantity,
        avgPrice: price
      });
    }

    this.trades.push({
      type: 'BUY',
      symbol,
      quantity,
      price,
      timestamp,
      cash: this.cash
    });
  }

  sell(symbol, quantity, price, timestamp) {
    if (!this.positions.has(symbol)) {
      throw new Error(`No position in ${symbol}`);
    }

    const position = this.positions.get(symbol);
    if (position.quantity < quantity) {
      throw new Error(`Insufficient quantity to sell`);
    }

    this.cash += quantity * price;
    
    if (position.quantity === quantity) {
      this.positions.delete(symbol);
    } else {
      this.positions.set(symbol, {
        ...position,
        quantity: position.quantity - quantity
      });
    }

    this.trades.push({
      type: 'SELL',
      symbol,
      quantity,
      price,
      timestamp,
      cash: this.cash
    });
  }

  getPosition(symbol) {
    return this.positions.get(symbol) || { quantity: 0, avgPrice: 0 };
  }

  canSell(symbol, quantity, price) {
    return true; // Allow short selling in crypto
  }

  sellShort(symbol, quantity, price, timestamp) {
    const totalValue = quantity * price;
    this.cash += totalValue;
    
    if (this.positions.has(symbol)) {
      const existing = this.positions.get(symbol);
      const newQuantity = existing.quantity - quantity; // Negative for short
      const newAvgPrice = existing.quantity === 0 ? price : 
        ((existing.avgPrice * existing.quantity) - (price * quantity)) / newQuantity;
      
      this.positions.set(symbol, {
        quantity: newQuantity,
        avgPrice: Math.abs(newAvgPrice)
      });
    } else {
      this.positions.set(symbol, {
        quantity: -quantity, // Negative quantity for short position
        avgPrice: price
      });
    }

    this.trades.push({
      type: 'SELL_SHORT',
      symbol,
      quantity,
      price,
      timestamp,
      cash: this.cash
    });
  }

  getTotalReturn() {
    return ((this.equity - this.initialCapital) / this.initialCapital) * 100;
  }
}

class BacktestEngine {
  constructor(initialCapital = 100000) {
    this.portfolio = new Portfolio(initialCapital);
    this.candleData = [];
    this.currentIndex = 0;
    this.results = {
      completedTrades: [],
      metrics: {}
    };
    this.openPositions = new Map();
  }

  loadData(candles) {
    this.candleData = candles.sort((a, b) => a.timestamp - b.timestamp);
    this.currentIndex = 0;
  }

  getCurrentCandle() {
    return this.candleData[this.currentIndex];
  }

  getPreviousCandles(count = 50) {
    const start = Math.max(0, this.currentIndex - count + 1);
    return this.candleData.slice(start, this.currentIndex + 1);
  }

  hasMoreData() {
    return this.currentIndex < this.candleData.length - 1;
  }

  nextCandle() {
    if (this.hasMoreData()) {
      this.currentIndex++;
      if (this.currentIndex < this.candleData.length) {
        return this.getCurrentCandle();
      }
    }
    return null;
  }

  executeSignal(signal, symbol) {
    const candle = this.getCurrentCandle();
    if (!candle || !candle.close) return false;

    this.symbol = symbol;
    const price = candle.close;

    try {
      if (signal.action === 'BUY' && signal.quantity > 0) {
        // Check if we need to close any short positions first
        let shortPositions = 0;
        for (const [, pos] of this.openPositions) {
          if (pos.symbol === symbol && pos.type === 'SELL_SHORT') {
            shortPositions += pos.quantity;
          }
        }
        
        if (shortPositions > 0) {
          // Close short position first
          const closeQuantity = Math.min(shortPositions, signal.quantity);
          this.portfolio.buy(symbol, closeQuantity, price, candle.timestamp);
          this.closeShortPositions(symbol, closeQuantity, price, candle.timestamp, signal.reason);
          
          
          // If there's remaining quantity for long position
          if (signal.signal_type === 'LONG_ENTRY' && signal.quantity > closeQuantity) {
            const longQuantity = signal.quantity - closeQuantity;
            if (this.portfolio.canBuy(symbol, longQuantity, price)) {
              this.portfolio.buy(symbol, longQuantity, price, candle.timestamp);
              
              const tradeId = `${symbol}_${Date.now()}`;
              const trade = {
                id: tradeId,
                symbol: symbol,
                type: 'BUY',
                quantity: longQuantity,
                entryPrice: price,
                entryTime: candle.timestamp,
                reason: signal.reason || 'No reason provided'
              };
              
              this.openPositions.set(tradeId, trade);
            }
          }
          
        } else if (signal.signal_type === 'LONG_ENTRY' && this.portfolio.canBuy(symbol, signal.quantity, price)) {
          // Open long position
          this.portfolio.buy(symbol, signal.quantity, price, candle.timestamp);
          
          const tradeId = `${symbol}_${Date.now()}`;
          const trade = {
            id: tradeId,
            symbol: symbol,
            type: 'BUY',
            quantity: signal.quantity,
            entryPrice: price,
            entryTime: candle.timestamp,
            reason: signal.reason || 'No reason provided'
          };
          
          this.openPositions.set(tradeId, trade);
        }
      } else if (signal.action === 'SELL' && signal.quantity > 0) {
        const position = this.portfolio.getPosition(symbol);
        
        // Check if we need to close any long positions first
        let longPositions = 0;
        for (const [, pos] of this.openPositions) {
          if (pos.symbol === symbol && pos.type !== 'SELL_SHORT') {
            longPositions += pos.quantity;
          }
        }
        
        if (longPositions > 0) {
          // Close long position
          const closeQuantity = Math.min(longPositions, signal.quantity);
          this.portfolio.sell(symbol, closeQuantity, price, candle.timestamp);
          this.closePositions(symbol, closeQuantity, price, candle.timestamp, signal.reason);
          
          // If there's remaining quantity for short position
          if (signal.signal_type === 'SHORT_ENTRY' && signal.quantity > closeQuantity) {
            const shortQuantity = signal.quantity - closeQuantity;
            this.portfolio.sellShort(symbol, shortQuantity, price, candle.timestamp);
            
            const tradeId = `${symbol}_${Date.now()}`;
            const trade = {
              id: tradeId,
              symbol: symbol,
              type: 'SELL_SHORT',
              quantity: shortQuantity,
              entryPrice: price,
              entryTime: candle.timestamp,
              entrySignal: 'SELL',
              reason: signal.reason || 'No reason provided'
            };
            
            this.openPositions.set(tradeId, trade);
          }
          
        } else if (signal.signal_type === 'SHORT_ENTRY') {
          // Open short position
          this.portfolio.sellShort(symbol, signal.quantity, price, candle.timestamp);
          
          const tradeId = `${symbol}_${Date.now()}`;
          const trade = {
            id: tradeId,
            symbol: symbol,
            type: 'SELL_SHORT',
            quantity: signal.quantity,
            entryPrice: price,
            entryTime: candle.timestamp,
            entrySignal: 'SELL',
            reason: signal.reason || 'No reason provided'
          };
          
          this.openPositions.set(tradeId, trade);
        }
        
        return true;
      }
    } catch (error) {
      console.error(`Trade execution failed: ${error.message}`);
    }
    
    return false;
  }

  closePositions(symbol, sellQuantity, exitPrice, exitTime, reason) {
    const positionsToClose = [];
    let remainingQuantity = sellQuantity;

    for (const [tradeId, position] of this.openPositions) {
      if (position.symbol === symbol && position.type !== 'SELL_SHORT' && remainingQuantity > 0) {
        const quantityToClose = Math.min(position.quantity, remainingQuantity);
        const pnl = (exitPrice - position.entryPrice) * quantityToClose;
        const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

        const completedTrade = {
          id: tradeId,
          symbol: symbol,
          entrySignal: 'BUY',
          exitSignal: 'SELL',
          entryTime: position.entryTime,
          exitTime: exitTime,
          entryPrice: Math.round(position.entryPrice * 100) / 100,
          exitPrice: Math.round(exitPrice * 100) / 100,
          quantity: quantityToClose,
          pnl: Math.round(pnl * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 100) / 100,
          holdingPeriod: Math.floor((exitTime - position.entryTime) / (1000 * 60)),
          entryReason: position.reason,
          exitReason: reason || 'No reason provided'
        };

        this.results.completedTrades.push(completedTrade);
        
        if (quantityToClose === position.quantity) {
          positionsToClose.push(tradeId);
        } else {
          position.quantity -= quantityToClose;
        }
        
        remainingQuantity -= quantityToClose;
      }
    }

    positionsToClose.forEach(tradeId => this.openPositions.delete(tradeId));
  }

  closeShortPositions(symbol, buyQuantity, exitPrice, exitTime, reason) {
    const positionsToClose = [];
    let remainingQuantity = buyQuantity;

    for (const [tradeId, position] of this.openPositions) {
      if (position.symbol === symbol && position.type === 'SELL_SHORT' && remainingQuantity > 0) {
        const quantityToClose = Math.min(position.quantity, remainingQuantity);
        const pnl = (position.entryPrice - exitPrice) * quantityToClose; // Reversed for short
        const pnlPercent = ((position.entryPrice - exitPrice) / position.entryPrice) * 100;

        const completedTrade = {
          id: tradeId,
          symbol: symbol,
          entrySignal: 'SELL',
          exitSignal: 'BUY',
          entryTime: position.entryTime,
          exitTime: exitTime,
          entryPrice: Math.round(position.entryPrice * 100) / 100,
          exitPrice: Math.round(exitPrice * 100) / 100,
          quantity: quantityToClose,
          pnl: Math.round(pnl * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 100) / 100,
          holdingPeriod: Math.floor((exitTime - position.entryTime) / (1000 * 60)),
          entryReason: position.reason,
          exitReason: reason || 'No reason provided'
        };

        this.results.completedTrades.push(completedTrade);
        
        if (quantityToClose === position.quantity) {
          positionsToClose.push(tradeId);
        } else {
          position.quantity -= quantityToClose;
        }
        
        remainingQuantity -= quantityToClose;
      }
    }

    positionsToClose.forEach(tradeId => this.openPositions.delete(tradeId));
  }

  run(strategy, symbol) {
    this.symbol = symbol;
    this.currentIndex = 0;
    let processedCandles = 0;
    let signalsGenerated = 0;
    
    console.log(`🔄 Processing ${this.candleData.length} candles...`);
    
    while (this.hasMoreData()) {
      const candle = this.getCurrentCandle();
      const historicalData = this.getPreviousCandles();
      
      // Add debugging
      if (!candle || !candle.close) {
        console.log(`⚠️  Invalid candle at index ${this.currentIndex}:`, candle);
        this.nextCandle();
        continue;
      }
      
      processedCandles++;
      
      const signal = strategy.generateSignal(candle, historicalData, this.portfolio);
      
      if (signal && (signal.action === 'BUY' || signal.action === 'SELL')) {
        signalsGenerated++;
        this.executeSignal(signal, symbol);
      }
      
      this.nextCandle();
    }

    console.log(`✅ Processed ${processedCandles} candles, executed ${this.results.completedTrades.length} completed trades`);

    this.calculateMetrics();
    return this.results;
  }

  calculateMetrics() {
    const completedTrades = this.results.completedTrades;
    const finalEquity = this.portfolio.equity;
    const totalReturn = ((finalEquity - this.portfolio.initialCapital) / this.portfolio.initialCapital) * 100;

    let totalPnl = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    for (const trade of completedTrades) {
      totalPnl += trade.pnl;
      if (trade.pnl > 0) {
        winningTrades++;
      } else if (trade.pnl < 0) {
        losingTrades++;
      }
    }

    this.results.metrics = {
      totalReturn: totalReturn.toFixed(2),
      totalTrades: completedTrades.length,
      winningTrades: winningTrades,
      losingTrades: losingTrades,
      winRate: completedTrades.length > 0 ? ((winningTrades / completedTrades.length) * 100).toFixed(2) : 0,
      totalPnl: totalPnl.toFixed(2),
      finalEquity: finalEquity.toFixed(2),
      initialCapital: this.portfolio.initialCapital
    };
  }
}

module.exports = { BacktestEngine, Portfolio };