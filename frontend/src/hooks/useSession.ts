import { useState, useEffect, useCallback } from 'react';
import { SessionData, ApiError } from '@/types/trading';
import { API_ENDPOINTS, REFRESH_INTERVALS } from '@/utils/constants';

interface UseSessionReturn {
  sessionData: SessionData | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export const useSession = (autoRefresh: boolean = true): UseSessionReturn => {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(API_ENDPOINTS.SESSION);
      
      if (!response.ok) {
        if (response.status === 404) {
          setSessionData(null);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SessionData = await response.json();
      
      // Calculate additional metrics
      const uptime = new Date().getTime() - new Date(data.startTime).getTime();
      const unrealizedPnL = data.portfolio.positions.reduce((total, pos) => {
        if (pos.quantity > 0) {
          return total + ((data.lastPrice - pos.avgPrice) * pos.quantity);
        }
        return total;
      }, 0);
      
      setSessionData({
        ...data,
        uptime,
        unrealizedPnL,
        realizedPnL: data.metrics.totalPnl,
        totalPnL: data.metrics.totalPnl + unrealizedPnL
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({
        message: errorMessage,
        status: err instanceof Error && 'status' in err ? (err as Error & { status: number }).status : undefined
      });
      console.error('Error fetching session data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSession, REFRESH_INTERVALS.SESSION_DATA);
      return () => clearInterval(interval);
    }
  }, [fetchSession, autoRefresh]);

  return {
    sessionData,
    loading,
    error,
    refetch: fetchSession
  };
};