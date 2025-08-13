const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');

class LiveDataFetcher extends EventEmitter {
  constructor(apiKey, apiSecret, baseUrl = 'https://api.india.delta.exchange') {
    super();
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    this.isRunning = false;
    this.pollInterval = null;
    this.lastCandleTime = null;
    this.candleHistory = [];
    this.maxHistoryLength = 100; // Keep last 100 candles for strategy
    this.symbol = null;
    this.pollIntervalMs = 10000; // Poll every 10 seconds for new data
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
      'User-Agent': 'live-trading-engine/1.0.0'
    };

    // Only add auth headers if we have valid credentials
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

  async getLatestCandle(symbol, resolution = '1m') {
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - 300; // Get last 5 minutes of data
    
    const params = {
      symbol: symbol,
      resolution: resolution,
      start: startTime,
      end: endTime
    };

    const data = await this.makeRequest('GET', '/v2/history/candles', params);
    return this.formatCandleData(data);
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

  async pollForNewCandles() {
    if (!this.isRunning || !this.symbol) return;

    try {
      const latestCandles = await this.getLatestCandle(this.symbol);
      
      if (latestCandles.length > 0) {
        // Check for new candles
        const newCandles = latestCandles.filter(candle => 
          candle.timestamp.getTime() > this.lastCandleTime
        );

        if (newCandles.length > 0) {
          // Add new candles to history
          this.candleHistory.push(...newCandles);
          
          // Trim history to max length
          if (this.candleHistory.length > this.maxHistoryLength) {
            this.candleHistory = this.candleHistory.slice(-this.maxHistoryLength);
          }

          // Update last candle time
          this.lastCandleTime = Math.max(...newCandles.map(c => c.timestamp.getTime()));

          // Emit events for each new candle
          for (const candle of newCandles) {
            console.log(`🕐 New candle: ${candle.timestamp.toISOString()} | O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);
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

    // Initialize with historical data first
    this.initializeHistory(symbol).then(() => {
      // Start polling for new candles
      this.pollInterval = setInterval(() => {
        this.pollForNewCandles();
      }, this.pollIntervalMs);

      console.log(`📡 Live polling started (every ${this.pollIntervalMs/1000}s)`);
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
    return this.isRunning;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      symbol: this.symbol,
      historyLength: this.candleHistory.length,
      lastCandleTime: this.lastCandleTime ? new Date(this.lastCandleTime) : null,
      pollInterval: this.pollIntervalMs
    };
  }
}

module.exports = LiveDataFetcher;