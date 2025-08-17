/**
 * API Client for backend communication
 * Uses environment variables for API URLs
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function fetchFromBackend(endpoint: string, options?: RequestInit) {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from ${endpoint}:`, error);
    throw error;
  }
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
  
  // Health check
  health: () => fetchFromBackend('/health'),
};