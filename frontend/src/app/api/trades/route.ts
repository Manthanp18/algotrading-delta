import { NextRequest, NextResponse } from 'next/server';
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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Path to the dashboard trades directory in the backend folder
    const tradesDir = path.join(process.cwd(), '..', 'backend', 'dashboard', 'trades');
    const tradesFile = path.join(tradesDir, `trades_${date}.json`);
    
    let trades: Trade[] = [];
    
    if (fs.existsSync(tradesFile)) {
      const tradesData = fs.readFileSync(tradesFile, 'utf8');
      trades = JSON.parse(tradesData);
    }
    
    // Sort trades by timestamp descending (most recent first)
    trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return NextResponse.json({
      trades,
      date,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === 'OPEN').length,
      closedTrades: trades.filter(t => t.status === 'CLOSED').length
    });
    
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}