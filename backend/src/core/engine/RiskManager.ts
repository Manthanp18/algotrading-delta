/**
 * Risk management system for trading operations
 */
import { StrategySignal, Portfolio, Candle, RiskManagementConfig } from '@/types';
import { createLogger } from '@/utils/logger';

export interface RiskCheck {
  passed: boolean;
  reason?: string;
  adjustedQuantity?: number;
}

export class RiskManager {
  private logger = createLogger('RiskManager');
  private config: RiskManagementConfig;
  private dailyLoss = 0;
  private dailyTrades = 0;
  private lastResetDate = new Date().toDateString();

  constructor(config: RiskManagementConfig) {
    this.config = config;
    this.logger.info('Risk manager initialized', { config });
  }

  /**
   * Validate a trading signal against risk rules
   */
  validateSignal(signal: StrategySignal, portfolio: Portfolio, currentCandle: Candle): boolean {
    this.resetDailyCountersIfNeeded();

    const checks = [
      this.checkPositionSize(signal, portfolio),
      this.checkMaxDrawdown(portfolio),
      this.checkMaxOpenPositions(signal, portfolio),
      this.checkDailyLimits(),
      this.checkMarketConditions(currentCandle)
    ];

    const failedChecks = checks.filter(check => !check.passed);
    
    if (failedChecks.length > 0) {
      this.logger.warn('Signal validation failed', {
        signal: this.sanitizeSignal(signal),
        failedChecks: failedChecks.map(check => check.reason)
      });
      return false;
    }

    // Apply position sizing adjustments if needed
    const positionSizeCheck = this.checkPositionSize(signal, portfolio);
    if (positionSizeCheck.adjustedQuantity && positionSizeCheck.adjustedQuantity !== signal.quantity) {
      signal.quantity = positionSizeCheck.adjustedQuantity;
      this.logger.info('Position size adjusted by risk manager', {
        original: signal.quantity,
        adjusted: positionSizeCheck.adjustedQuantity
      });
    }

    return true;
  }

  /**
   * Check if position size is within limits
   */
  private checkPositionSize(signal: StrategySignal, portfolio: Portfolio): RiskCheck {
    const maxPositionValue = portfolio.equity * this.config.maxPositionSize;
    const signalValue = signal.quantity * signal.price;

    if (signalValue > maxPositionValue) {
      const adjustedQuantity = maxPositionValue / signal.price;
      
      if (adjustedQuantity < 0.000001) { // Minimum viable position
        return {
          passed: false,
          reason: `Position size too small after adjustment: ${adjustedQuantity}`
        };
      }

      return {
        passed: true,
        adjustedQuantity,
        reason: `Position size adjusted from ${signal.quantity} to ${adjustedQuantity}`
      };
    }

    return { passed: true };
  }

  /**
   * Check maximum drawdown limit
   */
  private checkMaxDrawdown(portfolio: Portfolio): RiskCheck {
    if (portfolio.maxDrawdown > this.config.maxDrawdown) {
      return {
        passed: false,
        reason: `Maximum drawdown exceeded: ${(portfolio.maxDrawdown * 100).toFixed(2)}% > ${(this.config.maxDrawdown * 100).toFixed(2)}%`
      };
    }

    return { passed: true };
  }

  /**
   * Check maximum number of open positions
   */
  private checkMaxOpenPositions(signal: StrategySignal, portfolio: Portfolio): RiskCheck {
    // Only check for entry signals
    if (signal.type === 'EXIT') {
      return { passed: true };
    }

    const openPositions = portfolio.positions.length;
    if (openPositions >= this.config.maxOpenPositions) {
      return {
        passed: false,
        reason: `Maximum open positions reached: ${openPositions} >= ${this.config.maxOpenPositions}`
      };
    }

    return { passed: true };
  }

  /**
   * Check daily trading limits
   */
  private checkDailyLimits(): RiskCheck {
    const maxDailyTrades = 50; // Configurable
    const maxDailyLoss = 0.1; // 10% max daily loss

    if (this.dailyTrades >= maxDailyTrades) {
      return {
        passed: false,
        reason: `Daily trade limit exceeded: ${this.dailyTrades} >= ${maxDailyTrades}`
      };
    }

    if (this.dailyLoss > maxDailyLoss) {
      return {
        passed: false,
        reason: `Daily loss limit exceeded: ${(this.dailyLoss * 100).toFixed(2)}% > ${(maxDailyLoss * 100).toFixed(2)}%`
      };
    }

    return { passed: true };
  }

