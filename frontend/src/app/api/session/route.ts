import { NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

export async function GET() {
  try {
    // Try to use the backend API
    const data = await backendAPI.getSession();
    
    // Calculate additional metrics
    const uptime = new Date().getTime() - new Date(data.startTime).getTime();
    const unrealizedPnL = data.portfolio.positions.reduce((total: number, pos: { quantity: number; avgPrice: number }) => {
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
    
    // Return demo data for production deployment
    return NextResponse.json({
      symbol: 'BTCUSD',
      strategy: 'SuperTrend Renko System',
      marketRegime: 'TRENDING',
      activeStrategy: 'PRIMARY',
      initialCapital: 100000,
      startTime: new Date().toISOString(),
      portfolio: {
        cash: 100000,
        equity: 100000,
        positions: [],
        totalReturn: 0
      },
      metrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        winRate: 0,
        lastUpdate: new Date().toISOString()
      },
      strategies: {
        primary: {
          name: 'SuperTrend Renko Confluence Strategy',
          signals: 0,
          confluence: '0.00',
          superTrendSignals: 0,
          macdConfirmations: 0,
          volumeSurges: 0
        },
        secondary: {
          name: 'Bollinger Stochastic Renko Strategy',
          signals: 0,
          bollingerBounces: 0,
          stochasticCrossovers: 0,
          emaTrendFilters: 0
        }
      },
      lastPrice: 117000,
      uptime: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalPnL: 0,
      openPositions: 0,
      lastUpdate: new Date().toISOString()
    });
  }
}