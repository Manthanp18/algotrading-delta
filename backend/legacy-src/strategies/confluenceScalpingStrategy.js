const BaseStrategy = require('./baseStrategy');

/**
 * Confluence Scalping Strategy with RANCO
 * 
 * Advanced scalping strategy requiring 4 out of 7 confluence points for entry:
 * 1. RSI - Optimal range and trending in signal direction
 * 2. Volume Quality - Increasing volume above minimum threshold
 * 3. Momentum Strength - Strong candle bodies and directional persistence
 * 4. EMA Alignment - Moving averages aligned with signal direction
 * 5. Breakout Confirmation - Price breaking recent highs/lows
 * 6. Volume Spike - Current volume exceeding average by threshold
 * 7. RANCO - Range contraction indicating coiled spring for breakout
 * 
 * RANCO (Range Contraction) measures volatility compression by comparing
 * recent range averages vs historical averages. When ranges contract below
 * 70% of historical average, it indicates pending explosive moves.
 */
class ConfluenceScalpingStrategy extends BaseStrategy {
  constructor(positionSize = 0.1) {
    super('Confluence Scalping Strategy');
    this.positionSize = positionSize;
    this.lastTradeTime = null;
    this.cooldownMinutes = 1; // Very short cooldown for scalping
    
    // Strategy parameters (optimized for 1-minute data)
    this.targetPoints = 150; // Smaller targets for 1m scalping
    this.stopLossPoints = 100; // Tighter stop loss for 1m
    this.minVolume = 500; // Lower volume for 1m candles
    this.volumeSpikeThreshold = 1.3; // Lower spike threshold for 1m
    this.minConfluenceScore = 4; // Updated for 7 confluence points (4 out of 7)
    
    // RSI parameters
    this.rsiLongMin = 45;
    this.rsiLongMax = 65;
    this.rsiShortMin = 35;
    this.rsiShortMax = 55;
    
    // Moving averages (adjusted for 1m timeframe)
    this.emaFast = 8;
    this.emaMedium = 13; 
    this.emaSlow = 21;
    
    // Lookback periods (adjusted for 1m)
    this.momentumLookback = 15; // Shorter lookback for 1m
    this.volumeAvgPeriod = 15; // Shorter volume average for 1m
    this.momentumCandles = 3; // Fewer candles for momentum on 1m
    
    // Minimum candle body percentage (adjusted for 1m)
    this.minBodyRatio = 0.3; // Even lower for 1m scalping
    this.minMomentumPoints = 10; // Lower momentum for 1m candles
    this.breakoutBuffer = 8; // Smaller buffer for 1m data
    
    // RANCO (Range Contraction) parameters
    this.rancoShortPeriod = 5; // Recent candles for range calculation
    this.rancoLongPeriod = 20; // Historical candles for comparison
    this.rancoContractionThreshold = 0.7; // 70% contraction threshold
  }

  calculateVolumeMA(data, period) {
    if (data.length < period) return null;
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.volume, 0);
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

  calculateRollingHigh(data, period) {
    if (data.length < period) return null;
    return Math.max(...data.slice(-period).map(candle => candle.high));
  }

  calculateRollingLow(data, period) {
    if (data.length < period) return null;
    return Math.min(...data.slice(-period).map(candle => candle.low));
  }

  calculateRANCO(data, shortPeriod = 5, longPeriod = 20) {
    if (data.length < longPeriod) return null;
    
    // Calculate recent average range
    const recentRanges = data.slice(-shortPeriod)
      .map(candle => candle.high - candle.low);
    const recentAvg = recentRanges.reduce((a, b) => a + b, 0) / shortPeriod;
    
    // Calculate historical average range
    const historicalRanges = data.slice(-longPeriod)
      .map(candle => candle.high - candle.low);
    const historicalAvg = historicalRanges.reduce((a, b) => a + b, 0) / longPeriod;
    
    if (historicalAvg === 0) return null;
    
    return recentAvg / historicalAvg; // <0.7 = contraction, >1.3 = expansion
  }

  checkVolumeQuality(historicalData, currentIndex) {
    if (currentIndex < 3) return { isValid: false, score: 0 };
    
    const currentVolume = historicalData[currentIndex].volume;
    const volumeAvg = this.calculateVolumeMA(historicalData, this.volumeAvgPeriod);
    
    if (!volumeAvg || currentVolume < this.minVolume) {
      return { isValid: false, score: 0 };
    }
    
    // Check if volume is increasing over last 3 candles
    const volumes = [
      historicalData[currentIndex - 2].volume,
      historicalData[currentIndex - 1].volume,
      historicalData[currentIndex].volume
    ];
    
    const isIncreasing = volumes[0] < volumes[1] && volumes[1] < volumes[2];
    
    let points = 0;
    if (currentVolume > this.minVolume) points += 1;
    if (isIncreasing) points += 1;
    if (currentVolume > (volumeAvg * this.volumeSpikeThreshold)) points += 1;
    
    return {
      isValid: currentVolume > this.minVolume && isIncreasing,
      score: Math.min(points, 1)
    };
  }

