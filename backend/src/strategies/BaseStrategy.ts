/**
 * Base strategy class for all trading strategies
 */
import { EventEmitter } from 'events';
import { Candle, StrategySignal, StrategyConfig, RiskManagementConfig } from '@/types';
import { createLogger } from '@/utils/logger';

export interface TechnicalIndicators {
  sma: (period: number) => number[];
  ema: (period: number) => number[];
  rsi: (period: number) => number[];
  macd: () => { macd: number[]; signal: number[]; histogram: number[] };
  bollinger: (period: number, stdDev: number) => { upper: number[]; middle: number[]; lower: number[] };
  stochastic: (kPeriod: number, dPeriod: number) => { k: number[]; d: number[] };
  atr: (period: number) => number[];
  volume: () => number[];
  volumeProfile: (bins: number) => { price: number; volume: number }[];
}

export abstract class BaseStrategy extends EventEmitter {
  protected logger = createLogger('BaseStrategy');
  protected candles: Candle[] = [];
  protected config: StrategyConfig;
  protected indicators: TechnicalIndicators;
  protected maxCandles: number = 1000; // Limit memory usage

  constructor(config: StrategyConfig) {
    super();
    this.config = config;
    this.indicators = this.createIndicators();
    this.logger.info('Strategy initialized', { 
      name: this.getName(),
      config: this.config 
    });
  }

  /**
   * Get strategy name
   */
  abstract getName(): string;

  /**
   * Generate trading signals based on current market data
   */
  abstract generateSignals(): Promise<StrategySignal[]>;

  /**
   * Add a new candle to the strategy
   */
  addCandle(candle: Candle): void {
    this.candles.push(candle);
    
    // Limit the number of candles to prevent memory issues
    if (this.candles.length > this.maxCandles) {
      this.candles = this.candles.slice(-this.maxCandles);
    }

    this.onNewCandle(candle);
  }

  /**
   * Called when a new candle is added
   */
  protected onNewCandle(candle: Candle): void {
    // Override in derived classes if needed
    this.emit('newCandle', candle);
  }

  /**
   * Get the latest candle
   */
  protected getLatestCandle(): Candle | null {
    return this.candles.length > 0 ? this.candles[this.candles.length - 1] : null;
  }

  /**
   * Get candles for a specific period
   */
  protected getCandles(count?: number): Candle[] {
    if (!count) return [...this.candles];
    return this.candles.slice(-count);
  }

  /**
   * Get closing prices
   */
  protected getClosePrices(count?: number): number[] {
    const candles = this.getCandles(count);
    return candles.map(c => c.close);
  }

  /**
   * Get high prices
   */
  protected getHighPrices(count?: number): number[] {
    const candles = this.getCandles(count);
    return candles.map(c => c.high);
  }

  /**
   * Get low prices
   */
  protected getLowPrices(count?: number): number[] {
    const candles = this.getCandles(count);
    return candles.map(c => c.low);
  }

  /**
   * Get volumes
   */
  protected getVolumes(count?: number): number[] {
    const candles = this.getCandles(count);
    return candles.map(c => c.volume);
  }

  /**
   * Get risk management configuration
   */
  getRiskConfig(): RiskManagementConfig {
    return this.config.riskManagement;
  }

  /**
   * Get strategy configuration
   */
  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  /**
   * Update strategy parameters
   */
  updateParameters(parameters: Record<string, any>): void {
    this.config.parameters = { ...this.config.parameters, ...parameters };
    this.onParametersUpdated();
    this.logger.info('Strategy parameters updated', { parameters });
  }

  /**
   * Called when parameters are updated
   */
  protected onParametersUpdated(): void {
    // Override in derived classes if needed
    this.emit('parametersUpdated', this.config.parameters);
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.candles = [];
    this.onReset();
    this.logger.info('Strategy reset');
  }

  /**
   * Called when strategy is reset
   */
  protected onReset(): void {
    // Override in derived classes if needed
    this.emit('reset');
  }

