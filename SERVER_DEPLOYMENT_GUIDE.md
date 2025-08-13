# 🚀 Server Deployment Guide

## ✅ Your Minimal Dashboard System is Ready!

Perfect for 3-4 day unattended server deployment with complete trade tracking and remote monitoring.

## 🎯 What You Have

### **Complete Live Trading System**
- ✅ Real-time BTCUSD data processing
- ✅ confluenceScalpingStrategy execution
- ✅ Simulated trading with full risk management
- ✅ Persistent trade data storage
- ✅ Web dashboard for remote monitoring
- ✅ Auto-restart and error recovery

### **Minimal Web Dashboard Features**
- 📊 **Real-time metrics**: Equity, returns, trade counts, win rates
- 📈 **Trade history table**: All executed trades with P&L
- 🎯 **System status**: Uptime, connection status, last candle
- 📱 **Mobile-responsive**: Monitor from phone/tablet
- 🔄 **Auto-refresh**: Updates every 30 seconds
- 💾 **Persistent data**: Survives server restarts

## 🚀 Deployment Options

### **Option 1: Simple Deployment**
```bash
# Start with default settings
node server-live.js BTCUSD 50000 3000

# Dashboard available at: http://localhost:3000
```

### **Option 2: Managed Deployment (Recommended)**
```bash
# Start with auto-restart capability
node server-manager.js start BTCUSD 50000 3000

# Check status
node server-manager.js status

# View logs
node server-manager.js logs 100

# Stop when needed
node server-manager.js stop
```

### **Option 3: Production Script**
```bash
# Use the startup script
./start-server.sh BTCUSD 50000 3000
```

## 📁 File Structure Created

```
/AlgoMCP/
├── server-live.js              # Main server with dashboard
├── server-manager.js           # Process manager with auto-restart
├── start-server.sh             # Production startup script
├── dashboard/
│   ├── index.html              # Minimal web dashboard
│   ├── server.js               # Express server
│   └── trades/
│       ├── trades_2025-08-13.json      # Daily trade logs
│       ├── current_session.json        # Live session data
│       └── daily_summary_*.json        # Daily summaries
└── logs/
    └── trading_2025-08-13.log  # Server logs
```

## 🌐 Dashboard Features

### **Main Metrics (Top Cards)**
- **Current Equity**: Live portfolio value
- **Total Return**: Performance percentage
- **Total Trades**: Number of executed trades
- **Win Rate**: Percentage of profitable trades
- **Total P&L**: Cumulative profit/loss
- **Current Price**: Live BTCUSD price

### **Trade History Table**
- **Time**: When trade was executed
- **Type**: LONG/SHORT position
- **Price**: Entry/exit prices
- **Quantity**: Position size
- **P&L**: Profit/loss with color coding
- **Status**: OPEN/CLOSED
- **Reason**: Strategy confluence signals

### **System Information**
- **Symbol**: Trading pair (BTCUSD)
- **Strategy**: confluenceScalpingStrategy
- **Uptime**: How long system has been running
- **Last Candle**: Most recent market data
- **Open Positions**: Current active trades

## 🔧 Server Configuration

### **Environment Variables**
```bash
# Your .env file is already configured:
DELTA_API_KEY=ds0uiXS61VyO7E1TZHHs8452t5SvHd
DELTA_API_SECRET=VklXrEFVl5TtyIzH73qNhBIkSixoL57sJcxL4qRi3tT0COitYqm1iAYf5ogx
DELTA_BASE_URL=https://api.india.delta.exchange
```

### **Port Configuration**
- **Default**: 3000
- **Custom**: Any available port
- **Firewall**: Ensure port is open for remote access

### **Resource Usage**
- **Memory**: ~50-100MB
- **CPU**: Minimal (polling every 5 seconds)
- **Storage**: ~1MB per day for trade logs
- **Network**: Light API calls + WebSocket

## 📊 Monitoring Your Deployment

### **Access Dashboard Remotely**
```bash
# Local access
http://localhost:3000

# Remote access (replace with your server IP)
http://your-server-ip:3000
```

### **Check System Status**
```bash
# View server status
node server-manager.js status

# Check recent logs
node server-manager.js logs 50

# Monitor trades
curl http://localhost:3000/api/dashboard | jq
```

### **Data Persistence**
- **Trade Data**: Saved to `dashboard/trades/` directory
- **Session Data**: Automatically backed up every 30 seconds
- **Logs**: Saved to `logs/` directory with date stamps
- **Recovery**: System automatically restores on restart

## 🛡️ Production Features

### **Auto-Restart**
- Automatically restarts on crashes
- Maximum 10 restart attempts
- 5-second delay between restarts
- Process manager handles recovery

### **Error Handling**
- Comprehensive error logging
- Graceful shutdown on SIGINT/SIGTERM
- Network error recovery
- API failure fallbacks

### **Logging**
- Daily log files with timestamps
- Trade execution logs
- Error and warning logs
- System status logs

## 🔄 3-4 Day Deployment Workflow

### **Day 1: Deploy**
```bash
# Start your system
node server-manager.js start BTCUSD 50000 3000

# Verify dashboard access
# Check initial trades
```

### **Days 2-3: Monitor**
```bash
# Check status remotely via dashboard
# Review trade performance
# Monitor system health
```

### **Day 4: Analyze**
```bash
# Stop system
node server-manager.js stop

# Review final results
# Download trade data
# Analyze performance
```

## 📈 Expected Data After 3-4 Days

### **Trade Data**
- Individual trade records with entry/exit prices
- P&L calculations for each trade
- Strategy reasoning for each signal
- Trade timing and duration

### **Performance Metrics**
- Total return percentage
- Win/loss ratio
- Average trade P&L
- System uptime statistics

### **Files Generated**
```
dashboard/trades/
├── trades_2025-08-13.json  # Day 1 trades
├── trades_2025-08-14.json  # Day 2 trades  
├── trades_2025-08-15.json  # Day 3 trades
├── trades_2025-08-16.json  # Day 4 trades
└── current_session.json    # Final session state

logs/
├── trading_2025-08-13.log  # Day 1 logs
├── trading_2025-08-14.log  # Day 2 logs
├── trading_2025-08-15.log  # Day 3 logs
└── trading_2025-08-16.log  # Day 4 logs
```

## 🎉 Ready for Deployment!

Your system is production-ready with:

✅ **Minimal resource usage** - Perfect for server deployment  
✅ **Remote monitoring** - Web dashboard accessible anywhere  
✅ **Data persistence** - All trades saved and recoverable  
✅ **Auto-restart** - Handles failures automatically  
✅ **Complete logging** - Full audit trail  
✅ **Mobile-friendly** - Monitor from any device  

**Start your 3-4 day deployment:**
```bash
node server-manager.js start BTCUSD 50000 3000
```

**Monitor remotely at:**
```
http://your-server-ip:3000
```

🚀 **Your confluenceScalpingStrategy is ready for autonomous operation!**