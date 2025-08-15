const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Hybrid Data Fetcher - Combines WebSocket for speed with REST API for accuracy
 * Solves the price discrepancy issue between WebSocket and REST API
 */
class LiveDataFetcherHybrid extends EventEmitter {
  constructor(apiKey, apiSecret, baseUrl = 'https://api.india.delta.exchange') {
    super();
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    this.wsUrl = 'wss://socket.delta.exchange';
    
    this.isRunning = false;
    this.ws = null;
    this.restInterval = null;
    this.lastCandleTime = null;
    this.candleHistory = [];
    this.maxHistoryLength = 100;
    this.symbol = null;
    
    // Hybrid approach settings
    this.useWebSocket = true;
    this.restUpdateInterval = 5000; // Update from REST every 5 seconds for accuracy
    this.lastRestUpdate = 0;
    this.lastRestPrice = null;
    
    // Candle construction
    this.currentCandle = null;
    this.candleStartTime = null;
    
    // Price reconciliation
    this.priceBuffer = [];
    this.maxPriceBufferSize = 10;
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
      'User-Agent': 'hybrid-data-fetcher/1.0.0'
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
      console.error(`⚠️ REST API request failed: ${error.message}`);
      return null;
    }
  }

  async getTickerData() {
    try {
      const data = await this.makeRequest('GET', `/v2/tickers/${this.symbol}`);
      if (data && data.result) {
        return {
          close: parseFloat(data.result.close),
          mark_price: parseFloat(data.result.mark_price),
          volume: parseFloat(data.result.volume || 0),
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error(`⚠️ Failed to get ticker data: ${error.message}`);
    }
    return null;
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
    console.log(`📊 [HYBRID] Fetching initial candle history for ${symbol}...`);
    
    try {
      const history = await this.getInitialHistory(symbol);
      this.candleHistory = history;
      
      if (history.length > 0) {
        this.lastCandleTime = history[history.length - 1].timestamp.getTime();
        console.log(`✅ [HYBRID] Loaded ${history.length} historical candles`);
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
      const WebSocket = require('ws');
      
      console.log(`🔌 [HYBRID] Connecting to WebSocket: ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ [HYBRID] WebSocket connected');
        
        const subscribeMessage = {
          type: 'subscribe',
          payload: {
            channels: [
              {
                name: 'v2/ticker',
                symbols: [this.symbol]
              }
            ]
          }
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log(`📡 [HYBRID] Subscribed to ${this.symbol} WebSocket ticker`);
        
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
        console.log(`🔌 [HYBRID] WebSocket disconnected: ${code} ${reason}`);
        this.handleWebSocketDisconnect();
      });

      this.ws.on('error', (error) => {
        console.error(`❌ [HYBRID] WebSocket error: ${error.message}`);
        this.handleWebSocketDisconnect();
      });

    } catch (error) {
      console.error(`❌ WebSocket not available: ${error.message}`);
      this.useWebSocket = false;
    }
  }

  async handleWebSocketMessage(message) {
    if (message.type === 'v2/ticker' && (!message.symbol || message.symbol === this.symbol)) {
      const wsPrice = parseFloat(message.close || message.mark_price);
      const wsVolume = parseFloat(message.volume || 0);
      
      // Check if we need a REST API update for accuracy
      const now = Date.now();
      if (now - this.lastRestUpdate > this.restUpdateInterval) {
        this.lastRestUpdate = now;
        
        // Fetch fresh data from REST API
        const restData = await this.getTickerData();
        if (restData) {
          this.lastRestPrice = restData.close;
          
          // Calculate difference
          const priceDiff = Math.abs(wsPrice - restData.close);
          const percentDiff = (priceDiff / restData.close * 100);
          
          if (percentDiff > 0.1) { // If difference > 0.1%
            console.log(`⚠️ [HYBRID] Price correction: WS=$${wsPrice.toFixed(2)} → REST=$${restData.close.toFixed(2)} (${percentDiff.toFixed(3)}% diff)`);
            
            // Use REST price for better accuracy
            this.updateCurrentCandle(restData.close, restData.volume);
          } else {
            // Prices are close enough, use WebSocket price
            this.updateCurrentCandle(wsPrice, wsVolume);
          }
        } else {
          // REST failed, use WebSocket
          this.updateCurrentCandle(wsPrice, wsVolume);
        }
      } else {
        // Use WebSocket price with optional smoothing
        const smoothedPrice = this.getSmoothPrice(wsPrice);
        this.updateCurrentCandle(smoothedPrice, wsVolume);
      }
    }
  }

  getSmoothPrice(newPrice) {
    // Add to price buffer
    this.priceBuffer.push(newPrice);
    
    // Limit buffer size
    if (this.priceBuffer.length > this.maxPriceBufferSize) {
      this.priceBuffer.shift();
    }
    
    // If we have REST price and it's recent, weight it more heavily
    if (this.lastRestPrice && (Date.now() - this.lastRestUpdate) < 10000) {
      // Weighted average: 70% REST, 30% WebSocket
      return this.lastRestPrice * 0.7 + newPrice * 0.3;
    }
    
    // Otherwise, use simple moving average of WebSocket prices
    const avg = this.priceBuffer.reduce((a, b) => a + b, 0) / this.priceBuffer.length;
    return avg;
  }

  initializeCurrentCandle() {
    const now = new Date();
    const candleStart = new Date(now);
    candleStart.setSeconds(0, 0);
    
    this.candleStartTime = candleStart.getTime();
    this.currentCandle = {
      timestamp: candleStart,
      open: this.lastRestPrice || 120000,
      high: this.lastRestPrice || 120000,
      low: this.lastRestPrice || 120000,
      close: this.lastRestPrice || 120000,
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

    // Complete candle every minute
    if (candleAge >= 60000) {
      this.completeCurrentCandle();
    }
  }

  completeCurrentCandle() {
    if (!this.currentCandle) return;

    this.candleHistory.push({ ...this.currentCandle });
    
    if (this.candleHistory.length > this.maxHistoryLength) {
      this.candleHistory = this.candleHistory.slice(-this.maxHistoryLength);
    }

    this.lastCandleTime = this.currentCandle.timestamp.getTime();

    console.log(`🕐 [HYBRID] New candle: ${this.currentCandle.timestamp.toISOString()} | O:${this.currentCandle.open.toFixed(2)} H:${this.currentCandle.high.toFixed(2)} L:${this.currentCandle.low.toFixed(2)} C:${this.currentCandle.close.toFixed(2)} V:${this.currentCandle.volume}`);
    
    this.emit('newCandle', { ...this.currentCandle }, [...this.candleHistory]);

    this.initializeCurrentCandle();
  }

  handleWebSocketDisconnect() {
    if (this.isRunning) {
      console.log('🔄 [HYBRID] Attempting to reconnect WebSocket...');
      setTimeout(() => {
        this.initializeWebSocket();
      }, 5000);
    }
  }

  startRestPolling() {
    console.log(`📡 [HYBRID] Starting REST API verification polling (every ${this.restUpdateInterval/1000}s)`);
    
    this.restInterval = setInterval(async () => {
      if (!this.isRunning || !this.symbol) return;
      
      const restData = await this.getTickerData();
      if (restData) {
        this.lastRestPrice = restData.close;
        this.lastRestUpdate = Date.now();
        
        // Update candle with REST data for accuracy
        this.updateCurrentCandle(restData.close, restData.volume);
      }
    }, this.restUpdateInterval);
  }

  start(symbol) {
    if (this.isRunning) {
      console.log('⚠️  [HYBRID] Data fetcher is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 [HYBRID] Starting hybrid data feed for ${symbol}`);
    console.log(`📡 Mode: WebSocket + REST API verification`);

    this.initializeHistory(symbol).then(() => {
      // Start WebSocket for real-time updates
      if (this.useWebSocket) {
        this.initializeWebSocket();
      }
      
      // Start REST polling for accuracy verification
      this.startRestPolling();
      
      this.emit('started');
    }).catch(error => {
      this.emit('error', error);
      this.stop();
    });
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  [HYBRID] Data fetcher is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.restInterval) {
      clearInterval(this.restInterval);
      this.restInterval = null;
    }

    console.log('🛑 [HYBRID] Data feed stopped');
    this.emit('stopped');
  }

  getCurrentHistory() {
    return [...this.candleHistory];
  }

  getLastCandle() {
    return this.candleHistory.length > 0 ? this.candleHistory[this.candleHistory.length - 1] : null;
  }

  isConnected() {
    return this.isRunning;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      historyLength: this.candleHistory.length,
      lastCandleTime: this.lastCandleTime ? new Date(this.lastCandleTime) : null,
      connectionType: 'Hybrid (WebSocket + REST)',
      wsConnected: this.ws?.readyState === 1,
      lastRestPrice: this.lastRestPrice,
      lastRestUpdate: this.lastRestUpdate ? new Date(this.lastRestUpdate) : null
    };
  }
}

module.exports = LiveDataFetcherHybrid;