import axios from 'axios';
import crypto from 'crypto';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { deltaConfig } from '../config/deltaConfig.js';

class DeltaAPIService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = deltaConfig.apiKey;
    this.apiSecret = deltaConfig.apiSecret;
    this.baseUrl = deltaConfig.baseUrl;
    this.wsUrl = 'wss://socket.india.delta.exchange';
    this.ws = null;
    this.isWSConnected = false;
    this.reconnectInterval = null;
    this.heartbeatInterval = null;
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Rate limiting
    this.requestCount = 0;
    this.lastReset = Date.now();
  }

  // Generate signature for authenticated requests
  generateSignature(method, path, timestamp, body = '') {
    const message = method + timestamp + path + body;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  // Check rate limit
  checkRateLimit() {
    const now = Date.now();
    // Reset counter every 5 minutes
    if (now - this.lastReset > 5 * 60 * 1000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    
    if (this.requestCount >= deltaConfig.rateLimit.maxRequestsPer5Min) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
    
    this.requestCount++;
  }

  // Make public request (no authentication required)
  async makePublicRequest(method, endpoint, params = {}) {
    this.checkRateLimit();
    
    try {
      const fullUrl = `${this.baseUrl}${endpoint}`;
      console.log(`🌐 Making API request to: ${fullUrl}`);
      
      const response = await this.client.request({
        method,
        url: fullUrl,
        params
      });
      
      console.log(`✅ API Response status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error(`Public API request failed: ${method} ${endpoint}`, error.response?.data || error.message);
      throw new Error(`Delta API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get all products/instruments
  async getProducts() {
    return await this.makePublicRequest('GET', deltaConfig.endpoints.products);
  }

  // Get ticker for specific symbol
  async getTicker(symbol) {
    if (symbol) {
      // Use specific symbol endpoint format: /v2/tickers/{symbol}
      const endpoint = `${deltaConfig.endpoints.tickers}/${symbol}`;
      return await this.makePublicRequest('GET', endpoint);
    } else {
      // Get all tickers if no symbol specified
      return await this.makePublicRequest('GET', deltaConfig.endpoints.tickers);
    }
  }

  // Get historical candle data
  async getCandles(symbol, resolution = '1m', start, end) {
    const params = {
      symbol,
      resolution,
    };
    
    if (start) params.start = start;
    if (end) params.end = end;
    
    return await this.makePublicRequest('GET', deltaConfig.endpoints.candles, params);
  }

  // Test connection
  async testConnection() {
    try {
      await this.getProducts();
      console.log('Delta Exchange API connection successful');
      return true;
    } catch (error) {
      console.error('Delta Exchange API connection failed:', error.message);
      return false;
    }
  }

  // Get market data for strategy (helper method)
  async getMarketDataForStrategy(symbol) {
    try {
      const [ticker, candles] = await Promise.all([
        this.getTicker(symbol),
        this.getCandles(symbol, '1m', null, null)
      ]);

      return {
        ticker,
        candles: candles?.result || []
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  // WebSocket Connection Methods
  connectWebSocket(symbols = ['BTCUSD']) {
    if (this.ws && this.isWSConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log(`🚀 Connecting to Delta Exchange WebSocket: ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.on('open', () => {
        console.log('🔗 Connected to Delta Exchange WebSocket');
        this.isWSConnected = true;
        
        // Authenticate first, then subscribe
        this.authenticateWebSocket().then(() => {
          // Subscribe to ticker updates for specified symbols
          symbols.forEach(symbol => {
            this.subscribeToTicker(symbol);
          });
        });
        
        // Start heartbeat
        this.startHeartbeat();
        
        this.emit('wsConnected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 WebSocket message received:', JSON.stringify(message, null, 2));
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 Delta Exchange WebSocket disconnected: ${code} ${reason}`);
        this.isWSConnected = false;
        this.stopHeartbeat();
        
        // Attempt reconnection after delay
        this.scheduleReconnect();
        
        this.emit('wsDisconnected');
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.emit('wsError', error);
      });

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }

  async authenticateWebSocket() {
    if (!this.ws || !this.isWSConnected) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const path = '/ws';
    const signature = this.generateSignature(method, path, timestamp, '');

    const authMessage = {
      type: 'auth',
      payload: {
        api_key: this.apiKey,
        signature: signature,
        timestamp: timestamp
      }
    };

    console.log('🔐 Authenticating WebSocket connection...');
    this.ws.send(JSON.stringify(authMessage));
    console.log('📋 Auth message sent:', JSON.stringify(authMessage, null, 2));
  }

  subscribeToTicker(symbol) {
    if (!this.ws || !this.isWSConnected) return;

    // Delta Exchange WebSocket subscription format
    const subscribeMessage = {
      type: 'subscribe',
      payload: {
        channels: [
          {
            name: 'ticker',
            symbols: [symbol]
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`📡 Subscribed to ticker updates for ${symbol}`);
    console.log(`📋 Subscription message:`, JSON.stringify(subscribeMessage, null, 2));
  }

  handleWebSocketMessage(message) {
    console.log(`🔍 Processing WebSocket message type: ${message.type}`);
    
    switch (message.type) {
      case 'auth':
        if (message.success) {
          console.log('✅ WebSocket authentication successful!');
        } else {
          console.error('❌ WebSocket authentication failed:', message);
        }
        break;
        
      case 'subscriptions':
        console.log('✅ Subscription confirmed:', message);
        break;
        
      case 'ticker':
        if (message.symbol) {
          console.log(`💹 Received ticker update for ${message.symbol}`);
          const tickerData = {
            symbol: message.symbol,
            close: parseFloat(message.close),
            high: parseFloat(message.high || message.close),
            low: parseFloat(message.low || message.close),
            open: parseFloat(message.open || message.close),
            volume: parseFloat(message.volume || 0),
            timestamp: Date.now(),
            mark_price: parseFloat(message.mark_price || message.close)
          };
          
          console.log(`🚀 WEBSOCKET REAL-TIME UPDATE:`, tickerData);
          // Emit real-time price update
          this.emit('priceUpdate', tickerData);
        }
        break;
        
      case 'pong':
        console.log('💓 Heartbeat pong received');
        break;
        
      case 'error':
        console.error('❌ WebSocket error message:', message);
        break;
        
      default:
        console.log(`🤷 Unknown message type: ${message.type}`, message);
        break;
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isWSConnected) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectInterval) return;
    
    this.reconnectInterval = setTimeout(() => {
      console.log('🔄 Attempting WebSocket reconnection...');
      this.reconnectInterval = null;
      this.connectWebSocket();
    }, 5000); // Reconnect after 5 seconds
  }

  disconnectWebSocket() {
    this.stopHeartbeat();
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isWSConnected = false;
  }
}

export default DeltaAPIService;