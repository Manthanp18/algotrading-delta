# 🚀 Delta Exchange Algo Trading App

A comprehensive MERN stack algorithmic trading application that implements a Renko + EMA + SuperTrend strategy with Delta Exchange API integration and real-time trade simulation.

## 📊 Strategy Overview

This app implements the **Renko EMA SuperTrend Strategy** with the following components:

### 📈 **Indicators Used:**
1. **Renko Bricks** - Price action representation filtering minor movements
2. **EMA 21** - Exponential Moving Average for trend direction 
3. **SuperTrend (3 levels)** - ATR-based indicators with multipliers 2.1x, 3.1x, 4.1x

### 🎯 **Entry Conditions:**
- **Long Entry:** Price > EMA21 + All SuperTrends bullish + Green Renko brick
- **Short Entry:** Price < EMA21 + All SuperTrends bearish + Red Renko brick

### 🚪 **Exit Conditions:**
- **Long Exit:** Price < EMA21 OR Any SuperTrend bearish OR Red Renko brick
- **Short Exit:** Price > EMA21 OR Any SuperTrend bullish OR Green Renko brick

## 🏗 Architecture

```
AlgoMCP/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── config/            # Database & Delta API config
│   │   ├── models/            # MongoDB schemas
│   │   ├── services/          # API & WebSocket services
│   │   ├── strategies/        # Trading strategy implementation
│   │   ├── routes/            # REST API routes
│   │   └── controllers/       # Request handlers
│   └── package.json
├── frontend/                   # React Dashboard
└── .env                       # Environment variables
```

## 🛠 Setup Instructions

### Prerequisites
- Node.js (v20+)
- MongoDB (local or Atlas)
- Delta Exchange API credentials

### 1. Environment Setup
Your `.env` file is already configured with Delta Exchange credentials:
```bash
DELTA_API_KEY=your_api_key
DELTA_API_SECRET=your_api_secret  
DELTA_BASE_URL=https://api.india.delta.exchange
MONGODB_URI=mongodb://localhost:27017/algo-trading  # Optional
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 3. Start the Application

**Start Backend (Terminal 1):**
```bash
cd backend
npm run dev
```
Server runs on: `http://localhost:3001`

**Start Frontend (Terminal 2):**
```bash
cd frontend
npm run dev
```
Dashboard runs on: `http://localhost:5173`

## 🔧 Backend API Endpoints

### **Trading Endpoints**
- `GET /api/trades` - Get trade history with pagination
- `GET /api/trades/analytics` - Get trading performance metrics
- `GET /api/trades/test-connection` - Test Delta Exchange connection

### **Position Endpoints**
- `GET /api/positions` - Get current positions

### **Market Data Endpoints**
- `GET /api/market/data` - Get market data (OHLC candles)
- `GET /api/market/signals` - Get trading signals
- `GET /api/market/products` - Get Delta Exchange products

### **Health Check**
- `GET /api/health` - Server health status

## 🌐 WebSocket Events

### **Client → Server**
- `startWebSocket` - Start real-time data feed
- `stopWebSocket` - Stop real-time data feed

### **Server → Client**
- `ticker` - Real-time price updates
- `orderbook` - Order book updates  
- `trades` - Recent trades
- `candle` - New candlestick data
- `wsStatus` - Connection status updates

## 🧮 Core Strategy Components

### **RenkoCalculator**
```javascript
import RenkoCalculator from './src/strategies/RenkoCalculator.js';

const renko = new RenkoCalculator(10.0); // 10.0 brick size
const bricks = renko.calculateRenko(ohlcData);
```

### **IndicatorCalculators**
```javascript
import IndicatorCalculators from './src/strategies/IndicatorCalculators.js';

// EMA calculation
const ema = IndicatorCalculators.calculateEMA(prices, 21);

// SuperTrend calculation  
const st = IndicatorCalculators.calculateSuperTrend(ohlcData, 1, 2.1);

// Multiple SuperTrends
const multiST = IndicatorCalculators.calculateMultipleSuperTrend(
  ohlcData, 1, [2.1, 3.1, 4.1]
);
```

