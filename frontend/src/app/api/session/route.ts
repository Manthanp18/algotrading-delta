import { NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

// For local development
import fs from 'fs';
import path from 'path';

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
    // In production, use the backend API
    if (process.env.NODE_ENV === 'production') {
      const data = await backendAPI.getSession();
      return NextResponse.json(data);
    }
    
    // In development, read from local file system
    const sessionFile = path.join(process.cwd(), '..', 'backend', 'dashboard', 'trades', 'current_session.json');
    
    if (!fs.existsSync(sessionFile)) {
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }
    
    const sessionData = fs.readFileSync(sessionFile, 'utf8');
    const session: SessionData = JSON.parse(sessionData);
    
    // Calculate additional metrics
    const uptime = new Date().getTime() - new Date(session.startTime).getTime();
    const unrealizedPnL = session.portfolio.positions.reduce((total, pos) => {
      if (pos.quantity > 0) {
        return total + ((session.lastPrice - pos.avgPrice) * pos.quantity);
      }
      return total;
    }, 0);
    
    return NextResponse.json({
      ...session,
      uptime,
      unrealizedPnL,
      realizedPnL: session.metrics.totalPnl,
      totalPnL: session.metrics.totalPnl + unrealizedPnL
    });
    
  } catch (error) {
    console.error('Error fetching session data:', error);
    return NextResponse.json({ error: 'Failed to fetch session data' }, { status: 500 });
  }
}