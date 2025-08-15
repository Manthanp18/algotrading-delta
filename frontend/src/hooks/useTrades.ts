import { useState, useEffect, useCallback } from 'react';
import { Trade, TradesResponse, ApiError } from '@/types/trading';
import { API_ENDPOINTS } from '@/utils/constants';

interface UseTradesReturn {
  trades: Trade[];
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export const useTrades = (date: string): UseTradesReturn => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_ENDPOINTS.TRADES}?date=${date}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: TradesResponse = await response.json();
      setTrades(data.trades || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({
        message: errorMessage,
        status: err instanceof Error && 'status' in err ? (err as Error & { status: number }).status : undefined
      });
      console.error('Error fetching trades:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  return {
    trades,
    loading,
    error,
    refetch: fetchTrades
  };
};