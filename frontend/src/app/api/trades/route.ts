import { NextRequest, NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

interface TradeItem {
  timestamp: string;
  status: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const currentDate = new Date().toISOString().split('T')[0];
  
  try {
    // Always use the backend API
    const trades = await backendAPI.getTrades(dateParam || undefined);
    
    // Sort trades by timestamp descending (most recent first)
    trades.sort((a: TradeItem, b: TradeItem) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json({
      trades,
      date: dateParam || currentDate,
      totalTrades: trades.length,
      openTrades: trades.filter((t: TradeItem) => t.status === 'OPEN').length,
      closedTrades: trades.filter((t: TradeItem) => t.status === 'CLOSED').length
    });
    
  } catch (error) {
    console.error('Error fetching trades:', error);
    
    // Return empty response when backend is not available - NO DEMO DATA
    return NextResponse.json({
      trades: [],
      date: dateParam || currentDate,
      totalTrades: 0,
      openTrades: 0,
      closedTrades: 0,
      error: 'Backend API not available'
    });
  }
}