  /**
   * Validate strategy configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.name) {
      errors.push('Strategy name is required');
    }

    if (!this.config.riskManagement) {
      errors.push('Risk management configuration is required');
    } else {
      if (this.config.riskManagement.maxPositionSize <= 0 || this.config.riskManagement.maxPositionSize > 1) {
        errors.push('Max position size must be between 0 and 1');
      }
      
      if (this.config.riskManagement.stopLossPercent <= 0) {
        errors.push('Stop loss percentage must be positive');
      }
      
      if (this.config.riskManagement.takeProfitPercent <= 0) {
        errors.push('Take profit percentage must be positive');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create technical indicators
   */
  private createIndicators(): TechnicalIndicators {
    return {
      sma: (period: number) => this.calculateSMA(period),
      ema: (period: number) => this.calculateEMA(period),
      rsi: (period: number) => this.calculateRSI(period),
      macd: () => this.calculateMACD(),
      bollinger: (period: number, stdDev: number) => this.calculateBollingerBands(period, stdDev),
      stochastic: (kPeriod: number, dPeriod: number) => this.calculateStochastic(kPeriod, dPeriod),
      atr: (period: number) => this.calculateATR(period),
      volume: () => this.getVolumes(),
      volumeProfile: (bins: number) => this.calculateVolumeProfile(bins)
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(period: number): number[] {
    const prices = this.getClosePrices();
    const sma: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(period: number): number[] {
    const prices = this.getClosePrices();
    if (prices.length === 0) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    let sum = 0;
    for (let i = 0; i < Math.min(period, prices.length); i++) {
      sum += prices[i];
    }
    ema.push(sum / Math.min(period, prices.length));

    // Calculate EMA for remaining values
    for (let i = 1; i < prices.length; i++) {
      const value = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
      ema.push(value);
    }

    return ema;
  }

  /**
   * Calculate Relative Strength Index
   */
  private calculateRSI(period: number): number[] {
    const prices = this.getClosePrices();
    if (prices.length < period + 1) return [];

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsi: number[] = [];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Calculate initial RSI
    let rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    // Calculate remaining RSI values
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(): { macd: number[]; signal: number[]; histogram: number[] } {
    const ema12 = this.calculateEMA(12);
    const ema26 = this.calculateEMA(26);
    
    if (ema12.length === 0 || ema26.length === 0) {
      return { macd: [], signal: [], histogram: [] };
    }

    const macd: number[] = [];
    const minLength = Math.min(ema12.length, ema26.length);

    for (let i = 0; i < minLength; i++) {
      macd.push(ema12[i] - ema26[i]);
    }

    // Calculate signal line (9-period EMA of MACD)
    const signal = this.calculateEMAFromArray(macd, 9);
    
    // Calculate histogram
    const histogram: number[] = [];
    const histLength = Math.min(macd.length, signal.length);
    
    for (let i = 0; i < histLength; i++) {
      histogram.push(macd[i] - signal[i]);
    }

    return { macd, signal, histogram };
  }

  /**
   * Calculate EMA from an array
   */
  private calculateEMAFromArray(values: number[], period: number): number[] {
    if (values.length === 0) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with first value
    ema.push(values[0]);

    // Calculate EMA for remaining values
    for (let i = 1; i < values.length; i++) {
      const value = (values[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
      ema.push(value);
    }

    return ema;
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } {
    const sma = this.calculateSMA(period);
    const prices = this.getClosePrices();
    
    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < sma.length; i++) {
      const relevantPrices = prices.slice(i + period - sma.length, i + period - sma.length + period);
      const variance = relevantPrices.reduce((sum, price) => sum + Math.pow(price - sma[i], 2), 0) / period;
      const standardDev = Math.sqrt(variance);

      middle.push(sma[i]);
      upper.push(sma[i] + (standardDev * stdDev));
      lower.push(sma[i] - (standardDev * stdDev));
    }

    return { upper, middle, lower };
  }

  /**
   * Calculate Stochastic Oscillator
   */
  private calculateStochastic(kPeriod: number, dPeriod: number): { k: number[]; d: number[] } {
    const candles = this.getCandles();
    const k: number[] = [];

    for (let i = kPeriod - 1; i < candles.length; i++) {
      const periodCandles = candles.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...periodCandles.map(c => c.high));
      const lowestLow = Math.min(...periodCandles.map(c => c.low));
      const currentClose = candles[i].close;

      const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      k.push(kValue);
    }

    // Calculate %D (moving average of %K)
    const d: number[] = [];
    for (let i = dPeriod - 1; i < k.length; i++) {
      const sum = k.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0);
      d.push(sum / dPeriod);
    }

    return { k, d };
  }

  /**
   * Calculate Average True Range
   */
  private calculateATR(period: number): number[] {
    const candles = this.getCandles();
    if (candles.length < 2) return [];

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    // Calculate ATR using SMA of true ranges
    const atr: number[] = [];
    for (let i = period - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    }

    return atr;
  }

  /**
   * Calculate Volume Profile
   */
  private calculateVolumeProfile(bins: number): { price: number; volume: number }[] {
    const candles = this.getCandles();
    if (candles.length === 0) return [];

    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const binSize = priceRange / bins;

    const volumeProfile: { price: number; volume: number }[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = minPrice + (i * binSize);
      const binEnd = binStart + binSize;
      const binPrice = binStart + (binSize / 2);

      let binVolume = 0;
      for (let j = 0; j < candles.length; j++) {
        if (prices[j] >= binStart && prices[j] < binEnd) {
          binVolume += volumes[j];
        }
      }

      volumeProfile.push({ price: binPrice, volume: binVolume });
    }

    return volumeProfile.sort((a, b) => b.volume - a.volume);
  }

  /**
   * Create a standardized signal
   */
  protected createSignal(
    type: 'LONG_ENTRY' | 'SHORT_ENTRY' | 'EXIT',
    symbol: string,
    price: number,
    quantity: number,
    reason: string,
    confidence: number = 1.0,
    takeProfitPrice?: number,
    stopLossPrice?: number
  ): StrategySignal {
    return {
      type,
      symbol,
      price,
      quantity,
      reason,
      confidence: Math.max(0, Math.min(1, confidence)),
      takeProfitPrice,
      stopLossPrice
    };
  }

  /**
   * Log strategy information
   */
  protected logInfo(message: string, data?: any): void {
    this.logger.info(`[${this.getName()}] ${message}`, data);
  }

  /**
   * Log strategy warning
   */
  protected logWarning(message: string, data?: any): void {
    this.logger.warn(`[${this.getName()}] ${message}`, data);
  }

  /**
   * Log strategy error
   */
  protected logError(message: string, data?: any): void {
    this.logger.error(`[${this.getName()}] ${message}`, data);
  }
}