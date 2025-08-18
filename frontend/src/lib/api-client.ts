/**
 * API Client for backend communication
 * Uses environment variables for API URLs
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8080');

export async function fetchFromBackend(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;
  
  try {
    // Create timeout signal if available
    let timeoutSignal;
    try {
      timeoutSignal = AbortSignal.timeout(10000); // 10 second timeout
    } catch {
      // Fallback for environments that don't support AbortSignal.timeout
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000);
      timeoutSignal = controller.signal;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: timeoutSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from ${endpoint}:`, error);
    
    // During build time or when API is unavailable, return empty data instead of failing
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
      console.warn('API call failed, returning empty data');
      return getEmptyResponse(endpoint);
    }
    
    throw error;
  }
}

// Provide minimal empty responses during build time - NO DEMO DATA
function getEmptyResponse(endpoint: string) {
  if (endpoint.includes('/api/session')) {
    return {
      error: 'Backend API not available',
      symbol: null,
      strategy: null,
      portfolio: null,
      metrics: null
    };
  }
  
  if (endpoint.includes('/api/trades')) {
    return {
      error: 'Backend API not available',
      trades: [],
      totalTrades: 0
    };
  }
  
  if (endpoint.includes('/api/analytics')) {
    return {
      error: 'Backend API not available',
      totalTrades: 0,
      winRate: 0,
      totalPnL: 0,
      pnlChartData: [],
      hourlyBreakdown: []
    };
  }
  
  if (endpoint.includes('/api/logs')) {
    return {
      error: 'Backend API not available',
      logs: [],
      totalLogs: 0,
      logLevel: 'all',
      lastUpdate: new Date().toISOString()
    };
  }
  
  return { error: 'Backend API not available' };
}

export const backendAPI = {
  // Session endpoints
  getSession: () => fetchFromBackend('/api/session'),
  
  // Trades endpoints
  getTrades: (date?: string) => {
    const params = date ? `?date=${date}` : '';
    return fetchFromBackend(`/api/trades${params}`);
  },
  
  // Analytics endpoints
  getAnalytics: (date?: string) => {
    const params = date ? `?date=${date}` : '';
    return fetchFromBackend(`/api/analytics${params}`);
  },
  
  // Logs endpoints
  getLogs: (level?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchFromBackend(`/api/logs${query}`);
  },
  
  // Health check
  health: () => fetchFromBackend('/health'),
};