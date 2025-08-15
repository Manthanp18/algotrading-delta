import { NextRequest, NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

// For local development
import fs from 'fs';
import path from 'path';

interface Trade {
  id?: string;
  symbol: string;
  type: string;
  signal_type: string;
  quantity: number;
  entryPrice: number;
  entryTime: string;
  reason: string;
  status: string;
  exitPrice?: number;
  exitTime?: string;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriod?: number;
  exitReason?: string;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // In production, use the backend API
    if (process.env.NODE_ENV === 'production') {
      const data = await backendAPI.getAnalytics(date);
      return NextResponse.json(data);
    }
    
    // In development, read from local file system
    const tradesDir = path.join(process.cwd(), '..', 'backend', 'dashboard', 'trades');
    const tradesFile = path.join(tradesDir, `trades_${date}.json`);
    
    let trades: Trade[] = [];
    
    if (fs.existsSync(tradesFile)) {
      const tradesData = fs.readFileSync(tradesFile, 'utf8');
      trades = JSON.parse(tradesData);
    }
    
    // Filter only closed trades for analytics
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    
    if (closedTrades.length === 0) {
      return NextResponse.json({
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        averagePnL: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxWin: 0,
        maxLoss: 0,
        averageHoldingPeriod: 0,
        longTrades: 0,
        shortTrades: 0,
        longWinRate: 0,
        shortWinRate: 0,
        hourlyBreakdown: [],
        pnlChartData: []
      });
    }
    
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const longTrades = closedTrades.filter(t => t.type === 'BUY');
    const shortTrades = closedTrades.filter(t => t.type === 'SELL_SHORT' || t.type === 'SELL');
    const longWins = longTrades.filter(t => (t.pnl || 0) > 0);
    const shortWins = shortTrades.filter(t => (t.pnl || 0) > 0);
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWinAmount = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLossAmount = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    // Calculate hourly breakdown
    const hourlyStats = new Map<number, { trades: number; pnl: number }>();
    closedTrades.forEach(trade => {
      const hour = new Date(trade.entryTime).getHours();
      const current = hourlyStats.get(hour) || { trades: 0, pnl: 0 };
      hourlyStats.set(hour, {
        trades: current.trades + 1,
        pnl: current.pnl + (trade.pnl || 0)
      });
    });
    
    const hourlyBreakdown = Array.from(hourlyStats.entries()).map(([hour, stats]) => ({
      hour,
      trades: stats.trades,
      pnl: stats.pnl
    })).sort((a, b) => a.hour - b.hour);
    
    // Calculate cumulative P&L for chart
    let cumulativePnL = 0;
    const pnlChartData = closedTrades
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(trade => {
        cumulativePnL += (trade.pnl || 0);
        return {
          timestamp: trade.timestamp,
          cumulativePnL,
          pnl: trade.pnl || 0,
          type: trade.type
        };
      });
    
    return NextResponse.json({
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / closedTrades.length) * 100,
      totalPnL,
      averagePnL: totalPnL / closedTrades.length,
      averageWin: winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0,
      profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0,
      maxWin: Math.max(...closedTrades.map(t => t.pnl || 0)),
      maxLoss: Math.min(...closedTrades.map(t => t.pnl || 0)),
      averageHoldingPeriod: closedTrades.reduce((sum, t) => sum + (t.holdingPeriod || 0), 0) / closedTrades.length,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longWinRate: longTrades.length > 0 ? (longWins.length / longTrades.length) * 100 : 0,
      shortWinRate: shortTrades.length > 0 ? (shortWins.length / shortTrades.length) * 100 : 0,
      hourlyBreakdown,
      pnlChartData
    });
    
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json({ error: 'Failed to calculate analytics' }, { status: 500 });
  }
}