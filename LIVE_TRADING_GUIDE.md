# Live Trading System Guide

## Overview

Your backtesting engine has been successfully enhanced with a complete live trading system that executes your confluenceScalpingStrategy on real market data from Delta Exchange. The system uses **simulated trading** - no real money is at risk.

## ✅ What's Been Implemented

### 🔧 Core Components

1. **LiveDataFetcher** (`src/liveDataFetcher.js`)
   - REST API polling for historical data and new candles
   - Auto-retry and error handling
   - Configurable polling intervals

2. **LiveDataFetcherWS** (`src/liveDataFetcherWS.js`) 
   - **WebSocket connection** to Delta Exchange for real-time data
   - Falls back to REST API if WebSocket fails
   - Real-time ticker updates with 1-minute candle aggregation
   - Auto-reconnection with exponential backoff

3. **LiveTradingEngine** (`src/liveTradingEngine.js`)
   - Real-time strategy execution
   - Portfolio simulation with position tracking
   - Stop loss and take profit management
   - Performance metrics calculation

4. **LiveSessionManager** (`src/liveSessionManager.js`)
   - Session lifecycle management
   - State persistence and recovery
   - Event coordination between components

5. **LiveDashboard** (`src/liveDashboard.js`)
   - Real-time monitoring interface
   - Portfolio status and trade tracking
   - Market data display

## 🚀 Getting Started

### 1. Configure API Access

Edit your `.env` file with Delta Exchange credentials:

```bash
DELTA_API_KEY=your_api_key_here
DELTA_API_SECRET=your_api_secret_here
DELTA_BASE_URL=https://api.india.delta.exchange
```

**Note:** Public market data doesn't require authentication, but you'll need credentials for full functionality.

### 2. Start Live Trading

```bash
# Start live trading session with default settings
node cli.js live

# Start with custom symbol and capital
node cli.js live BTCUSD 50000

# Start with ETHUSD and $25,000 capital
node cli.js live ETHUSD 25000
```

### 3. Monitor Your Session

```bash
# View current session status
node cli.js live-status

# Start real-time dashboard
node cli.js live-dashboard

# List all sessions
node cli.js live-list

# View specific session details
node cli.js live-view session_1234567890
```

### 4. Stop Trading

```bash
# Stop current session
node cli.js live-stop
```

## 📊 Real-Time Data Sources

### WebSocket Connection (Primary)
- **Endpoint:** `wss://socket.delta.exchange`
- **Features:** Real-time ticker updates, sub-second latency
- **Channels:** `v2/ticker` for price data
- **Auto-reconnection:** Yes, with exponential backoff

### REST API (Fallback)
- **Endpoint:** `https://api.india.delta.exchange`
- **Features:** Historical candles, polling for updates
- **Polling:** Every 10-60 seconds
- **Reliability:** High, always available

## 🎯 Strategy Execution

Your **confluenceScalpingStrategy** runs on live data with:

### Signal Generation
- **Confluence Score:** Minimum 3/6 points required
- **Factors:** RSI, Volume, Momentum, EMA Alignment, Breakouts, Volume Spikes
- **Timeframe:** 1-minute candles optimized for scalping

### Trade Execution
- **Position Size:** 10% of capital by default
- **Entry Types:** Long and Short positions
- **Risk Management:** Dynamic stop loss and take profit
- **Cooldown:** 1-minute between trades

### Performance Tracking
- Real-time P&L calculation
- Win rate and trade statistics
- Drawdown monitoring
- Portfolio equity tracking

## 🛠️ Available Commands

### Backtesting Commands
```bash
node cli.js run                    # Run backtest
node cli.js list                   # List backtest results
node cli.js view <filename>        # View specific result
node cli.js compare <file1> <file2> # Compare results
node cli.js export <filename>      # Export to CSV
node cli.js cleanup [days]         # Delete old results
```

### Live Trading Commands
```bash
node cli.js live [symbol] [capital]    # Start live session
node cli.js live-stop                  # Stop session
node cli.js live-status                # Check status
node cli.js live-dashboard             # Real-time dashboard
node cli.js live-list                  # List all sessions
node cli.js live-view <session-id>     # View session details
```

## 📈 Dashboard Features

The real-time dashboard shows:
- **Session Info:** Symbol, strategy, duration
- **Portfolio Status:** Equity, cash, positions, returns
- **Trading Performance:** Total trades, win rate, P&L
- **Open Positions:** Current long/short positions
- **Recent Activity:** Latest trade executions
- **Market Data:** Current price, last update

## 🔒 Safety Features

### Simulated Trading Only
- **No Real Money:** All trades are simulated
- **Virtual Portfolio:** Tracks positions and cash virtually
- **Risk-Free Testing:** Perfect for strategy validation

### Risk Management
- **Position Sizing:** Configurable percentage of capital
- **Stop Losses:** Automatic loss limitation
- **Take Profits:** Automatic profit taking
- **Cooldown Periods:** Prevents over-trading

### Error Handling
- **Connection Recovery:** Auto-reconnect on failures
- **Data Validation:** Ensures data integrity
- **Session Persistence:** State saved during operation

## 🧪 Testing & Demo

### Run Demo with Mock Data
```bash
node test-live-trading.js
```

This runs a 60-second demo showing:
- Mock real-time data generation
- Strategy signal analysis
- Trade execution simulation
- Performance metrics

### Verify System Health
```bash
# Check if no sessions are running
node cli.js live-status

# List previous sessions
node cli.js live-list

# View help
node cli.js help
```

## 📁 Data Storage

### Session Files
- **Location:** `live-sessions/` directory
- **Format:** JSON files with full session data
- **Naming:** `session_timestamp.json`

### Current Session
- **File:** `live-sessions/current-session.json`
- **Purpose:** Active session state backup
- **Auto-saved:** Every 5 minutes during operation

## 🔧 Configuration Options

### Strategy Parameters
```javascript
{
  positionSize: 0.1,        // 10% of capital per trade
  initialCapital: 100000,   // Starting capital ($100,000)
  strategyParams: {
    targetPoints: 150,      // Profit target in points
    stopLossPoints: 100,    // Stop loss in points
    minConfluenceScore: 3   // Minimum signal strength
  }
}
```

### Data Fetcher Settings
```javascript
{
  pollIntervalMs: 10000,    // REST API polling frequency
  maxHistoryLength: 100,    // Candles to keep in memory
  useWebSocket: true,       // Enable WebSocket connection
  maxReconnectAttempts: 5   // WebSocket reconnection limit
}
```

## 🚨 Troubleshooting

### WebSocket Connection Issues
```bash
# Check if WebSocket package is installed
npm list ws

# Install if missing
npm install ws
```

### API Connection Problems
```bash
# Verify .env file configuration
cat .env

# Test with demo mode
node test-live-trading.js
```

### Dashboard Not Updating
```bash
# Restart dashboard
node cli.js live-dashboard

# Check session status
node cli.js live-status
```

## 🎉 Success! Your System is Ready

Your live trading system is now fully operational with:

✅ **Real-time market data** via WebSocket + REST API  
✅ **confluenceScalpingStrategy** execution on live data  
✅ **Simulated trading** with full risk management  
✅ **Real-time monitoring** dashboard  
✅ **Complete session management** and persistence  
✅ **Professional CLI interface** for all operations  

**Start your first live session:**
```bash
node cli.js live BTCUSD 50000
```

**Monitor in real-time:**
```bash
node cli.js live-dashboard
```

Your strategy is now running on live market data! 🚀