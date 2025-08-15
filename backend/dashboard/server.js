const express = require('express');
const fs = require('fs-extra');
const path = require('path');

class DashboardServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.tradesDir = path.join(__dirname, 'trades');
    this.isRunning = false;
    
    fs.ensureDirSync(this.tradesDir);
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.use(express.static(__dirname));
    
    this.app.get('/api/dashboard', async (req, res) => {
      try {
        res.json(await this.getDashboardData());
      } catch (error) {
        console.error('Dashboard API error:', error.message);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
      }
    });
    
    this.app.get('/api/trades', async (req, res) => {
      try {
        res.json(await this.getRecentTrades());
      } catch (error) {
        console.error('Trades API error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trades' });
      }
    });
    
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
    });
    
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });
  }
  
  async getDashboardData() {
    try {
      const sessionFile = path.join(this.tradesDir, 'current_session.json');
      let sessionData = {};
      
      if (await fs.pathExists(sessionFile)) {
        sessionData = await fs.readJson(sessionFile);
      }
      
      const recentTrades = await this.getRecentTrades(10);
      const completedTrades = recentTrades.filter(trade => trade.status === 'CLOSED');
      const winningTrades = completedTrades.filter(trade => (trade.pnl || 0) > 0);
      const totalPnL = completedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      
      return {
        portfolio: sessionData.portfolio || {
          equity: sessionData.initialCapital || 0,
          totalReturn: 0,
          cash: sessionData.initialCapital || 0
        },
        metrics: {
          totalTrades: completedTrades.length,
          winningTrades: winningTrades.length,
          losingTrades: completedTrades.length - winningTrades.length,
          winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
          totalPnL: totalPnL,
          ...sessionData.metrics
        },
        symbol: sessionData.symbol || 'BTCUSD',
        strategy: sessionData.strategy || 'Confluence Scalping Strategy',
        uptime: sessionData.startTime ? Date.now() - new Date(sessionData.startTime).getTime() : 0,
        lastCandleTime: sessionData.lastCandleTime,
        lastPrice: sessionData.lastPrice,
        openPositions: sessionData.openPositions || 0,
        recentTrades: recentTrades,
        serverTime: new Date().toISOString(),
        isRunning: this.isRunning
      };
      
    } catch (error) {
      console.error('Error getting dashboard data:', error.message);
      return {
        portfolio: { equity: 0, totalReturn: 0 },
        metrics: { totalTrades: 0, winRate: 0, totalPnL: 0 },
        symbol: 'BTCUSD',
        strategy: 'Unknown',
        uptime: 0,
        recentTrades: [],
        error: error.message
      };
    }
  }
  
  async getRecentTrades(limit = 20) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayFile = path.join(this.tradesDir, `trades_${today}.json`);
      
      let trades = [];
      
      if (await fs.pathExists(todayFile)) {
        trades = await fs.readJson(todayFile);
      }
      
      if (trades.length < limit) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const yesterdayFile = path.join(this.tradesDir, `trades_${yesterday}.json`);
        
        if (await fs.pathExists(yesterdayFile)) {
          const yesterdayTrades = await fs.readJson(yesterdayFile);
          trades = [...yesterdayTrades, ...trades];
        }
      }
      
      return trades
        .sort((a, b) => new Date(b.entryTime || b.timestamp) - new Date(a.entryTime || a.timestamp))
        .slice(0, limit);
        
    } catch (error) {
      console.error('Error getting recent trades:', error.message);
      return [];
    }
  }
  
  async saveTrade(trade) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayFile = path.join(this.tradesDir, `trades_${today}.json`);
      
      let trades = [];
      if (await fs.pathExists(todayFile)) {
        trades = await fs.readJson(todayFile);
      }
      
      trades.push({ ...trade, timestamp: new Date().toISOString() });
      await fs.writeJson(todayFile, trades, { spaces: 2 });
      console.log(`💾 Trade saved: ${trade.type} ${trade.quantity} at $${trade.entryPrice || trade.price}`);
      
    } catch (error) {
      console.error('Error saving trade:', error.message);
    }
  }
  
  async updateSessionData(sessionData) {
    try {
      const sessionFile = path.join(this.tradesDir, 'current_session.json');
      await fs.writeJson(sessionFile, { ...sessionData, lastUpdate: new Date().toISOString() }, { spaces: 2 });
    } catch (error) {
      console.error('Error updating session data:', error.message);
    }
  }
  
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Dashboard server already running');
      return;
    }
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.isRunning = true;
        console.log(`📊 Dashboard server started on http://localhost:${this.port}`);
        console.log(`🌐 Access your dashboard at: http://localhost:${this.port}`);
        resolve();
      });
    });
  }
  
  async stop() {
    if (!this.isRunning) return;
    
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('🛑 Dashboard server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  getUrl() {
    return this.isRunning ? `http://localhost:${this.port}` : null;
  }
}

module.exports = DashboardServer;