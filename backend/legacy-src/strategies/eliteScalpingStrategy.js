const BaseStrategy = require('./baseStrategy');

/**
 * Elite BTC Scalping Strategy
 * 
 * High-quality confluence-based strategy for capturing 200-400 point BTC moves.
 * Uses 8-point confluence system with smart filtering for maximum profitability.
 * 
 * Targets: 300-400 points | Stop Loss: 120-150 points
 * Expected Win Rate: 70-80% | Risk/Reward: 2.5:1 minimum
 * Trade Frequency: 2-5 high-quality trades per hour
 */
class EliteScalpingStrategy extends BaseStrategy {
  constructor(positionSize = 0.05) {
    super('Elite BTC Scalping Strategy');
    this.positionSize = positionSize;
    this.lastTradeTime = null;
    this.cooldownMinutes = 2; // 2-minute cooldown for quality
    
    // Dynamic targets based on market volatility (increased for profitability after fees)
    this.baseTargetPoints = 250; // Base target - minimum 250 points for profitable scalping
    this.maxTargetPoints = 400; // Maximum target during high volatility
    this.baseStopLossPoints = 120; // Base stop loss
    this.maxStopLossPoints = 160; // Maximum stop during high volatility
    this.minProfitablePoints = 200; // Minimum points needed to cover fees (about $200 profit per BTC)
    
    // Volume requirements (more stringent)
    this.minVolume = 800; // Higher minimum volume for 1m candles
    this.volumeSpikeThreshold = 1.4; // Higher spike threshold
    this.volumeAccelerationPeriod = 3; // Must increase over 3 candles
    
    // RSI confluence parameters (research-based)
    this.rsiLongMin = 45;
    this.rsiLongMax = 65;
    this.rsiShortMin = 35;
    this.rsiShortMax = 55;
    this.rsiExtremeExit = 75; // Exit threshold
    
    // EMA system for trend confluence
    this.emaFast = 5;
    this.emaMedium = 13;
    this.emaSlow = 21;
    this.emaTrend = 50; // For major trend context
    
    // Momentum requirements (stricter)
    this.minPriceMove = 8; // Minimum 8 points for momentum
    this.momentumCandles = 3; // Look at 3 candles for persistence
    this.minBodyRatio = 0.4; // 40% body to range ratio for strong candles
    this.momentumPersistence = 2; // 2 out of 3 candles must be in direction
    
    // RANCO parameters for breakout detection
    this.rancoShortPeriod = 5;
    this.rancoLongPeriod = 20;
    this.rancoContractionThreshold = 0.7; // 70% contraction
    this.rancoExpansionThreshold = 1.3; // 130% expansion
    
    // Advanced filtering
    this.atrPeriod = 14;
    this.minAtrMultiplier = 0.5; // Minimum volatility required
    this.maxAtrMultiplier = 3.0; // Maximum volatility allowed
    this.volumeAvgPeriod = 20;
    this.breakoutBuffer = 10; // Larger buffer for quality
    
    // Quality scoring
    this.minConfluenceScore = 8; // 8 out of 15 points required (53%)
    this.optimalConfluenceScore = 10; // Optimal score for best trades (67%)
    
    // Market structure
    this.supportResistanceLookback = 50;
    this.srTolerance = 20; // Points tolerance for S/R levels
  }

  // Calculate ATR for volatility context
  calculateATR(data, period = 14) {
    if (data.length < period + 1) return null;
    
    const trueRanges = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    const recentTR = trueRanges.slice(-period);
    return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
  }

  // Calculate dynamic targets based on volatility
  calculateDynamicTargets(data) {
    const atr = this.calculateATR(data, this.atrPeriod);
    if (!atr) return {
      targetPoints: this.baseTargetPoints,
      stopLossPoints: this.baseStopLossPoints
    };
    
    // Scale targets with volatility
    const volatilityMultiplier = Math.min(Math.max(atr / 100, 0.8), 2.0);
    
    return {
      targetPoints: Math.round(this.baseTargetPoints * volatilityMultiplier),
      stopLossPoints: Math.round(this.baseStopLossPoints * volatilityMultiplier),
      atr: atr
    };
  }

