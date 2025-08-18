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
    
    // Return empty response when backend is not available - NO DEMO DATA
    return NextResponse.json({
      logs: [],
      totalLogs: 0,
      logLevel: level,
      lastUpdate: new Date().toISOString(),
      error: 'Backend API not available'
    });
  }
}