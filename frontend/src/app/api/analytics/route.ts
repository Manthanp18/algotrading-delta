import { NextRequest, NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    // Always use the backend API
    const data = await backendAPI.getAnalytics(date || undefined);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching analytics:', error);
    
    // Return demo analytics data for production deployment
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
}