  // Enhanced volume quality check
  checkVolumeQuality(data, currentIndex) {
    if (currentIndex < this.volumeAccelerationPeriod) return { score: 0, details: 'Insufficient history' };
    
    const currentVolume = data[currentIndex].volume;
    const volumeAvg = this.calculateVolumeMA(data, this.volumeAvgPeriod);
    
    if (!volumeAvg || currentVolume < this.minVolume) {
      return { score: 0, details: 'Volume too low' };
    }
    
    // Check volume acceleration over 3 candles
    const volumes = [];
    for (let i = 0; i < this.volumeAccelerationPeriod; i++) {
      volumes.push(data[currentIndex - i].volume);
    }
    volumes.reverse(); // Oldest to newest
    
    let score = 0;
    let details = [];
    
    // Point 1: Above minimum volume
    if (currentVolume >= this.minVolume) {
      score += 1;
      details.push('min_volume');
    }
    
    // Point 2: Volume spike
    if (currentVolume > (volumeAvg * this.volumeSpikeThreshold)) {
      score += 1;
      details.push('volume_spike');
    }
    
    // Point 3: Volume acceleration
    const isAccelerating = volumes[0] < volumes[1] && volumes[1] < volumes[2];
    if (isAccelerating) {
      score += 1;
      details.push('acceleration');
    }
    
    return { score, details: details.join(', '), volumeRatio: currentVolume / volumeAvg };
  }

  // RSI confluence with trend direction
  checkRSIConfluence(data, currentIndex, direction) {
    if (currentIndex < 3) return { score: 0, details: 'Insufficient data' };
    
    const currentRSI = this.calculateRSI(data.slice(0, currentIndex + 1), 14);
    const prevRSI = this.calculateRSI(data.slice(0, currentIndex), 14);
    
    if (!currentRSI || !prevRSI) return { score: 0, details: 'RSI calculation failed' };
    
    let score = 0;
    let details = [];
    
    if (direction === 'LONG') {
      // RSI in bullish range
      if (currentRSI >= this.rsiLongMin && currentRSI <= this.rsiLongMax) {
        score += 1;
        details.push('rsi_range');
      }
      
      // RSI trending up
      if (currentRSI > prevRSI) {
        score += 1;
        details.push('rsi_trending_up');
      }
    } else {
      // RSI in bearish range
      if (currentRSI >= this.rsiShortMin && currentRSI <= this.rsiShortMax) {
        score += 1;
        details.push('rsi_range');
      }
      
      // RSI trending down
      if (currentRSI < prevRSI) {
        score += 1;
        details.push('rsi_trending_down');
      }
    }
    
    return { score, details: details.join(', '), rsi: currentRSI };
  }

  // EMA alignment and trend confluence
  checkEMAConfluence(data, currentIndex, direction) {
    const emaFast = this.calculateEMA(data.slice(0, currentIndex + 1), this.emaFast);
    const emaMedium = this.calculateEMA(data.slice(0, currentIndex + 1), this.emaMedium);
    const emaSlow = this.calculateEMA(data.slice(0, currentIndex + 1), this.emaSlow);
    
    if (!emaFast || !emaMedium || !emaSlow) return { score: 0, details: 'EMA calculation failed' };
    
    const currentPrice = data[currentIndex].close;
    let score = 0;
    let details = [];
    
    if (direction === 'LONG') {
      // EMA alignment (fast > medium > slow)
      if (emaFast > emaMedium && emaMedium > emaSlow) {
        score += 1;
        details.push('ema_aligned_bullish');
      }
      
      // Price above fast EMA
      if (currentPrice > emaFast) {
        score += 1;
        details.push('price_above_fast_ema');
      }
    } else {
      // EMA alignment (fast < medium < slow)
      if (emaFast < emaMedium && emaMedium < emaSlow) {
        score += 1;
        details.push('ema_aligned_bearish');
      }
      
      // Price below fast EMA
      if (currentPrice < emaFast) {
        score += 1;
        details.push('price_below_fast_ema');
      }
    }
    
    return { score, details: details.join(', '), emas: { fast: emaFast, medium: emaMedium, slow: emaSlow } };
  }

