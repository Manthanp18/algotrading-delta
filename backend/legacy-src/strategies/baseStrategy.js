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

  calculateEMAArray(data, period) {
    if (data.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    const emaArray = [];
    
    // Initial SMA for the first EMA value
    let ema = data.slice(0, period).reduce((acc, candle) => acc + candle.close, 0) / period;
    emaArray.push(ema);
    
    // Calculate EMA for the rest of the data
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
      emaArray.push(ema);
    }
    
    return emaArray;
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
    if (data.length < slowPeriod + signalPeriod) return null;
    
    // Validate data elements
    for (let i = 0; i < data.length; i++) {
      if (!data[i] || typeof data[i].close === 'undefined') {
        return null;
      }
    }
    
    // Calculate EMA arrays (not just final values)
    const fastEMAArray = this.calculateEMAArray(data, fastPeriod);
    const slowEMAArray = this.calculateEMAArray(data, slowPeriod);
    
    if (!fastEMAArray || !slowEMAArray) return null;
    
    // Calculate MACD line array
    const macdArray = [];
    const minLength = Math.min(fastEMAArray.length, slowEMAArray.length);
    
    for (let i = 0; i < minLength; i++) {
      macdArray.push(fastEMAArray[i] - slowEMAArray[i]);
    }
    
    if (macdArray.length < signalPeriod) return null;
    
    // Convert MACD array to format for EMA calculation
    const macdData = macdArray.map(value => ({ close: value }));
    
    // Calculate proper signal line as EMA of MACD
    const signalEMA = this.calculateEMA(macdData, signalPeriod);
    const macdLine = macdArray[macdArray.length - 1]; // Current MACD value
    const histogram = macdLine - signalEMA;
    
    // Determine direction and crossover
    let direction = 'NEUTRAL';
    let crossover = null;
    
    if (macdLine > 0 && histogram > 0) direction = 'BULLISH';
    else if (macdLine < 0 && histogram < 0) direction = 'BEARISH';
    
    // Check for crossovers (if we have previous values)
    if (macdArray.length > 1) {
      const prevMACD = macdArray[macdArray.length - 2];
      const prevSignal = this.calculateEMA(macdData.slice(0, -1), signalPeriod);
      
      if (prevMACD <= prevSignal && macdLine > signalEMA) {
        crossover = 'BULLISH_CROSSOVER';
      } else if (prevMACD >= prevSignal && macdLine < signalEMA) {
        crossover = 'BEARISH_CROSSOVER';
      }
    }
    
    return { 
      macd: macdLine, 
      signal: signalEMA, 
      histogram: histogram,
      direction: direction,
      crossover: crossover
    };
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