### **RenkoEMAStrategy**
```javascript
import RenkoEMAStrategy from './src/strategies/RenkoEMAStrategy.js';

const strategy = new RenkoEMAStrategy({
  symbol: 'BTCUSDT',
  brickSize: 10.0,
  emaLength: 21,
  supertrendMultipliers: [2.1, 3.1, 4.1]
});

await strategy.initialize();
strategy.start();
```

## 📊 Database Schema

### **Trades Collection**
```javascript
{
  symbol: 'BTCUSDT',
  side: 'buy' | 'sell',
  type: 'entry' | 'exit', 
  price: 45000,
  quantity: 0.001,
  pnl: 15.50,
  signalData: { ema21, supertrends, renkoBrick },
  timestamp: Date,
  isSimulated: true
}
```

### **Positions Collection**
```javascript
{
  symbol: 'BTCUSDT',
  side: 'long' | 'short' | 'none',
  entryPrice: 45000,
  quantity: 0.001,
  unrealizedPnL: 12.30,
  isActive: true,
  timestamp: Date
}
```

### **MarketData Collection**
```javascript
{
  symbol: 'BTCUSDT',
  timestamp: Date,
  open: 45000,
  high: 45200, 
  low: 44800,
  close: 45100,
  volume: 1000
}
```

## 🚀 Features Implemented

### ✅ **Phase 1 - Foundation**
- [x] MERN stack project structure
- [x] MongoDB schemas and database connection
- [x] Delta Exchange API integration with authentication
- [x] WebSocket service for real-time data
- [x] Express REST API with routes and controllers

### ✅ **Phase 2 - Strategy Engine**  
- [x] Renko brick calculation (converted from Python)
- [x] EMA and SuperTrend indicator calculators
- [x] Complete trading strategy with signal generation
- [x] Trade simulation system (paper trading)
- [x] Position management and PnL tracking

### 🔄 **Phase 3 - Dashboard (In Progress)**
- [ ] React dashboard with real-time charts
- [ ] Trade management interface
- [ ] Performance analytics display
- [ ] Strategy configuration panel

## 🧪 Testing the Backend

### 1. Test Delta API Connection
```bash
curl http://localhost:3001/api/trades/test-connection
```

### 2. Test Health Endpoint
```bash
curl http://localhost:3001/api/health
```

### 3. Get Market Data
```bash
curl "http://localhost:3001/api/market/data?symbol=BTCUSDT&limit=100"
```

### 4. WebSocket Test
```javascript
// In browser console or frontend
const socket = io('http://localhost:3001');
socket.emit('startWebSocket', { symbol: 'BTCUSDT' });
```

## 📈 Performance Features

- **Rate Limiting:** Respects Delta Exchange limits (10k requests/5min)
- **Database Indexing:** Optimized queries on symbol and timestamp
- **Real-time Updates:** Sub-second WebSocket data processing
- **Error Handling:** Comprehensive error management and logging
- **Reconnection Logic:** Automatic WebSocket reconnection

## 🔒 Security & Risk Management

- **API Key Security:** Credentials stored in environment variables
- **Simulation Only:** No real trading execution (paper trading)
- **Input Validation:** All API inputs validated and sanitized
- **Rate Limiting:** Built-in request throttling

## 📚 Development Notes

### **Strategy Conversion**
The Python strategy has been faithfully converted to Node.js with:
- Identical Renko brick calculation logic
- Same EMA and SuperTrend formulas
- Equivalent entry/exit conditions
- Real-time processing capabilities

### **Trade Simulation**
- All trades are simulated (no real money)
- PnL calculations based on live market prices
- Position tracking with unrealized/realized PnL
- Complete trade history and analytics

### **Next Steps**
1. Complete React dashboard implementation
2. Add advanced charting with TradingView
3. Implement backtesting capabilities
4. Add more risk management features
5. Deploy to production environment

## 🤝 Contributing

This is the foundation for a complete algorithmic trading system. The backend is fully functional and ready for frontend development and additional strategy implementations.

---

**⚠️ Disclaimer:** This is for educational purposes only. All trading is simulated. Always test thoroughly before considering any real trading implementation.