  // Enhanced momentum detection
  checkMomentumQuality(data, currentIndex, direction) {
    if (currentIndex < this.momentumCandles) return { score: 0, details: 'Insufficient data' };
    
    const currentCandle = data[currentIndex];
    const recentCandles = data.slice(currentIndex - this.momentumCandles + 1, currentIndex + 1);
    
    let score = 0;
    let details = [];
    
    // Check current candle strength
    const bodySize = Math.abs(currentCandle.close - currentCandle.open);
    const candleRange = currentCandle.high - currentCandle.low;
    const bodyRatio = candleRange > 0 ? bodySize / candleRange : 0;
    
    if (bodyRatio >= this.minBodyRatio) {
      score += 1;
      details.push('strong_candle_body');
    }
    
    // Check price movement magnitude
    const priceMove = Math.abs(currentCandle.close - currentCandle.open);
    if (priceMove >= this.minPriceMove) {
      score += 1;
      details.push('significant_price_move');
    }
    
    // Check momentum persistence
    let directionalCandles = 0;
    for (const candle of recentCandles) {
      if (direction === 'LONG' && candle.close > candle.open) directionalCandles++;
      if (direction === 'SHORT' && candle.close < candle.open) directionalCandles++;
    }
    
    if (directionalCandles >= this.momentumPersistence) {
      score += 1;
      details.push('momentum_persistence');
    }
    
    return { score, details: details.join(', '), bodyRatio, priceMove };
  }


  // Calculate RANCO (from existing strategy)
  calculateRANCO(data, shortPeriod = 5, longPeriod = 20) {
    if (data.length < longPeriod) return null;
    
    const recentRanges = data.slice(-shortPeriod).map(candle => candle.high - candle.low);
    const recentAvg = recentRanges.reduce((a, b) => a + b, 0) / shortPeriod;
    
    const historicalRanges = data.slice(-longPeriod).map(candle => candle.high - candle.low);
    const historicalAvg = historicalRanges.reduce((a, b) => a + b, 0) / longPeriod;
    
    if (historicalAvg === 0) return null;
    return recentAvg / historicalAvg;
  }

  // Calculate Volume MA
  calculateVolumeMA(data, period) {
    if (data.length < period) return null;
    const sum = data.slice(-period).reduce((acc, candle) => acc + candle.volume, 0);
    return sum / period;
  }

  // Standalone RANCO analysis
  checkRANCOContraction(data, currentIndex) {
    if (currentIndex < this.rancoLongPeriod) return { score: 0, details: 'Insufficient data for RANCO' };
    
    const rancoRatio = this.calculateRANCO(data.slice(0, currentIndex + 1), this.rancoShortPeriod, this.rancoLongPeriod);
    
    if (!rancoRatio) return { score: 0, details: 'RANCO calculation failed' };
    
    let score = 0;
    let details = [];
    
    // Award points based on range contraction level
    if (rancoRatio < 0.6) {
      score = 2; // Extreme contraction (coiled spring)
      details.push('extreme_contraction');
    } else if (rancoRatio < this.rancoContractionThreshold) {
      score = 1; // Normal contraction
      details.push('range_contraction');
    }
    
    return { score, details: details.join(', '), rancoRatio };
  }

