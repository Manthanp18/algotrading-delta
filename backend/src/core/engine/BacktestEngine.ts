/**
 * Backtesting engine for historical data simulation
 */
import { EventEmitter } from 'events';
import { Candle, Trade, Portfolio, StrategySignal, TradingSession, PerformanceMetrics } from '@/types';
import { BaseStrategy } from '@/strategies/BaseStrategy';
import { PortfolioManager } from './PortfolioManager';
import { RiskManager } from './RiskManager';
import { createLogger } from '@/utils/logger';

export interface BacktestConfig {
  symbol: string;
  startDate: number;
  endDate: number;
  initialCapital: number;
  strategy: BaseStrategy;
  timeframe: string;
}

export interface BacktestResult {
  session: TradingSession;
  metrics: PerformanceMetrics;
  trades: Trade[];
  equity: number[];
  timestamps: number[];
}

export class BacktestEngine extends EventEmitter {
  private logger = createLogger('BacktestEngine');
  private portfolioManager: PortfolioManager;
  private riskManager: RiskManager;
  private config: BacktestConfig;
  private session: TradingSession;
  private currentCandle: Candle | null = null;
  private equityCurve: number[] = [];
  private timestamps: number[] = [];

  constructor(config: BacktestConfig) {
    super();
    this.config = config;
    this.portfolioManager = new PortfolioManager(config.initialCapital);
    this.riskManager = new RiskManager(config.strategy.getRiskConfig());
    
    // Initialize session
    this.session = {
      id: `backtest_${Date.now()}`,
      symbol: config.symbol,
      strategy: config.strategy.getName(),
      startTime: config.startDate,
      initialCapital: config.initialCapital,
      portfolio: this.portfolioManager.getPortfolio(),
      trades: [],
      status: 'RUNNING' as any,
      config: {
        symbol: config.symbol,
        strategy: config.strategy.getName(),
        initialCapital: config.initialCapital,
        timeframe: config.timeframe,
        riskManagement: config.strategy.getRiskConfig(),
        dataSource: {
          type: 'BACKTEST',
          startDate: config.startDate,
          endDate: config.endDate
        }
      }
    };

    this.logger.info('Backtest engine initialized', {
      symbol: config.symbol,
      strategy: config.strategy.getName(),
      period: `${new Date(config.startDate).toISOString()} - ${new Date(config.endDate).toISOString()}`
    });
  }

  /**
   * Run the backtest simulation
   */
  async run(candles: Candle[]): Promise<BacktestResult> {
    this.logger.info('Starting backtest execution', { candleCount: candles.length });
    
    const startTime = Date.now();
    let processedCandles = 0;

    try {
      for (const candle of candles) {
        await this.processCandle(candle);
        processedCandles++;

        // Emit progress updates
        if (processedCandles % 1000 === 0) {
          const progress = (processedCandles / candles.length) * 100;
          this.emit('progress', { progress, processedCandles, totalCandles: candles.length });
        }
      }

      // Finalize session
      this.session.endTime = Date.now();
      this.session.status = 'STOPPED' as any;

      const executionTime = Date.now() - startTime;
      this.logger.performance('Backtest completed', executionTime, 'BacktestEngine');

      const result: BacktestResult = {
        session: this.session,
        metrics: this.calculateMetrics(),
        trades: this.session.trades,
        equity: this.equityCurve,
        timestamps: this.timestamps
      };

      this.emit('completed', result);
      return result;

    } catch (error) {
      this.session.status = 'ERROR' as any;
      this.logger.error('Backtest execution failed', { error });
      throw error;
    }
  }

  /**
   * Process a single candle
   */
  private async processCandle(candle: Candle): Promise<void> {
    this.currentCandle = candle;
    
    // Update strategy with new data
    this.config.strategy.addCandle(candle);
    
    // Get trading signals
    const signals = await this.config.strategy.generateSignals();
    
    // Process each signal
    for (const signal of signals) {
      await this.processSignal(signal);
    }

    // Update portfolio with current prices
    this.portfolioManager.updatePortfolio(candle.close);
    
    // Record equity curve
    const portfolio = this.portfolioManager.getPortfolio();
    this.equityCurve.push(portfolio.equity);
    this.timestamps.push(candle.timestamp);
    
    // Update session
    this.session.portfolio = portfolio;

    this.emit('candle', { candle, portfolio });
  }

