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
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}