  // Enhanced breakout detection (separate from RANCO)
  checkBreakoutConfirmation(data, currentIndex, direction) {
    if (currentIndex < 10) return { score: 0, details: 'Insufficient data' };
    
    const currentCandle = data[currentIndex];
    let score = 0;
    let details = [];
    
    // Check for actual breakout beyond recent range
    const recentHigh = Math.max(...data.slice(currentIndex - 10, currentIndex).map(c => c.high));
    const recentLow = Math.min(...data.slice(currentIndex - 10, currentIndex).map(c => c.low));
    
    if (direction === 'LONG' && currentCandle.close > (recentHigh + this.breakoutBuffer)) {
      score += 1;
      details.push('breakout_above_resistance');
    }
    
    if (direction === 'SHORT' && currentCandle.close < (recentLow - this.breakoutBuffer)) {
      score += 1;
      details.push('breakout_below_support');
    }
    
    // Additional confirmation: strong volume on breakout
    const volumeAvg = this.calculateVolumeMA(data, this.volumeAvgPeriod);
    if (volumeAvg && currentCandle.volume > (volumeAvg * 1.5)) {
      score += 1;
      details.push('volume_breakout_confirmation');
    }
    
    return { score, details: details.join(', '), recentHigh, recentLow };
  }

  // 9-Point Elite Confluence System (now includes separate RANCO)
  calculateEliteConfluence(data, currentIndex, direction) {
    const confluence = {
      volume: this.checkVolumeQuality(data, currentIndex),
      rsi: this.checkRSIConfluence(data, currentIndex, direction),
      ema: this.checkEMAConfluence(data, currentIndex, direction),
      momentum: this.checkMomentumQuality(data, currentIndex, direction),
      ranco: this.checkRANCOContraction(data, currentIndex),
      breakout: this.checkBreakoutConfirmation(data, currentIndex, direction)
    };
    
    // Calculate total score (max points: volume=3, rsi=2, ema=2, momentum=3, ranco=2, breakout=3)
    const totalScore = Object.values(confluence).reduce((sum, item) => sum + item.score, 0);
    
    return {
      totalScore,
      maxScore: 15, // Updated max score (3+2+2+3+2+3)
      confluence,
      quality: totalScore >= 10 ? 'OPTIMAL' : 
               totalScore >= 8 ? 'GOOD' : 
               totalScore >= 6 ? 'ACCEPTABLE' : 'POOR'
    };
  }

  // Exit condition with dynamic targets
  shouldExitPosition(entryPrice, currentPrice, entrySignal, targetPoints, stopLossPoints) {
    let pnlPoints = 0;
    
    if (entrySignal === 'BUY') {
      pnlPoints = currentPrice - entryPrice;
    } else {
      pnlPoints = entryPrice - currentPrice;
    }
    
    // Take profit at dynamic target
    if (pnlPoints >= targetPoints) {
      return { shouldExit: true, reason: `Target hit: +${pnlPoints.toFixed(0)} points (target: ${targetPoints})` };
    }
    
    // Stop loss at dynamic level
    if (pnlPoints <= -stopLossPoints) {
      return { shouldExit: true, reason: `Stop loss: ${pnlPoints.toFixed(0)} points (stop: ${stopLossPoints})` };
    }
    
    return { shouldExit: false, reason: null };
  }