  /**
   * Process a trading signal
   */
  private async processSignal(signal: StrategySignal): Promise<void> {
    try {
      // Validate signal with risk manager
      const isValid = this.riskManager.validateSignal(
        signal,
        this.portfolioManager.getPortfolio(),
        this.currentCandle!
      );

      if (!isValid) {
        this.logger.warn('Signal rejected by risk manager', { signal });
        return;
      }

      // Execute trade
      const trade = await this.executeTrade(signal);
      if (trade) {
        this.session.trades.push(trade);
        this.emit('trade', trade);
        this.logger.trade('Trade executed', trade);
      }

    } catch (error) {
      this.logger.error('Signal processing failed', { signal, error });
    }
  }

  /**
   * Execute a trade based on signal
   */
  private async executeTrade(signal: StrategySignal): Promise<Trade | null> {
    const portfolio = this.portfolioManager.getPortfolio();
    const candle = this.currentCandle!;

    try {
      switch (signal.type) {
        case 'LONG_ENTRY':
          return this.portfolioManager.openLongPosition(
            signal.symbol,
            signal.quantity,
            signal.price,
            signal.reason,
            signal.takeProfitPrice,
            signal.stopLossPrice
          );

        case 'SHORT_ENTRY':
          return this.portfolioManager.openShortPosition(
            signal.symbol,
            signal.quantity,
            signal.price,
            signal.reason,
            signal.takeProfitPrice,
            signal.stopLossPrice
          );

        case 'EXIT':
          return this.portfolioManager.closePosition(
            signal.symbol,
            signal.price,
            signal.reason
          );

        default:
          this.logger.warn('Unknown signal type', { signal });
          return null;
      }
    } catch (error) {
      this.logger.error('Trade execution failed', { signal, error });
      return null;
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(): PerformanceMetrics {
    const portfolio = this.portfolioManager.getPortfolio();
    const trades = this.session.trades.filter(t => t.status === 'CLOSED');
    
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalReturn = portfolio.equity - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;
    
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
    
    const winRate = (winningTrades.length / trades.length) * 100;
    
    const totalWinAmount = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLossAmount = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0;
    
    const averageWin = winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0;
    
    const maxDrawdown = this.calculateMaxDrawdown();
    const maxDrawdownPercent = (maxDrawdown / this.config.initialCapital) * 100;
    
    const sharpeRatio = this.calculateSharpeRatio();
    
    return {
      totalReturn,
      totalReturnPercent,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercent,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      largestWin: Math.max(...trades.map(t => t.pnl || 0)),
      largestLoss: Math.min(...trades.map(t => t.pnl || 0)),
      averageHoldingPeriod: trades.reduce((sum, t) => sum + (t.holdingPeriod || 0), 0) / trades.length
    };
  }

  private calculateMaxDrawdown(): number {
    if (this.equityCurve.length === 0) return 0;
    
    let maxEquity = this.equityCurve[0];
    let maxDrawdown = 0;
    
    for (const equity of this.equityCurve) {
      if (equity > maxEquity) {
        maxEquity = equity;
      }
      
      const drawdown = maxEquity - equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  private calculateSharpeRatio(): number {
    if (this.equityCurve.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const returnPct = (this.equityCurve[i] - this.equityCurve[i - 1]) / this.equityCurve[i - 1];
      returns.push(returnPct);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    return stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      largestWin: 0,
      largestLoss: 0,
      averageHoldingPeriod: 0
    };
  }

  /**
   * Get current session state
   */
  getSession(): TradingSession {
    return { ...this.session };
  }

  /**
   * Stop the backtest
   */
  stop(): void {
    this.session.status = 'STOPPED' as any;
    this.emit('stopped');
    this.logger.info('Backtest stopped');
  }
}