  checkRsiConfluence(historicalData, currentIndex, signalType) {
    if (currentIndex < 2) return 0;
    
    const currentRsi = this.calculateRSI(historicalData.slice(0, currentIndex + 1), 14);
    const prevRsi = this.calculateRSI(historicalData.slice(0, currentIndex - 1), 14);
    
    if (!currentRsi || !prevRsi) return 0;
    
    if (signalType === 'LONG') {
      if (currentRsi >= this.rsiLongMin && currentRsi <= this.rsiLongMax && currentRsi > prevRsi) {
        return 1;
      }
    } else if (signalType === 'SHORT') {
      if (currentRsi >= this.rsiShortMin && currentRsi <= this.rsiShortMax && currentRsi < prevRsi) {
        return 1;
      }
    }
    
    return 0;
  }

  checkMomentumStrength(historicalData, currentIndex, signalType) {
    if (currentIndex < this.momentumCandles) return 0;
    
    const currentCandle = historicalData[currentIndex];
    
    // Check candle body strength
    const bodySize = Math.abs(currentCandle.close - currentCandle.open);
    const candleRange = currentCandle.high - currentCandle.low;
    const bodyRatio = candleRange > 0 ? bodySize / candleRange : 0;
    const priceChange = Math.abs(currentCandle.close - currentCandle.open);
    
    const bodyStrong = bodyRatio > this.minBodyRatio;
    const momentumStrong = priceChange > this.minMomentumPoints;
    
    if (!bodyStrong || !momentumStrong) return 0;
    
    // Check momentum persistence (3 of last 5 candles in direction)
    const recentCandles = historicalData.slice(currentIndex - this.momentumCandles + 1, currentIndex + 1);
    
    if (signalType === 'LONG') {
      const greenCandles = recentCandles.filter(candle => candle.close > candle.open).length;
      if (greenCandles >= 3 && currentCandle.close > currentCandle.open) {
        return 1;
      }
    } else if (signalType === 'SHORT') {
      const redCandles = recentCandles.filter(candle => candle.close < candle.open).length;
      if (redCandles >= 3 && currentCandle.close < currentCandle.open) {
        return 1;
      }
    }
    
    return 0;
  }

  checkEmaAlignment(historicalData, currentIndex, signalType) {
    const ema5 = this.calculateEMA(historicalData.slice(0, currentIndex + 1), this.emaFast);
    const ema9 = this.calculateEMA(historicalData.slice(0, currentIndex + 1), this.emaMedium);
    const ema21 = this.calculateEMA(historicalData.slice(0, currentIndex + 1), this.emaSlow);
    
    if (!ema5 || !ema9 || !ema21) return 0;
    
    if (signalType === 'LONG') {
      if (ema5 > ema9 && ema9 > ema21) return 1;
    } else if (signalType === 'SHORT') {
      if (ema5 < ema9 && ema9 < ema21) return 1;
    }
    
    return 0;
  }

  checkRancoContraction(historicalData, currentIndex) {
    if (currentIndex < this.rancoLongPeriod) return 0;
    
    const rancoRatio = this.calculateRANCO(
      historicalData.slice(0, currentIndex + 1), 
      this.rancoShortPeriod, 
      this.rancoLongPeriod
    );
    
    if (!rancoRatio) return 0;
    
    // Award point if recent ranges are contracted (ratio < threshold)
    // This indicates coiled spring ready for breakout
    if (rancoRatio < this.rancoContractionThreshold) {
      return 1;
    }
    
    return 0;
  }

  checkBreakoutLevel(historicalData, currentIndex, signalType) {
    if (currentIndex < this.momentumLookback) {
      return { isValid: false, level: 0 };
    }
    
    const currentCandle = historicalData[currentIndex];
    const rollingHigh = this.calculateRollingHigh(historicalData.slice(0, currentIndex + 1), this.momentumLookback);
    const rollingLow = this.calculateRollingLow(historicalData.slice(0, currentIndex + 1), this.momentumLookback);
    
    if (signalType === 'LONG') {
      if (currentCandle.close > rollingHigh) {
        return { isValid: true, level: rollingHigh };
      }
    } else if (signalType === 'SHORT') {
      if (currentCandle.close < rollingLow) {
        return { isValid: true, level: rollingLow };
      }
    }
    
    return { isValid: false, level: 0 };
  }

