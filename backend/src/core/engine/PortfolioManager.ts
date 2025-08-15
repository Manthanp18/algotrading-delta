/**
 * Portfolio management with position tracking and P&L calculation
 */
import { v4 as uuidv4 } from 'uuid';
import { Trade, Position, Portfolio, TradeType, TradeStatus } from '@/types';
import { createLogger } from '@/utils/logger';

export class PortfolioManager {
  private logger = createLogger('PortfolioManager');
  private portfolio: Portfolio;
  private openTrades: Map<string, Trade> = new Map();
  private initialCapital: number;

  constructor(initialCapital: number) {
    this.initialCapital = initialCapital;
    this.portfolio = {
      cash: initialCapital,
      equity: initialCapital,
      positions: [],
      totalReturn: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0
    };

    this.logger.info('Portfolio manager initialized', { initialCapital });
  }

  /**
   * Open a long position
   */
  openLongPosition(
    symbol: string,
    quantity: number,
    price: number,
    reason: string,
    takeProfitPrice?: number,
    stopLossPrice?: number
  ): Trade {
    const cost = quantity * price;
    
    if (this.portfolio.cash < cost) {
      throw new Error(`Insufficient funds: need ${cost}, have ${this.portfolio.cash}`);
    }

    const trade: Trade = {
      id: uuidv4(),
      symbol,
      type: TradeType.BUY,
      signalType: 'LONG_ENTRY',
      quantity,
      entryPrice: price,
      entryTime: Date.now(),
      takeProfitPrice,
      stopLossPrice,
      status: TradeStatus.OPEN,
      reason,
      strategy: 'current'
    };

    // Update portfolio
    this.portfolio.cash -= cost;
    this.openTrades.set(trade.id, trade);
    this.updatePosition(symbol, quantity, price, 'LONG');
    this.updatePortfolioMetrics();

    this.logger.trade('Long position opened', trade);
    return trade;
  }

  /**
   * Open a short position
   */
  openShortPosition(
    symbol: string,
    quantity: number,
    price: number,
    reason: string,
    takeProfitPrice?: number,
    stopLossPrice?: number
  ): Trade {
    const margin = quantity * price * 0.1; // 10% margin requirement
    
    if (this.portfolio.cash < margin) {
      throw new Error(`Insufficient margin: need ${margin}, have ${this.portfolio.cash}`);
    }

    const trade: Trade = {
      id: uuidv4(),
      symbol,
      type: TradeType.SELL_SHORT,
      signalType: 'SHORT_ENTRY',
      quantity,
      entryPrice: price,
      entryTime: Date.now(),
      takeProfitPrice,
      stopLossPrice,
      status: TradeStatus.OPEN,
      reason,
      strategy: 'current'
    };

    // Update portfolio (for short, we add the proceeds but track negative position)
    this.portfolio.cash += quantity * price - margin; // Proceeds minus margin
    this.openTrades.set(trade.id, trade);
    this.updatePosition(symbol, -quantity, price, 'SHORT');
    this.updatePortfolioMetrics();

    this.logger.trade('Short position opened', trade);
    return trade;
  }

  /**
   * Close a position
   */
  closePosition(symbol: string, price: number, reason: string): Trade | null {
    // Find open trade for this symbol
    const openTrade = Array.from(this.openTrades.values())
      .find(trade => trade.symbol === symbol && trade.status === TradeStatus.OPEN);

    if (!openTrade) {
      this.logger.warn('No open position found for symbol', { symbol });
      return null;
    }

    return this.closeTrade(openTrade.id, price, reason);
  }

  /**
   * Close a specific trade
   */
  closeTrade(tradeId: string, exitPrice: number, exitReason: string): Trade {
    const trade = this.openTrades.get(tradeId);
    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    // Calculate P&L
    const { pnl, pnlPercent } = this.calculatePnL(trade, exitPrice);
    
    // Update trade
    trade.exitPrice = exitPrice;
    trade.exitTime = Date.now();
    trade.exitReason = exitReason;
    trade.status = TradeStatus.CLOSED;
    trade.pnl = pnl;
    trade.pnlPercent = pnlPercent;
    trade.holdingPeriod = Math.round((trade.exitTime - trade.entryTime) / (1000 * 60)); // minutes

    // Update portfolio based on trade type
    if (trade.type === TradeType.BUY) {
      // Close long position: sell the asset
      this.portfolio.cash += trade.quantity * exitPrice;
    } else if (trade.type === TradeType.SELL_SHORT) {
      // Close short position: buy back the asset
      const buyBackCost = trade.quantity * exitPrice;
      this.portfolio.cash -= buyBackCost;
      // Return the margin (this is simplified)
      this.portfolio.cash += trade.quantity * trade.entryPrice * 0.1;
    }

    // Remove from open trades
    this.openTrades.delete(tradeId);
    
    // Update position
    this.removePosition(trade.symbol, trade.quantity, trade.type);
    
    // Update portfolio metrics
    this.updatePortfolioMetrics();
    this.updateTradingStats(trade);

    this.logger.trade('Position closed', trade);
    return trade;
  }

