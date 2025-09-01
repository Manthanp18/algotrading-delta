import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import services
import TradingService from './services/TradingService.js';
import DeltaAPIService from './services/DeltaAPIService.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Initialize services
const tradingService = new TradingService();
const deltaAPI = new DeltaAPIService();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AlgoTrading Backend with Complete Strategy',
    version: '2.0.0'
  });
});

// Test Delta API
app.get('/api/test-delta', async (req, res) => {
  try {
    const isConnected = await deltaAPI.testConnection();
    const ticker = await deltaAPI.getTicker();

    res.json({
      success: true,
      connected: isConnected,
      message: 'Delta Exchange API connection successful',
      data: ticker?.result?.[0] || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trading endpoints
app.get('/api/trading/status', (req, res) => {
  const status = tradingService.getStatus();
  res.json({ success: true, data: status });
});

app.post('/api/trading/start', async (req, res) => {
  try {
    await tradingService.initialize(req.body);
    await tradingService.start();
    res.json({ success: true, message: 'Trading started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/trading/stop', (req, res) => {
  try {
    tradingService.stop();
    res.json({ success: true, message: 'Trading stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/trading/trades', (req, res) => {
  const trades = tradingService.getTrades();
  res.json({ success: true, data: trades, count: trades.length });
});

app.get('/api/trading/signals', (req, res) => {
  const signals = tradingService.getSignals();
  res.json({ success: true, data: signals, count: signals.length });
});

app.get('/api/trading/position', (req, res) => {
  const position = tradingService.getCurrentPosition();
  res.json({ success: true, data: position });
});

app.get('/api/market/data', async (req, res) => {
  try {
    const { symbol = 'BTCUSD', limit = 100 } = req.query;
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (limit * 60);

    const data = await deltaAPI.getCandles(symbol, '1m', startTime, endTime);
    res.json({ success: true, data: data?.result || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log(`\n🔗 ===== WEBSOCKET CONNECTION =====`);
  console.log(`📱 Client connected: ${socket.id}`);
  console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
  console.log(`👥 Total clients: ${io.engine.clientsCount}`);
  console.log('==================================\n');

  // Send initial status
  socket.emit('status', { connected: true, timestamp: new Date() });
  socket.emit('tradingStatus', tradingService.getStatus());

  // Log all incoming WebSocket messages
  socket.onAny((eventName, ...args) => {
    console.log(`\n📡 ===== WEBSOCKET DATA RECEIVED =====`);
    console.log(`🎯 Event: ${eventName}`);
    console.log(`📱 From Client: ${socket.id}`);
    console.log(`📊 Data:`, JSON.stringify(args, null, 2));
    console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
    console.log('=====================================\n');
  });

  socket.on('startTrading', async (config) => {
    console.log(`\n🚀 ===== TRADING START REQUEST =====`);
    console.log(`📱 Client: ${socket.id}`);
    console.log(`⚙️ Config:`, JSON.stringify(config, null, 2));
    console.log('===================================');

    try {
      await tradingService.initialize(config);
      await tradingService.start();
      socket.emit('tradingStarted', { success: true });
      console.log(`✅ Trading started successfully for client ${socket.id}\n`);
    } catch (error) {
      socket.emit('tradingStarted', { success: false, error: error.message });
      console.log(`❌ Trading start failed for client ${socket.id}: ${error.message}\n`);
    }
  });

  socket.on('stopTrading', () => {
    console.log(`\n🛑 ===== TRADING STOP REQUEST =====`);
    console.log(`📱 Client: ${socket.id}`);
    console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
    console.log('==================================');

    tradingService.stop();
    socket.emit('tradingStopped', { success: true });
    console.log(`✅ Trading stopped for client ${socket.id}\n`);
  });

  // Log any custom events from frontend
  socket.on('requestData', (data) => {
    console.log(`\n📊 ===== DATA REQUEST =====`);
    console.log(`📱 Client: ${socket.id}`);
    console.log(`📋 Request:`, data);
    console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
    console.log('==========================\n');
  });

  socket.on('disconnect', (reason) => {
    console.log(`\n💔 ===== WEBSOCKET DISCONNECTION =====`);
    console.log(`📱 Client disconnected: ${socket.id}`);
    console.log(`❓ Reason: ${reason}`);
    console.log(`👥 Remaining clients: ${io.engine.clientsCount - 1}`);
    console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
    console.log('=====================================\n');
  });
});

// Trading service events with detailed WebSocket logging
tradingService.on('positionEntered', (data) => {
  console.log(`\n📈 ===== POSITION ENTERED =====`);
  console.log(`🎯 Side: ${data.side.toUpperCase()}`);
  console.log(`💰 Price: $${data.price}`);
  console.log(`📊 Data:`, JSON.stringify(data, null, 2));
  console.log(`🔄 Broadcasting to ${io.engine.clientsCount} clients`);
  console.log('==============================\n');
  io.emit('positionEntered', data);
});

tradingService.on('positionExited', (data) => {
  console.log(`\n📉 ===== POSITION EXITED =====`);
  console.log(`💸 PnL: ${data.pnl > 0 ? '+' : ''}$${data.pnl}`);
  console.log(`📊 Data:`, JSON.stringify(data, null, 2));
  console.log(`🔄 Broadcasting to ${io.engine.clientsCount} clients`);
  console.log('=============================\n');
  io.emit('positionExited', data);
});

tradingService.on('dataProcessed', (data) => {
  if (data.newBricks > 0) {
    console.log(`\n🧱 ===== NEW RENKO BRICKS =====`);
    console.log(`🔢 New Bricks: ${data.newBricks}`);
    console.log(`📈 Total: ${data.totalBricks}`);
    console.log(`📊 Full Data:`, JSON.stringify(data, null, 2));
    console.log(`🔄 Broadcasting to ${io.engine.clientsCount} clients`);
    console.log('==============================\n');
  }
  io.emit('dataProcessed', data);
});

tradingService.on('latestData', (data) => {
  console.log(`\n📡 ===== BROADCASTING LATEST DATA =====`);
  console.log(`🎯 Symbol: ${data.symbol}`);
  console.log(`💰 Price: $${data.close}`);
  console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
  console.log(`👥 Sending to ${io.engine.clientsCount} clients`);
  console.log('====================================\n');
  io.emit('latestData', data);
});

tradingService.on('pnlUpdated', (data) => {
  console.log(`\n💹 ===== PNL UPDATE =====`);
  console.log(`📊 PnL Data:`, JSON.stringify(data, null, 2));
  console.log(`🔄 Broadcasting to ${io.engine.clientsCount} clients`);
  console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
  console.log('========================\n');
  io.emit('pnlUpdated', data);
});

// Start server
server.listen(PORT, () => {
  console.log(`
🚀 AlgoTrading Server with Complete Strategy
📡 Port: ${PORT}
📈 Delta Exchange API: Connected
🎯 Strategy: Renko + EMA21 + SuperTrend (2.1x, 3.1x, 4.1x)
⏰ Started: ${new Date().toISOString()}

📊 API Endpoints:
   GET  /api/health - Health check
   GET  /api/test-delta - Test Delta API
   GET  /api/trading/status - Trading status
   POST /api/trading/start - Start trading
   POST /api/trading/stop - Stop trading
   GET  /api/trading/trades - Get trades
   GET  /api/trading/signals - Get signals
   GET  /api/trading/position - Current position
   GET  /api/market/data - Market data

🔗 WebSocket: Real-time updates available
  `);
});

export default app;