  calculateConfluenceScore(historicalData, currentIndex, signalType) {
    const scores = {};
    
    // Point 1: RSI in optimal range and trending
    scores.rsi = this.checkRsiConfluence(historicalData, currentIndex, signalType);
    
    // Point 2: Volume quality
    const volumeCheck = this.checkVolumeQuality(historicalData, currentIndex);
    scores.volume = volumeCheck.score;
    
    // Point 3: Strong momentum candle
    scores.momentum = this.checkMomentumStrength(historicalData, currentIndex, signalType);
    
    // Point 4: Moving average alignment
    scores.emaAlignment = this.checkEmaAlignment(historicalData, currentIndex, signalType);
    
    // Point 5: Clear breakout confirmation
    const breakoutCheck = this.checkBreakoutLevel(historicalData, currentIndex, signalType);
    scores.breakout = breakoutCheck.isValid ? 1 : 0;
    
    // Point 6: Volume spike confirmation
    const currentVolume = historicalData[currentIndex].volume;
    const volumeAvg = this.calculateVolumeMA(historicalData, this.volumeAvgPeriod);
    scores.volumeSpike = (volumeAvg && currentVolume > (volumeAvg * this.volumeSpikeThreshold)) ? 1 : 0;
    
    // Point 7: RANCO range contraction (new confluence point)
    scores.ranco = this.checkRancoContraction(historicalData, currentIndex);
    
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    return { totalScore, scores };
  }

  calculateDynamicTargets(historicalData, currentIndex) {
    const currentVolume = historicalData[currentIndex].volume;
    
    // Adjusted volume thresholds for 1-minute data
    if (currentVolume > 1500) {
      return { targetPoints: this.targetPoints, stopLossPoints: this.stopLossPoints };
    } else if (currentVolume > 750) {
      return { targetPoints: 120, stopLossPoints: this.stopLossPoints };
    } else {
      return { targetPoints: 80, stopLossPoints: 60 };
    }
  }

  generateSignal(currentCandle, historicalData, portfolio) {
    if (historicalData.length < Math.max(this.momentumLookback, this.emaSlow, this.volumeAvgPeriod)) {
      return null;
    }

    const currentIndex = historicalData.length - 1;
    const currentPrice = currentCandle.close;
    const currentPosition = portfolio.getPosition('BTCUSD');
    const availableCash = portfolio.cash;

    // Cooldown check
    if (this.lastTradeTime &&
      (currentCandle.timestamp - this.lastTradeTime) < (this.cooldownMinutes * 60 * 1000)) {
      return null;
    }

    // Check both LONG and SHORT possibilities
    for (const signalType of ['LONG', 'SHORT']) {
      const confluenceResult = this.calculateConfluenceScore(historicalData, currentIndex, signalType);
      
      // Debug first few signals
      if (!this.debugCount) this.debugCount = 0;
      if (this.debugCount < 3) {
        console.log(`Confluence ${signalType}: Score ${confluenceResult.totalScore}/7`, confluenceResult.scores);
        this.debugCount++;
      }
      
      if (confluenceResult.totalScore >= this.minConfluenceScore) {
        // For testing, we'll be more lenient on breakout requirement
        const breakoutCheck = this.checkBreakoutLevel(historicalData, currentIndex, signalType);
        
        // If we have good confluence but no breakout, use current price as breakout level
        const useCurrentPriceAsBreakout = !breakoutCheck.isValid && confluenceResult.totalScore >= this.minConfluenceScore;
        
        if (breakoutCheck.isValid || useCurrentPriceAsBreakout) {
          const breakoutLevel = breakoutCheck.isValid ? breakoutCheck.level : currentPrice;
          const targets = this.calculateDynamicTargets(historicalData, currentIndex);
          const baseQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));
          
          // Debug entry condition
          if (this.debugCount < 5) {
            console.log(`Trade attempt ${signalType}: breakout=${breakoutCheck.isValid}, level=${breakoutLevel.toFixed(1)}, currentPos=${currentPosition.quantity}`);
          }
          
          // Calculate entry price with buffer
          let entryPrice, takeProfitPrice, stopLossPrice;
          
          if (signalType === 'LONG') {
            entryPrice = breakoutLevel + this.breakoutBuffer;
            takeProfitPrice = entryPrice + targets.targetPoints;
            stopLossPrice = entryPrice - targets.stopLossPoints;
            
            if (currentPosition.quantity <= 0) {
              this.lastTradeTime = currentCandle.timestamp;
              
              return {
                action: 'BUY',
                quantity: baseQuantity,
                reason: `Confluence LONG ${confluenceResult.totalScore}/7: ${Object.entries(confluenceResult.scores).filter(([k,v]) => v > 0).map(([k,v]) => k).join(', ')}`,
                signal_type: 'LONG_ENTRY',
                takeProfitPrice,
                stopLossPrice
              };
            }
          } else { // SHORT
            entryPrice = breakoutLevel - this.breakoutBuffer;
            takeProfitPrice = entryPrice - targets.targetPoints;
            stopLossPrice = entryPrice + targets.stopLossPoints;
            
            if (currentPosition.quantity >= 0) {
              this.lastTradeTime = currentCandle.timestamp;
              
              return {
                action: 'SELL',
                quantity: baseQuantity,
                reason: `Confluence SHORT ${confluenceResult.totalScore}/7: ${Object.entries(confluenceResult.scores).filter(([k,v]) => v > 0).map(([k,v]) => k).join(', ')}`,
                signal_type: 'SHORT_ENTRY',
                takeProfitPrice,
                stopLossPrice
              };
            }
          }
        }
      }
    }

    return null;
  }
}

module.exports = ConfluenceScalpingStrategy;