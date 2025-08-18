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
      strategy: 'SuperTrend Renko System', // Override backend strategy name
      marketRegime: 'TRENDING',
      activeStrategy: 'PRIMARY',
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
      uptime,
      unrealizedPnL,
      realizedPnL: data.metrics.totalPnl,
      totalPnL: data.metrics.totalPnl + unrealizedPnL
    });
    
  } catch (error) {
    console.error('Error fetching session data:', error);
    
    // Return empty response when backend is not available - NO DEMO DATA
    return NextResponse.json({
      error: 'Backend API not available',
      symbol: null,
      strategy: null,
      portfolio: null,
      metrics: null,
      lastUpdate: new Date().toISOString()
    });
  }
}