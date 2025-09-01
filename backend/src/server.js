import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/database.js';
import deltaConfig from './config/deltaConfig.js';

// Import services
import TradingService from './services/TradingService.js';
import DeltaAPIService from './services/DeltaAPIService.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Initialize services
const tradingService = new TradingService();
const deltaAPI = new DeltaAPIService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to database (optional - we can run without MongoDB for now)
// connectDB();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AlgoTrading Backend',
    version: '1.0.0'
  });
});

// Test Delta API connection
app.get('/api/test-delta', async (req, res) => {
  try {
    const isConnected = await deltaAPI.testConnection();
    
    if (isConnected) {
      const ticker = await deltaAPI.getTicker();
      
      res.json({
        success: true,
        connected: true,
        message: 'Delta Exchange API connection successful',
        data: {
          timestamp: new Date(),
          sampleData: ticker?.result?.[0] || null
        }
      });
    } else {
      res.status(503).json({
        success: false,
        connected: false,
        message: 'Delta Exchange API connection failed'
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
});

// Trading strategy endpoints
app.get('/api/trading/status', (req, res) => {
  try {
    const status = tradingService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/trading/start', async (req, res) => {
  try {
    const config = req.body;
    await tradingService.initialize(config);
    await tradingService.start();
    
    res.json({
      success: true,
      message: 'Trading service started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/trading/stop', (req, res) => {
  try {
    tradingService.stop();
    res.json({
      success: true,
      message: 'Trading service stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/trading/trades', (req, res) => {
  try {
    const trades = tradingService.getTrades();
    res.json({
      success: true,
      data: trades,
      count: trades.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/trading/signals', (req, res) => {
  try {
    const signals = tradingService.getSignals();
    res.json({
      success: true,
      data: signals,
      count: signals.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/trading/position', (req, res) => {
  try {
    const position = tradingService.getCurrentPosition();
    res.json({
      success: true,
      data: position
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get market data
app.get('/api/market/data', async (req, res) => {
  try {
    const { symbol = 'BTCUSD', interval = '1m', limit = 100 } = req.query;
    
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (limit * 60); // limit minutes ago
    
    const data = await deltaAPI.getCandles(symbol, interval, startTime, endTime);
    
    res.json({
      success: true,
      data: data?.result || [],
      count: data?.result?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get products
app.get('/api/market/products', async (req, res) => {
  try {
    const products = await deltaAPI.getProducts();
    
    res.json({
      success: true,
      data: products?.result || [],
      count: products?.result?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial connection status
  socket.emit('status', {
    connected: true,
    timestamp: new Date().toISOString()
  });

  // Send current trading status
  socket.emit('tradingStatus', tradingService.getStatus());

  // Handle trading commands from client
  socket.on('startTrading', async (config) => {
    try {
      await tradingService.initialize(config);
      await tradingService.start();
      socket.emit('tradingStarted', { success: true });
    } catch (error) {
      socket.emit('tradingStarted', { success: false, error: error.message });
    }
  });

  socket.on('stopTrading', () => {
    try {
      tradingService.stop();
      socket.emit('tradingStopped', { success: true });
    } catch (error) {
      socket.emit('tradingStopped', { success: false, error: error.message });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Set up trading service event listeners
tradingService.on('initialized', () => {
  io.emit('tradingInitialized');
});

tradingService.on('started', () => {
  io.emit('tradingStarted');
});

tradingService.on('stopped', () => {
  io.emit('tradingStopped');
});

tradingService.on('positionEntered', (data) => {
  io.emit('positionEntered', data);
});

tradingService.on('positionExited', (data) => {
  io.emit('positionExited', data);
});

tradingService.on('dataProcessed', (data) => {
  io.emit('dataProcessed', data);
});

tradingService.on('latestData', (data) => {
  io.emit('latestData', data);
});

tradingService.on('pnlUpdated', (data) => {
  io.emit('pnlUpdated', data);
});

// Global error handling
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  tradingService.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  tradingService.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
🚀 AlgoTrading Backend Server Started
📡 Port: ${PORT}
🗄️  Database: MongoDB (Optional)
📈 Delta Exchange API: ${deltaConfig.baseUrl}
🔧 Environment: ${process.env.NODE_ENV || 'development'}
🎯 Trading Strategy: Renko EMA SuperTrend
⏰ Started at: ${new Date().toISOString()}

📊 Available Endpoints:
   GET  /api/health
   GET  /api/test-delta
   GET  /api/trading/status
   POST /api/trading/start
   POST /api/trading/stop
   GET  /api/trading/trades
   GET  /api/trading/signals
   GET  /api/trading/position
   GET  /api/market/data
   GET  /api/market/products

🔗 WebSocket Events:
   - tradingStatus, positionEntered, positionExited
   - dataProcessed, latestData, pnlUpdated
  `);
});

export default app;