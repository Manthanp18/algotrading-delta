/**
 * Delta Exchange API data provider
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Candle, TickerData } from '@/types';
import { createLogger } from '@/utils/logger';
import config from '@/config';

export interface DeltaApiConfig {
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  timeout: number;
  retries: number;
}

export interface CandleRequest {
  symbol: string;
  resolution: string;
  start: number;
  end: number;
}

export class DeltaExchangeProvider extends EventEmitter {
  private logger = createLogger('DeltaExchangeProvider');
  private httpClient: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private config: DeltaApiConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private subscribedSymbols = new Set<string>();

  constructor(apiConfig: DeltaApiConfig) {
    super();
    this.config = apiConfig;
    
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'api-key': this.config.apiKey })
      }
    });

    this.setupHttpInterceptors();
    this.logger.info('Delta Exchange provider initialized', { 
      baseUrl: this.config.baseUrl,
      hasAuth: !!this.config.apiKey 
    });
  }

  /**
   * Get historical candlestick data
   */
  async getCandles(request: CandleRequest): Promise<Candle[]> {
    this.logger.debug('Fetching historical candles', request);

    try {
      const response = await this.httpClient.get('/v2/history/candles', {
        params: {
          symbol: request.symbol,
          resolution: request.resolution,
          start: request.start,
          end: request.end
        }
      });

      const candles = this.parseCandles(response.data);
      this.logger.info('Historical candles fetched', { 
        symbol: request.symbol,
        count: candles.length,
        period: `${new Date(request.start * 1000).toISOString()} - ${new Date(request.end * 1000).toISOString()}`
      });

      return candles;

    } catch (error) {
      this.logger.error('Failed to fetch historical candles', { request, error });
      throw new Error(`Failed to fetch candles: ${error}`);
    }
  }

  /**
   * Get current ticker data
   */
  async getTicker(symbol: string): Promise<TickerData> {
    this.logger.debug('Fetching ticker data', { symbol });

    try {
      const response = await this.httpClient.get(`/v2/tickers/${symbol}`);
      
      const ticker = this.parseTicker(response.data.result, symbol);
      this.logger.debug('Ticker data fetched', ticker);

      return ticker;

    } catch (error) {
      this.logger.error('Failed to fetch ticker data', { symbol, error });
      throw new Error(`Failed to fetch ticker: ${error}`);
    }
  }

  /**
   * Get multiple tickers
   */
  async getTickers(symbols?: string[]): Promise<TickerData[]> {
    this.logger.debug('Fetching multiple tickers', { symbols });

    try {
      const response = await this.httpClient.get('/v2/tickers');
      
      let tickers = response.data.result.map((item: any) => 
        this.parseTicker(item, item.symbol)
      );

      if (symbols && symbols.length > 0) {
        tickers = tickers.filter((ticker: TickerData) => 
          symbols.includes(ticker.symbol)
        );
      }

      this.logger.debug('Multiple tickers fetched', { count: tickers.length });
      return tickers;

    } catch (error) {
      this.logger.error('Failed to fetch tickers', { symbols, error });
      throw new Error(`Failed to fetch tickers: ${error}`);
    }
  }

  /**
   * Connect to WebSocket for real-time data
   */
  connectWebSocket(): void {
    if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
      this.logger.warn('WebSocket already connected');
      return;
    }

    const wsUrl = this.config.baseUrl.replace('http', 'ws') + '/v2/websocket';
    this.logger.info('Connecting to WebSocket', { url: wsUrl });

    try {
      this.wsClient = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.logger.error('Failed to create WebSocket connection', { error });
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to real-time ticker updates
   */
  subscribeToTicker(symbol: string): void {
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket not connected, cannot subscribe', { symbol });
      return;
    }

    const subscribeMessage = {
      type: 'subscribe',
      payload: {
        channels: [
          {
            name: 'v2/ticker',
            symbols: [symbol]
          }
        ]
      }
    };

    this.wsClient.send(JSON.stringify(subscribeMessage));
    this.subscribedSymbols.add(symbol);
    this.logger.info('Subscribed to ticker updates', { symbol });
  }

  /**
   * Unsubscribe from ticker updates
   */
  unsubscribeFromTicker(symbol: string): void {
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMessage = {
      type: 'unsubscribe',
      payload: {
        channels: [
          {
            name: 'v2/ticker',
            symbols: [symbol]
          }
        ]
      }
    };

    this.wsClient.send(JSON.stringify(unsubscribeMessage));
    this.subscribedSymbols.delete(symbol);
    this.logger.info('Unsubscribed from ticker updates', { symbol });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
      this.subscribedSymbols.clear();
      this.logger.info('WebSocket disconnected');
    }
  }

  /**
   * Check if provider is connected
   */
  isConnected(): boolean {
    return this.wsClient?.readyState === WebSocket.OPEN;
  }

  /**
   * Parse candle data from API response
   */
  private parseCandles(data: any): Candle[] {
    if (!data.result || !Array.isArray(data.result)) {
      throw new Error('Invalid candle data format');
    }

    return data.result.map((item: any) => ({
      timestamp: item.time * 1000, // Convert to milliseconds
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume)
    }));
  }

  /**
   * Parse ticker data from API response
   */
  private parseTicker(data: any, symbol: string): TickerData {
    return {
      symbol,
      price: parseFloat(data.close || data.last_price || 0),
      volume: parseFloat(data.volume || 0),
      timestamp: Date.now(),
      high24h: parseFloat(data.high || 0),
      low24h: parseFloat(data.low || 0),
      change24h: parseFloat(data.change_24_hour || 0)
    };
  }

  /**
   * Setup HTTP client interceptors
   */
  private setupHttpInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('HTTP request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        this.logger.error('HTTP request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => {
        this.logger.debug('HTTP response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      async (error) => {
        const config = error.config;
        
        if (error.response?.status === 429) {
          // Rate limit handling
          const retryAfter = error.response.headers['retry-after'] || 60;
          this.logger.warn('Rate limit hit, retrying after delay', { retryAfter });
          
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.httpClient.request(config);
        }

        if (error.response?.status >= 500 && config._retryCount < this.config.retries) {
          // Retry on server errors
          config._retryCount = (config._retryCount || 0) + 1;
          const delay = Math.pow(2, config._retryCount) * 1000; // Exponential backoff
          
          this.logger.warn('Server error, retrying', { 
            attempt: config._retryCount,
            delay,
            status: error.response.status 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.httpClient.request(config);
        }

        this.logger.error('HTTP response error', {
          status: error.response?.status,
          data: error.response?.data,
          url: config?.url
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wsClient) return;

    this.wsClient.on('open', () => {
      this.logger.info('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Resubscribe to channels if any
      for (const symbol of this.subscribedSymbols) {
        this.subscribeToTicker(symbol);
      }
    });

    this.wsClient.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        this.logger.error('Failed to parse WebSocket message', { error, data });
      }
    });

    this.wsClient.on('close', (code: number, reason: Buffer) => {
      this.logger.warn('WebSocket disconnected', { code, reason: reason.toString() });
      this.emit('disconnected', { code, reason: reason.toString() });
      this.scheduleReconnect();
    });

    this.wsClient.on('error', (error: Error) => {
      this.logger.error('WebSocket error', { error });
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    if (message.type === 'ticker' && message.symbol) {
      const ticker = this.parseTicker(message, message.symbol);
      this.emit('ticker', ticker);
      this.logger.debug('Ticker update received', { symbol: ticker.symbol, price: ticker.price });
    } else if (message.type === 'l2_orderbook' && message.symbol) {
      this.emit('orderbook', message);
    } else {
      this.logger.debug('Unknown WebSocket message type', { type: message.type });
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached, giving up');
      this.emit('reconnection_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.logger.info('Scheduling WebSocket reconnection', { 
      attempt: this.reconnectAttempts,
      delay 
    });

    setTimeout(() => {
      this.logger.info('Attempting WebSocket reconnection');
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnectWebSocket();
    this.removeAllListeners();
    this.logger.info('Delta Exchange provider destroyed');
  }
}