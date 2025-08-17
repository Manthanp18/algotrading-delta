const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Enable CORS for all origins in production
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get current session data
app.get('/api/session', (req, res) => {
  try {
    // Try multiple possible locations for session data
    const possiblePaths = [
      path.join('/tmp', 'current_session.json'),
      path.join(__dirname, '..', 'dashboard', 'trades', 'current_session.json'),
      path.join(process.cwd(), 'dashboard', 'trades', 'current_session.json')
    ];
    
    let sessionData = null;
    let sessionFile = null;
    
    // Find the session file
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        sessionFile = filePath;
        break;
      }
    }
    
    if (sessionFile) {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      
      // Ensure strategy name is correct if it's still using old name
      if (sessionData.strategy === 'Confluence Scalping' || sessionData.strategy === 'Elite BTC Scalping') {
        sessionData.strategy = 'SuperTrend Renko System';
      }
      
      res.json(sessionData);
    } else {
      // Return minimal live data structure if no session file exists
      res.json({
        symbol: 'BTCUSD',
        strategy: 'SuperTrend Renko System',
        marketRegime: 'TRENDING',
        activeStrategy: 'PRIMARY',
        initialCapital: 100000,
        startTime: new Date().toISOString(),
        portfolio: {
          cash: 100000,
          equity: 100000,
          positions: [],
          totalReturn: 0
        },
        metrics: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnl: 0,
          maxDrawdown: 0,
          winRate: 0,
          lastUpdate: new Date().toISOString()
        },
        lastPrice: 0,
        openPositions: 0,
        lastUpdate: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Session API error:', error);
    res.status(500).json({ error: 'Failed to fetch session data' });
  }
});

// Get trades for a specific date
app.get('/api/trades', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Try multiple possible locations for trades data
    const possiblePaths = [
      path.join('/tmp', `trades_${date}.json`),
      path.join(__dirname, '..', 'dashboard', 'trades', `trades_${date}.json`),
      path.join(process.cwd(), 'dashboard', 'trades', `trades_${date}.json`)
    ];
    
    let trades = [];
    let tradesFile = null;
    
    // Find the trades file
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        tradesFile = filePath;
        break;
      }
    }
    
    if (tradesFile) {
      trades = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
    }
    
    res.json({
      trades,
      date,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === 'OPEN').length,
      closedTrades: trades.filter(t => t.status === 'CLOSED').length
    });
  } catch (error) {
    console.error('Trades API error:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get analytics data
app.get('/api/analytics', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Try multiple possible locations for trades data
    const possiblePaths = [
      path.join('/tmp', `trades_${date}.json`),
      path.join(__dirname, '..', 'dashboard', 'trades', `trades_${date}.json`),
      path.join(process.cwd(), 'dashboard', 'trades', `trades_${date}.json`)
    ];
    
    let trades = [];
    let tradesFile = null;
    
    // Find the trades file
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        tradesFile = filePath;
        break;
      }
    }
    
    if (tradesFile) {
      trades = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
    }
    
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl < 0);
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    
    res.json({
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnL,
      averagePnL: closedTrades.length > 0 ? totalPnL / closedTrades.length : 0,
      averageWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0,
      profitFactor: Math.abs(winningTrades.reduce((sum, t) => sum + t.pnl, 0) / (losingTrades.reduce((sum, t) => sum + t.pnl, 0) || 1)),
      maxWin: closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.pnl || 0)) : 0,
      maxLoss: closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.pnl || 0)) : 0,
      averageHoldingPeriod: 0,
      longTrades: 0,
      shortTrades: 0,
      longWinRate: 0,
      shortWinRate: 0,
      hourlyBreakdown: [],
      pnlChartData: []
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Trading Backend API',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/session',
      '/api/trades',
      '/api/analytics'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for Vercel
module.exports = app;