import { NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

export async function GET() {
  try {
    // Always use the backend API (both dev and production)
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
    return NextResponse.json({ error: 'Failed to fetch session data' }, { status: 500 });
  }
}