const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');

class LiveDataFetcherWS extends EventEmitter {
  constructor(apiKey, apiSecret, baseUrl = 'https://api.india.delta.exchange') {
    super();
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    this.wsUrl = 'wss://socket.delta.exchange';
    
    this.isRunning = false;
    this.ws = null;
    this.pollInterval = null;
    this.lastCandleTime = null;
    this.candleHistory = [];
    this.maxHistoryLength = 100;
    this.symbol = null;
    this.pollIntervalMs = 300000; // Fallback polling every 5 minutes (reduced API costs)
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // Increased reconnection attempts to prefer WebSocket
    this.useWebSocket = true; // Primary mode
    this.lastTickerPrice = null;
    this.currentCandle = null;
    this.candleStartTime = null;
  }

  generateSignature(method, path, timestamp, body = '') {
    const payload = method + timestamp + path + body;
    return crypto.createHmac('sha256', this.apiSecret).update(payload).digest('hex');
  }

  async makeRequest(method, endpoint, params = {}) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = endpoint + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
    
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'live-trading-engine-ws/1.0.0'
    };

    if (this.apiKey && this.apiSecret && this.apiKey.length > 0 && this.apiSecret.length > 0) {
      const signature = this.generateSignature(method, path, timestamp);
      headers['api-key'] = this.apiKey;
      headers['timestamp'] = timestamp;
      headers['signature'] = signature;
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers,
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async getInitialHistory(symbol, resolution = '1m', periodMinutes = 100) {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (periodMinutes * 60);
    
    const params = {
      symbol: symbol,
      resolution: resolution,
      start: startTime,
      end: endTime
    };

    const data = await this.makeRequest('GET', '/v2/history/candles', params);
    return this.formatCandleData(data);
  }

  formatCandleData(rawData) {
    if (!rawData || !rawData.result) {
      throw new Error('Invalid candle data received');
    }

    return rawData.result.map(candle => ({
      timestamp: new Date(candle.time * 1000),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume || 0)
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  async initializeHistory(symbol) {
    this.symbol = symbol;
    console.log(`📊 Fetching initial candle history for ${symbol}...`);
    
    try {
      const history = await this.getInitialHistory(symbol);
      this.candleHistory = history;
      
      if (history.length > 0) {
        this.lastCandleTime = history[history.length - 1].timestamp.getTime();
        console.log(`✅ Loaded ${history.length} historical candles`);
        console.log(`📈 Latest candle: ${new Date(this.lastCandleTime).toISOString()}`);
        this.emit('historyLoaded', this.candleHistory);
      } else {
        throw new Error('No historical data received');
      }
    } catch (error) {
      console.error(`❌ Failed to load history: ${error.message}`);
      throw error;
    }
  }

  initializeWebSocket() {
    if (!this.useWebSocket) return;

    try {
      // Import WebSocket only when needed
      const WebSocket = require('ws');
      
      console.log(`🔌 Connecting to WebSocket: ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Subscribe to multiple channels for high-frequency data updates (1+ updates/second)
        const subscribeMessage = {
          type: 'subscribe',
          payload: {
            channels: [
              // Primary ticker channel
              {
                name: 'v2/ticker',
                symbols: [this.symbol]
              },
              // Alternative ticker channel for additional updates
              {
                name: 'ticker',
                symbols: [this.symbol]
              },
              // Order book for price updates from best bid/ask
              {
                name: 'l2_orderbook',
                symbols: [this.symbol]
              }
            ]
          }
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log(`📡 Subscribed to ${this.symbol} high-frequency channels (v2/ticker + ticker + orderbook)`);
        
        // Initialize current candle
        this.initializeCurrentCandle();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error(`❌ Error parsing WebSocket message: ${error.message}`);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket disconnected: ${code} ${reason}`);
        this.handleWebSocketDisconnect();
      });

      this.ws.on('error', (error) => {
        console.error(`❌ WebSocket error: ${error.message}`);
        this.handleWebSocketDisconnect();
      });

    } catch (error) {
      console.error(`❌ WebSocket not available: ${error.message}`);
      console.log('📡 Falling back to REST API polling');
      this.useWebSocket = false;
      this.startRestPolling();
    }
  }

  handleWebSocketMessage(message) {
    // Handle subscription confirmation
    if (message.type === 'subscriptions') {
      console.log('✅ WebSocket subscription confirmed:', JSON.stringify(message.channels));
      return;
    }
    
    let currentPrice = null;
    let currentVolume = 0;
    let priceSource = '';
    
    // Handle v2/ticker data (primary channel)
    if (message.type === 'v2/ticker') {
      currentPrice = parseFloat(message.close || message.mark_price || message.last_traded_price);
      currentVolume = parseFloat(message.volume || message.turnover_usd || 0);
      priceSource = 'v2/ticker';
      
      console.log(`📍 [${priceSource}] Price: $${currentPrice?.toFixed(2)} | Vol: ${currentVolume.toFixed(0)}`);
    }
    
    // Handle regular ticker updates (secondary channel)
    else if (message.type === 'ticker') {
      currentPrice = parseFloat(message.close || message.mark_price || message.last_traded_price);
      currentVolume = parseFloat(message.volume || 0);
      priceSource = 'ticker';
      
      console.log(`📍 [${priceSource}] Price: $${currentPrice?.toFixed(2)} | Vol: ${currentVolume.toFixed(0)}`);
    }
    
    // Handle order book updates (best bid/ask prices)
    else if (message.type === 'l2_orderbook') {
      if (message.buy && message.buy.length > 0) {
        const bestBid = parseFloat(message.buy[0].limit_price);
        currentPrice = bestBid;
        currentVolume = parseFloat(message.buy[0].size || 0);
        priceSource = 'orderbook';
        
        console.log(`📚 [${priceSource}] Best Bid: $${bestBid.toFixed(2)} | Size: ${currentVolume.toFixed(0)}`);
      }
    }
    
    // Update candle with any valid price data
    if (currentPrice && currentPrice > 0) {
      this.lastTickerPrice = currentPrice;
      this.updateCurrentCandle(currentPrice, currentVolume);
    }
    
    // Log other message types for debugging (limit to avoid spam)
    else if (!['v2/ticker', 'ticker', 'l2_orderbook'].includes(message.type)) {
      console.log(`📨 WebSocket message (${message.type}):`, JSON.stringify(message).substring(0, 200));
    }
  }

  initializeCurrentCandle() {
    const now = new Date();
    const candleStart = new Date(now);
    candleStart.setSeconds(0, 0); // Start at the beginning of the minute
    
    this.candleStartTime = candleStart.getTime();
    this.currentCandle = {
      timestamp: candleStart,
      open: this.lastTickerPrice || 65000, // Default if no price yet
      high: this.lastTickerPrice || 65000,
      low: this.lastTickerPrice || 65000,
      close: this.lastTickerPrice || 65000,
      volume: 0
    };
  }

  updateCurrentCandle(price, volume) {
    if (!this.currentCandle) {
      this.initializeCurrentCandle();
    }

    const now = Date.now();
    const candleAge = now - this.candleStartTime;
    
    // Update current candle
    if (this.currentCandle.open === null || this.currentCandle.open === undefined) {
      this.currentCandle.open = price;
    }
    
    this.currentCandle.high = Math.max(this.currentCandle.high, price);
    this.currentCandle.low = Math.min(this.currentCandle.low, price);
    this.currentCandle.close = price;
    this.currentCandle.volume = volume || this.currentCandle.volume;

    // Complete candle every minute (60 seconds)
    if (candleAge >= 60000) {
      this.completeCurrentCandle();
    }
  }

  completeCurrentCandle() {
    if (!this.currentCandle) return;

    // Add completed candle to history
    this.candleHistory.push({ ...this.currentCandle });
    
    // Trim history
    if (this.candleHistory.length > this.maxHistoryLength) {
      this.candleHistory = this.candleHistory.slice(-this.maxHistoryLength);
    }

    // Update last candle time
    this.lastCandleTime = this.currentCandle.timestamp.getTime();

    console.log(`🕐 New candle: ${this.currentCandle.timestamp.toISOString()} | O:${this.currentCandle.open} H:${this.currentCandle.high} L:${this.currentCandle.low} C:${this.currentCandle.close} V:${this.currentCandle.volume}`);
    
    // Emit new candle event
    this.emit('newCandle', { ...this.currentCandle }, [...this.candleHistory]);

    // Start new candle
    this.initializeCurrentCandle();
  }

  handleWebSocketDisconnect() {
    if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Cap backoff at 30 seconds to maintain responsiveness
      const backoffTime = Math.min(5000 * this.reconnectAttempts, 30000);
      setTimeout(() => {
        this.initializeWebSocket();
      }, backoffTime);
    } else if (this.isRunning) {
      console.log('❌ Max reconnection attempts reached, falling back to REST API (5-minute intervals)');
      this.useWebSocket = false;
      this.startRestPolling();
    }
  }

  startRestPolling() {
    console.log(`📡 Starting REST API polling (every ${this.pollIntervalMs/1000}s)`);
    
    this.pollInterval = setInterval(() => {
      this.pollForNewCandles();
    }, this.pollIntervalMs);
  }

  async pollForNewCandles() {
    if (!this.isRunning || !this.symbol) return;

    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - 300; // Get last 5 minutes
      
      const params = {
        symbol: this.symbol,
        resolution: '1m',
        start: startTime,
        end: endTime
      };

      const data = await this.makeRequest('GET', '/v2/history/candles', params);
      const latestCandles = this.formatCandleData(data);
      
      if (latestCandles.length > 0) {
        const newCandles = latestCandles.filter(candle => 
          candle.timestamp.getTime() > this.lastCandleTime
        );

        if (newCandles.length > 0) {
          this.candleHistory.push(...newCandles);
          
          if (this.candleHistory.length > this.maxHistoryLength) {
            this.candleHistory = this.candleHistory.slice(-this.maxHistoryLength);
          }

          this.lastCandleTime = Math.max(...newCandles.map(c => c.timestamp.getTime()));

          for (const candle of newCandles) {
            console.log(`🕐 New candle (REST): ${candle.timestamp.toISOString()} | O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);
            this.emit('newCandle', candle, this.candleHistory);
          }
        }
      }
    } catch (error) {
      console.error(`⚠️  Error polling for new candles: ${error.message}`);
      this.emit('error', error);
    }
  }

  start(symbol) {
    if (this.isRunning) {
      console.log('⚠️  Live data fetcher is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting live data feed for ${symbol}`);
    console.log(`📡 Mode: ${this.useWebSocket ? 'WebSocket + REST fallback' : 'REST API only'}`);

    // Initialize with historical data first
    this.initializeHistory(symbol).then(() => {
      // Start WebSocket connection for real-time data
      if (this.useWebSocket) {
        this.initializeWebSocket();
      } else {
        this.startRestPolling();
      }

      this.emit('started');
    }).catch(error => {
      this.emit('error', error);
      this.stop();
    });
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Live data fetcher is not running');
      return;
    }

    this.isRunning = false;
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('🛑 Live data feed stopped');
    this.emit('stopped');
  }

  getCurrentHistory() {
    return [...this.candleHistory];
  }

  getLastCandle() {
    return this.candleHistory.length > 0 ? this.candleHistory[this.candleHistory.length - 1] : null;
  }

  isConnected() {
    return this.isRunning && (this.ws?.readyState === 1 || this.pollInterval !== null);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      historyLength: this.candleHistory.length,
      lastCandleTime: this.lastCandleTime ? new Date(this.lastCandleTime) : null,
      connectionType: this.ws?.readyState === 1 ? 'WebSocket' : 'REST API',
      wsConnected: this.ws?.readyState === 1,
      lastPrice: this.lastTickerPrice,
      pollInterval: this.pollIntervalMs
    };
  }
}

module.exports = LiveDataFetcherWS;