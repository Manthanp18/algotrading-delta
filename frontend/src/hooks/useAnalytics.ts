import { useState, useEffect, useCallback } from 'react';
import { Analytics, ApiError } from '@/types/trading';
import { API_ENDPOINTS } from '@/utils/constants';

interface UseAnalyticsReturn {
  analytics: Analytics | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

export const useAnalytics = (date: string): UseAnalyticsReturn => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_ENDPOINTS.ANALYTICS}?date=${date}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: Analytics = await response.json();
      setAnalytics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError({
        message: errorMessage,
        status: err instanceof Error && 'status' in err ? (err as Error & { status: number }).status : undefined
      });
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics
  };
};