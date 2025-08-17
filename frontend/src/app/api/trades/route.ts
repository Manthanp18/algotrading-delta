import { NextRequest, NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

interface TradeItem {
  timestamp: string;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    // Always use the backend API
    const trades = await backendAPI.getTrades(date || undefined);
    
    // Sort trades by timestamp descending (most recent first)
    trades.sort((a: TradeItem, b: TradeItem) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json({
      trades,
      date: date || new Date().toISOString().split('T')[0],
      totalTrades: trades.length,
      openTrades: trades.filter((t: TradeItem) => t.status === 'OPEN').length,
      closedTrades: trades.filter((t: TradeItem) => t.status === 'CLOSED').length
    });
    
  } catch (error) {
    console.error('Error fetching trades:', error);
    
    // Return demo data for production deployment
    return NextResponse.json({
      trades: [],
      date: date || new Date().toISOString().split('T')[0],
      totalTrades: 0,
      openTrades: 0,
      closedTrades: 0
    });
  }
}