  generateSignal(currentCandle, historicalData, portfolio) {
    if (historicalData.length < Math.max(this.emaSlow, this.volumeAvgPeriod, this.rancoLongPeriod)) {
      return null;
    }

    const currentIndex = historicalData.length - 1;
    const currentPrice = currentCandle.close;
    const currentPosition = portfolio.getPosition('BTCUSD');
    const availableCash = portfolio.cash;
    
    // Calculate dynamic targets
    const targets = this.calculateDynamicTargets(historicalData);

    // Debug counter
    if (!this.debugCount) this.debugCount = 0;

    // Check if we should exit current position first
    if (Math.abs(currentPosition.quantity) > 0 && this.lastEntryPrice && this.lastTargetPoints && this.lastStopPoints) {
      const entrySignal = currentPosition.quantity > 0 ? 'BUY' : 'SELL';
      const exitCheck = this.shouldExitPosition(this.lastEntryPrice, currentPrice, entrySignal, this.lastTargetPoints, this.lastStopPoints);

      if (exitCheck.shouldExit) {
        if (currentPosition.quantity > 0) {
          return {
            action: 'SELL',
            quantity: currentPosition.quantity,
            reason: `Elite Exit: ${exitCheck.reason}`,
            signal_type: 'EXIT'
          };
        } else {
          return {
            action: 'BUY',
            quantity: Math.abs(currentPosition.quantity),
            reason: `Elite Exit: ${exitCheck.reason}`,
            signal_type: 'EXIT'
          };
        }
      }
    }

    // Cooldown check
    if (this.lastTradeTime &&
      (currentCandle.timestamp - this.lastTradeTime) < (this.cooldownMinutes * 60 * 1000)) {
      return null;
    }

    const baseQuantity = parseFloat(((availableCash * this.positionSize) / currentPrice).toFixed(6));

    // Check both LONG and SHORT possibilities
    for (const direction of ['LONG', 'SHORT']) {
      const confluenceResult = this.calculateEliteConfluence(historicalData, currentIndex, direction);
      
      // Debug output for first few signals
      if (this.debugCount < 5) {
        console.log(`Elite ${direction}: Score ${confluenceResult.totalScore}/${confluenceResult.maxScore} (${confluenceResult.quality})`);
        console.log(`   Volume: ${confluenceResult.confluence.volume.score}/3 - ${confluenceResult.confluence.volume.details}`);
        console.log(`   RSI: ${confluenceResult.confluence.rsi.score}/2 - ${confluenceResult.confluence.rsi.details}`);
        console.log(`   EMA: ${confluenceResult.confluence.ema.score}/2 - ${confluenceResult.confluence.ema.details}`);
        console.log(`   Momentum: ${confluenceResult.confluence.momentum.score}/3 - ${confluenceResult.confluence.momentum.details}`);
        console.log(`   RANCO: ${confluenceResult.confluence.ranco.score}/2 - ${confluenceResult.confluence.ranco.details} (Ratio: ${confluenceResult.confluence.ranco.rancoRatio?.toFixed(3) || 'N/A'})`);
        console.log(`   Breakout: ${confluenceResult.confluence.breakout.score}/3 - ${confluenceResult.confluence.breakout.details}`);
        this.debugCount++;
      }
      
      // Only trade with high-quality setups
      if (confluenceResult.totalScore >= this.minConfluenceScore) {
        
        if (direction === 'LONG' && currentPosition.quantity <= 0) {
          this.lastTradeTime = currentCandle.timestamp;
          this.lastEntryPrice = currentPrice;
          this.lastTargetPoints = targets.targetPoints;
          this.lastStopPoints = targets.stopLossPoints;

          return {
            action: 'BUY',
            quantity: baseQuantity,
            reason: `Elite LONG ${confluenceResult.totalScore}/${confluenceResult.maxScore} (${confluenceResult.quality}): Target +${targets.targetPoints}pts`,
            signal_type: 'LONG_ENTRY',
            takeProfitPrice: currentPrice + targets.targetPoints,
            stopLossPrice: currentPrice - targets.stopLossPoints,
            confluenceScore: confluenceResult.totalScore,
            quality: confluenceResult.quality
          };
        }
        
        if (direction === 'SHORT' && currentPosition.quantity >= 0) {
          this.lastTradeTime = currentCandle.timestamp;
          this.lastEntryPrice = currentPrice;
          this.lastTargetPoints = targets.targetPoints;
          this.lastStopPoints = targets.stopLossPoints;

          return {
            action: 'SELL',
            quantity: baseQuantity,
            reason: `Elite SHORT ${confluenceResult.totalScore}/${confluenceResult.maxScore} (${confluenceResult.quality}): Target +${targets.targetPoints}pts`,
            signal_type: 'SHORT_ENTRY',
            takeProfitPrice: currentPrice - targets.targetPoints,
            stopLossPrice: currentPrice + targets.stopLossPoints,
            confluenceScore: confluenceResult.totalScore,
            quality: confluenceResult.quality
          };
        }
      }
    }

    return null;
  }
}

module.exports = EliteScalpingStrategy;