const axios = require('axios');
const crypto = require('crypto');

class DeltaExchangeDataFetcher {
  constructor(apiKey, apiSecret, baseUrl = 'https://api.india.delta.exchange') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
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
      'User-Agent': 'backtesting-engine/1.0.0'
    };

    if (this.apiKey && this.apiSecret) {
      const signature = this.generateSignature(method, path, timestamp);
      headers['api-key'] = this.apiKey;
      headers['timestamp'] = timestamp;
      headers['signature'] = signature;
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers
      });
      return response.data;
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async getHistoricalCandles(symbol, resolution = '5m', startTime, endTime) {
    const params = {
      symbol: symbol,
      resolution: resolution
    };

    if (startTime) params.start = startTime;
    if (endTime) params.end = endTime;

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
    }));
  }

  async getAvailableProducts() {
    const data = await this.makeRequest('GET', '/products');
    return data.result || [];
  }
}

module.exports = DeltaExchangeDataFetcher;