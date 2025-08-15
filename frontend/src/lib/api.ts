/**
 * API utility functions
 */
import { ApiError } from '@/types/trading';
import { API_ENDPOINTS } from '@/utils/constants';

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = '', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        code: response.status.toString()
      };

      // Try to parse error details from response
      try {
        const errorData = await response.json();
        error.message = errorData.message || error.message;
        error.code = errorData.code || error.code;
      } catch {
        // Fallback to status text if JSON parsing fails
      }

      throw error;
    }

    return response.json();
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(endpoint, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    return this.request<T>(url.pathname + url.search);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Specific API methods
  async getTrades(date: string) {
    return this.get(API_ENDPOINTS.TRADES, { date });
  }

  async getSession() {
    return this.get(API_ENDPOINTS.SESSION);
  }

  async getAnalytics(date: string) {
    return this.get(API_ENDPOINTS.ANALYTICS, { date });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;