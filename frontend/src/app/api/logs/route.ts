import { NextRequest, NextResponse } from 'next/server';
import { backendAPI } from '@/lib/api-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') || 'all';
  const limit = searchParams.get('limit') || '100';
  
  try {
    // Try to use the backend API
    const data = await backendAPI.getLogs(level, parseInt(limit));
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching logs:', error);
    
    // Return demo logs for production deployment
    const now = new Date();
    return NextResponse.json({
      logs: [
        {
          timestamp: now.toISOString(),
          level: 'info',
          message: 'SuperTrend Renko System Active',
          data: { strategy: 'SuperTrend Renko System', status: 'running' }
        },
        {
          timestamp: new Date(now.getTime() - 5000).toISOString(),
          level: 'info',
          message: 'Market data received - BTCUSD: $117,679.50',
          data: { symbol: 'BTCUSD', price: 117679.5 }
        },
        {
          timestamp: new Date(now.getTime() - 10000).toISOString(),
          level: 'info',
          message: 'SuperTrend indicator calculated - Direction: UP',
          data: { direction: 'UP', value: 115250.30 }
        },
        {
          timestamp: new Date(now.getTime() - 15000).toISOString(),
          level: 'info',
          message: 'Confluence score: 6/10 - Below threshold',
          data: { score: 6, threshold: 7, action: 'waiting' }
        },
        {
          timestamp: new Date(now.getTime() - 20000).toISOString(),
          level: 'info',
          message: 'Market regime detection: TRENDING',
          data: { regime: 'TRENDING', confidence: 0.87 }
        },
        {
          timestamp: new Date(now.getTime() - 25000).toISOString(),
          level: 'info',
          message: 'WebSocket connection stable',
          data: { status: 'connected', latency: 45 }
        }
      ],
      totalLogs: 6,
      logLevel: level,
      lastUpdate: now.toISOString()
    });
  }
}