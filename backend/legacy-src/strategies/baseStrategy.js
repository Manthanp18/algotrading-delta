class BaseStrategy {
  constructor(name) {
    this.name = name;
    this.parameters = {};
  }

  generateSignal(currentCandle, historicalData, portfolio) {
    throw new Error('generateSignal method must be implemented by strategy');
  }

  calculateSMA(data, period) {
    if (data.length < period) return null;
    
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
  }

  calculateEMA(data, period) {
    if (data.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((acc, candle) => acc + candle.close, 0) / period;
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  calculateRSI(data, period = 14) {
    if (data.length < period + 1) return null;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateStochastic(data, kPeriod = 14, dPeriod = 3) {
    if (data.length < kPeriod) return null;
    
    // Validate data elements
    for (let i = 0; i < data.length; i++) {
      if (!data[i] || typeof data[i].close === 'undefined' || typeof data[i].high === 'undefined' || typeof data[i].low === 'undefined') {
        return null;
      }
    }
    
    const recentData = data.slice(-kPeriod);
    const currentPrice = data[data.length - 1].close;
    const lowestLow = Math.min(...recentData.map(candle => candle.low));
    const highestHigh = Math.max(...recentData.map(candle => candle.high));
    
    if (highestHigh === lowestLow) return { k: 50, d: 50 };
    
    const k = ((currentPrice - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // Simplified D calculation (just average the K value for now)
    return { k: k, d: k };
  }

  calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (data.length < slowPeriod) return null;
    
    // Validate data elements
    for (let i = 0; i < data.length; i++) {
      if (!data[i] || typeof data[i].close === 'undefined') {
        return null;
      }
    }
    
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);
    
    if (!fastEMA || !slowEMA) return null;
    
    const macdLine = fastEMA - slowEMA;
    
    // Simplified signal line calculation (just use the MACD line for now)
    const signalLine = macdLine;
    const histogram = macdLine - signalLine;
    
    return { macd: macdLine, signal: signalLine, histogram: histogram };
  }

  calculateVolumeMA(data, period) {
    if (data.length < period) return null;
    
    // Validate data elements
    for (let i = Math.max(0, data.length - period); i < data.length; i++) {
      if (!data[i] || typeof data[i].volume === 'undefined') {
        return null;
      }
    }
    
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.volume, 0);
    return sum / period;
  }
}

module.exports = BaseStrategy;