const axios = require('axios');
const EventEmitter = require('events');

class PublicDataFetcher extends EventEmitter {
  constructor(baseUrl = 'https://api.india.delta.exchange') {
    super();
    this.baseUrl = baseUrl;
    this.wsUrl = 'wss://socket.delta.exchange';
    
    this.isRunning = false;
    this.ws = null;
    this.pollInterval = null;
    this.lastCandleTime = null;
    this.candleHistory = [];
    this.maxHistoryLength = 100;
    this.symbol = null;
    this.pollIntervalMs = 60000; // Poll every minute for new candles
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.useWebSocket = true;
    this.lastTickerPrice = null;
    this.currentCandle = null;
    this.candleStartTime = null;
  }

  async makeRequest(endpoint, params = {}) {
    const url = this.baseUrl + endpoint + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
    
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'public-trading-client/1.0.0'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Public API request failed: ${error.message}`);
      throw error;
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

    console.log(`📊 Fetching public data: ${this.baseUrl}/v2/history/candles`);
    const data = await this.makeRequest('/v2/history/candles', params);
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
    console.log(`📊 Fetching initial candle history for ${symbol} (PUBLIC API)...`);
    
    try {
      const history = await this.getInitialHistory(symbol);
      this.candleHistory = history;
      
      if (history.length > 0) {
        this.lastCandleTime = history[history.length - 1].timestamp.getTime();
        console.log(`✅ Loaded ${history.length} historical candles (PUBLIC)`);
        console.log(`📈 Latest candle: ${new Date(this.lastCandleTime).toISOString()}`);
        
        // Get current price from last candle
        this.lastTickerPrice = history[history.length - 1].close;
        
        setTimeout(() => {
          this.emit('historyLoaded', this.candleHistory);
        }, 100);
      } else {
        throw new Error('No historical data received');
      }
    } catch (error) {
      console.error(`❌ Failed to load public history: ${error.message}`);
      throw error;
    }
  }

  initializeWebSocket() {
    if (!this.useWebSocket) return;

    try {
      const WebSocket = require('ws');
      
      console.log(`🔌 Connecting to PUBLIC WebSocket: ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ PUBLIC WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Subscribe to ticker data for real-time price updates
        const subscribeMessage = {
          type: 'subscribe',
          channels: [
            {
              name: 'v2/ticker',
              symbols: [this.symbol]
            }
          ]
        };
        
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log(`📡 Subscribed to ${this.symbol} ticker data (PUBLIC)`);
        
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
        console.log(`🔌 PUBLIC WebSocket disconnected: ${code} ${reason}`);
        this.handleWebSocketDisconnect();
      });

      this.ws.on('error', (error) => {
        console.error(`❌ PUBLIC WebSocket error: ${error.message}`);
        this.handleWebSocketDisconnect();
      });

    } catch (error) {
      console.error(`❌ WebSocket not available: ${error.message}`);
      console.log('📡 Using REST API polling only');
      this.useWebSocket = false;
      this.startRestPolling();
    }
  }

  handleWebSocketMessage(message) {
    if (message.type === 'ticker' && message.symbol === this.symbol) {
      const price = parseFloat(message.mark_price || message.close || message.last_traded_price);
      const volume = parseFloat(message.volume_24h || 0);
      
      if (price) {
        this.lastTickerPrice = price;
        this.updateCurrentCandle(price, volume);
      }
    }
  }

  initializeCurrentCandle() {
    const now = new Date();
    const candleStart = new Date(now);
    candleStart.setSeconds(0, 0); // Start at the beginning of the minute
    
    this.candleStartTime = candleStart.getTime();
    this.currentCandle = {
      timestamp: candleStart,
      open: this.lastTickerPrice || 121000, // Use last known price
      high: this.lastTickerPrice || 121000,
      low: this.lastTickerPrice || 121000,
      close: this.lastTickerPrice || 121000,
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

    console.log(`🕐 New candle (WS): ${this.currentCandle.timestamp.toISOString()} | O:${this.currentCandle.open} H:${this.currentCandle.high} L:${this.currentCandle.low} C:${this.currentCandle.close} V:${this.currentCandle.volume}`);
    
    // Emit new candle event
    this.emit('newCandle', { ...this.currentCandle }, [...this.candleHistory]);

    // Start new candle
    this.initializeCurrentCandle();
  }

  handleWebSocketDisconnect() {
    if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect PUBLIC WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.initializeWebSocket();
      }, 5000 * this.reconnectAttempts);
    } else if (this.isRunning) {
      console.log('❌ Max reconnection attempts reached, using REST API only');
      this.useWebSocket = false;
      this.startRestPolling();
    }
  }

  startRestPolling() {
    console.log(`📡 Starting PUBLIC REST API polling (every ${this.pollIntervalMs/1000}s)`);
    
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

      const data = await this.makeRequest('/v2/history/candles', params);
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
      console.log('⚠️  PUBLIC data fetcher is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting PUBLIC live data feed for ${symbol}`);
    console.log(`📡 Mode: ${this.useWebSocket ? 'WebSocket + REST fallback (PUBLIC)' : 'REST API only (PUBLIC)'}`);

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
      console.log('⚠️  PUBLIC data fetcher is not running');
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

    console.log('🛑 PUBLIC live data feed stopped');
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
      connectionType: this.ws?.readyState === 1 ? 'WebSocket (PUBLIC)' : 'REST API (PUBLIC)',
      wsConnected: this.ws?.readyState === 1,
      lastPrice: this.lastTickerPrice,
      pollInterval: this.pollIntervalMs
    };
  }
}

module.exports = PublicDataFetcher;