import { NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

interface Portfolio {
  cash: number;
  equity: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
  }>;
  totalReturn: number;
}

interface SessionData {
  symbol: string;
  strategy: string;
  initialCapital: number;
  startTime: string;
  portfolio: Portfolio;
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    maxDrawdown: number;
    winRate: number;
    lastUpdate: string;
  };
  lastCandleTime: string;
  lastPrice: number;
  openPositions: number;
  lastUpdate: string;
}

export async function GET() {
  try {
    // Always use the backend API (both dev and production)
    const data = await backendAPI.getSession();
    
    // Calculate additional metrics
    const uptime = new Date().getTime() - new Date(data.startTime).getTime();
    const unrealizedPnL = data.portfolio.positions.reduce((total: number, pos: any) => {
      if (pos.quantity > 0) {
        return total + ((data.lastPrice - pos.avgPrice) * pos.quantity);
      }
      return total;
    }, 0);
    
    return NextResponse.json({
      ...data,
      uptime,
      unrealizedPnL,
      realizedPnL: data.metrics.totalPnl,
      totalPnL: data.metrics.totalPnl + unrealizedPnL
    });
    
  } catch (error) {
    console.error('Error fetching session data:', error);
    return NextResponse.json({ error: 'Failed to fetch session data' }, { status: 500 });
  }
}