import { NextRequest, NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

interface Trade {
  id?: string;
  symbol: string;
  type: string;
  signal_type: string;
  quantity: number;
  entryPrice: number;
  entryTime: string;
  reason: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
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
    const date = searchParams.get('date');
    
    // Always use the backend API
    const trades = await backendAPI.getTrades(date || undefined);
    
    // Sort trades by timestamp descending (most recent first)
    trades.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json({
      trades,
      date: date || new Date().toISOString().split('T')[0],
      totalTrades: trades.length,
      openTrades: trades.filter((t: any) => t.status === 'OPEN').length,
      closedTrades: trades.filter((t: any) => t.status === 'CLOSED').length
    });
    
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}