  /**
   * Check market conditions for trading
   */
  private checkMarketConditions(candle: Candle): RiskCheck {
    // Check for extreme volatility
    const priceRange = candle.high - candle.low;
    const volatility = priceRange / candle.open;
    const maxVolatility = 0.1; // 10% max volatility per candle

    if (volatility > maxVolatility) {
      return {
        passed: false,
        reason: `Extreme volatility detected: ${(volatility * 100).toFixed(2)}% > ${(maxVolatility * 100).toFixed(2)}%`
      };
    }

    // Check for minimum volume
    const minVolume = 1000; // Minimum volume threshold
    if (candle.volume < minVolume) {
      return {
        passed: false,
        reason: `Insufficient volume: ${candle.volume} < ${minVolume}`
      };
    }

    return { passed: true };
  }

  /**
   * Calculate optimal position size using Kelly Criterion
   */
  calculateOptimalPositionSize(
    winRate: number,
    avgWin: number,
    avgLoss: number,
    portfolio: Portfolio
  ): number {
    if (winRate <= 0 || avgWin <= 0 || avgLoss <= 0) {
      return this.config.maxPositionSize * 0.1; // Conservative default
    }

    // Kelly Criterion: f = (bp - q) / b
    // where: b = odds received (avgWin/avgLoss), p = probability of win, q = probability of loss
    const b = avgWin / avgLoss;
    const p = winRate;
    const q = 1 - winRate;
    
    const kellyFraction = (b * p - q) / b;
    
    // Cap at maximum position size and apply safety factor
    const safetyFactor = 0.5; // Only use 50% of Kelly recommendation
    const optimalSize = Math.min(
      kellyFraction * safetyFactor,
      this.config.maxPositionSize
    );

    return Math.max(optimalSize, 0.01); // Minimum 1% position size
  }

  /**
   * Update daily counters when a trade is executed
   */
  updateDailyCounters(pnl: number): void {
    this.resetDailyCountersIfNeeded();
    this.dailyTrades++;
    
    if (pnl < 0) {
      this.dailyLoss += Math.abs(pnl);
    }

    this.logger.debug('Daily counters updated', {
      dailyTrades: this.dailyTrades,
      dailyLoss: this.dailyLoss
    });
  }

  /**
   * Reset daily counters if it's a new day
   */
  private resetDailyCountersIfNeeded(): void {
    const currentDate = new Date().toDateString();
    if (currentDate !== this.lastResetDate) {
      this.dailyLoss = 0;
      this.dailyTrades = 0;
      this.lastResetDate = currentDate;
      this.logger.info('Daily risk counters reset for new day');
    }
  }

  /**
   * Check if emergency stop should be triggered
   */
  shouldTriggerEmergencyStop(portfolio: Portfolio): boolean {
    const emergencyDrawdownLimit = 0.3; // 30% emergency stop
    const emergencyLossLimit = 0.5; // 50% emergency loss limit

    const currentDrawdown = (portfolio.equity < portfolio.equity) ? 
      (portfolio.equity - portfolio.equity) / portfolio.equity : 0;

    if (Math.abs(currentDrawdown) > emergencyDrawdownLimit) {
      this.logger.error('Emergency stop triggered: excessive drawdown', {
        currentDrawdown: currentDrawdown * 100,
        limit: emergencyDrawdownLimit * 100
      });
      return true;
    }

    if (this.dailyLoss > emergencyLossLimit) {
      this.logger.error('Emergency stop triggered: excessive daily loss', {
        dailyLoss: this.dailyLoss * 100,
        limit: emergencyLossLimit * 100
      });
      return true;
    }

    return false;
  }

  /**
   * Get current risk metrics
   */
  getRiskMetrics(): {
    dailyTrades: number;
    dailyLoss: number;
    riskConfig: RiskManagementConfig;
  } {
    this.resetDailyCountersIfNeeded();
    
    return {
      dailyTrades: this.dailyTrades,
      dailyLoss: this.dailyLoss,
      riskConfig: { ...this.config }
    };
  }

  /**
   * Update risk configuration
   */
  updateConfig(newConfig: Partial<RiskManagementConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Risk configuration updated', { config: this.config });
  }

  /**
   * Sanitize signal data for logging (remove sensitive info)
   */
  private sanitizeSignal(signal: StrategySignal): Partial<StrategySignal> {
    return {
      type: signal.type,
      symbol: signal.symbol,
      quantity: signal.quantity,
      confidence: signal.confidence,
      reason: signal.reason
    };
  }

  /**
   * Reset daily counters (for testing or manual reset)
   */
  resetDailyCounters(): void {
    this.dailyLoss = 0;
    this.dailyTrades = 0;
    this.lastResetDate = new Date().toDateString();
    this.logger.info('Daily risk counters manually reset');
  }
}