  /**
   * Update portfolio with current market prices
   */
  updatePortfolio(currentPrice: number): void {
    let totalValue = this.portfolio.cash;

    // Update positions with current prices
    for (const position of this.portfolio.positions) {
      if (position.side === 'LONG') {
        totalValue += position.quantity * currentPrice;
        position.unrealizedPnL = (currentPrice - position.avgPrice) * position.quantity;
      } else {
        // For short positions
        totalValue += position.quantity * position.avgPrice * 2 - position.quantity * currentPrice;
        position.unrealizedPnL = (position.avgPrice - currentPrice) * Math.abs(position.quantity);
      }
    }

    this.portfolio.equity = totalValue;
    this.portfolio.totalReturn = (this.portfolio.equity - this.initialCapital) / this.initialCapital;

    // Update max drawdown
    const drawdown = (this.initialCapital - this.portfolio.equity) / this.initialCapital;
    if (drawdown > this.portfolio.maxDrawdown) {
      this.portfolio.maxDrawdown = drawdown;
    }
  }

  /**
   * Calculate P&L for a trade
   */
  private calculatePnL(trade: Trade, exitPrice: number): { pnl: number; pnlPercent: number } {
    let pnl: number;
    
    if (trade.type === TradeType.BUY) {
      // Long position: profit when price goes up
      pnl = (exitPrice - trade.entryPrice) * trade.quantity;
    } else {
      // Short position: profit when price goes down
      pnl = (trade.entryPrice - exitPrice) * trade.quantity;
    }

    const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
    
    return { pnl, pnlPercent };
  }

  /**
   * Update position in portfolio
   */
  private updatePosition(symbol: string, quantity: number, price: number, side: 'LONG' | 'SHORT'): void {
    const existingPosition = this.portfolio.positions.find(p => p.symbol === symbol);

    if (existingPosition) {
      // Update existing position
      const totalQuantity = existingPosition.quantity + quantity;
      const totalCost = (existingPosition.avgPrice * existingPosition.quantity) + (price * quantity);
      existingPosition.avgPrice = totalCost / totalQuantity;
      existingPosition.quantity = totalQuantity;
    } else {
      // Create new position
      this.portfolio.positions.push({
        symbol,
        quantity,
        avgPrice: price,
        side,
        unrealizedPnL: 0,
        realizedPnL: 0
      });
    }
  }

  /**
   * Remove position from portfolio
   */
  private removePosition(symbol: string, quantity: number, tradeType: TradeType): void {
    const positionIndex = this.portfolio.positions.findIndex(p => p.symbol === symbol);
    
    if (positionIndex !== -1) {
      const position = this.portfolio.positions[positionIndex];
      
      if (tradeType === TradeType.BUY) {
        position.quantity -= quantity;
      } else {
        position.quantity += quantity; // Adding back for short close
      }

      // Remove position if quantity is zero (or very close to zero)
      if (Math.abs(position.quantity) < 0.000001) {
        this.portfolio.positions.splice(positionIndex, 1);
      }
    }
  }

  /**
   * Update trading statistics
   */
  private updateTradingStats(trade: Trade): void {
    this.portfolio.totalTrades++;
    
    if ((trade.pnl || 0) > 0) {
      this.portfolio.winningTrades++;
    } else if ((trade.pnl || 0) < 0) {
      this.portfolio.losingTrades++;
    }
  }

  /**
   * Update portfolio metrics
   */
  private updatePortfolioMetrics(): void {
    // Calculate total position value (this is simplified)
    let positionValue = 0;
    for (const position of this.portfolio.positions) {
      positionValue += Math.abs(position.quantity) * position.avgPrice;
    }

    this.portfolio.equity = this.portfolio.cash + positionValue;
    this.portfolio.totalReturn = (this.portfolio.equity - this.initialCapital) / this.initialCapital;
  }

  /**
   * Check stop loss and take profit conditions
   */
  checkStopConditions(currentPrice: number): Trade[] {
    const triggeredTrades: Trade[] = [];

    for (const trade of this.openTrades.values()) {
      let shouldClose = false;
      let exitReason = '';

      if (trade.type === TradeType.BUY) {
        // Long position
        if (trade.stopLossPrice && currentPrice <= trade.stopLossPrice) {
          shouldClose = true;
          exitReason = 'Stop Loss Hit';
        } else if (trade.takeProfitPrice && currentPrice >= trade.takeProfitPrice) {
          shouldClose = true;
          exitReason = 'Take Profit Hit';
        }
      } else if (trade.type === TradeType.SELL_SHORT) {
        // Short position
        if (trade.stopLossPrice && currentPrice >= trade.stopLossPrice) {
          shouldClose = true;
          exitReason = 'Stop Loss Hit';
        } else if (trade.takeProfitPrice && currentPrice <= trade.takeProfitPrice) {
          shouldClose = true;
          exitReason = 'Take Profit Hit';
        }
      }

      if (shouldClose) {
        const closedTrade = this.closeTrade(trade.id, currentPrice, exitReason);
        triggeredTrades.push(closedTrade);
      }
    }

    return triggeredTrades;
  }

  /**
   * Get current portfolio state
   */
  getPortfolio(): Portfolio {
    return { ...this.portfolio };
  }

  /**
   * Get open trades
   */
  getOpenTrades(): Trade[] {
    return Array.from(this.openTrades.values());
  }

  /**
   * Get position for a specific symbol
   */
  getPosition(symbol: string): Position | null {
    return this.portfolio.positions.find(p => p.symbol === symbol) || null;
  }

  /**
   * Get available cash
   */
  getAvailableCash(): number {
    return this.portfolio.cash;
  }

  /**
   * Reset portfolio to initial state
   */
  reset(): void {
    this.portfolio = {
      cash: this.initialCapital,
      equity: this.initialCapital,
      positions: [],
      totalReturn: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0
    };
    this.openTrades.clear();
    this.logger.info('Portfolio reset to initial state');
  }
}