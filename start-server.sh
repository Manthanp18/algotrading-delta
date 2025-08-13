#!/bin/bash

# Production Live Trading Server Startup Script
# Usage: ./start-server.sh [SYMBOL] [CAPITAL] [PORT]

SYMBOL=${1:-BTCUSD}
CAPITAL=${2:-50000}
PORT=${3:-3000}

echo "🚀 Starting Live Trading Server"
echo "================================"
echo "Symbol: $SYMBOL"
echo "Capital: \$$CAPITAL"
echo "Dashboard Port: $PORT"
echo "Time: $(date)"
echo ""

# Create logs directory
mkdir -p logs

# Start with output logging
echo "📝 Logs will be saved to logs/trading_$(date +%Y-%m-%d).log"
echo "🌐 Dashboard will be available at: http://localhost:$PORT"
echo ""

# Start the server with output redirection
node server-live.js "$SYMBOL" "$CAPITAL" "$PORT" 2>&1 | tee "logs/trading_$(date +%Y-%m-%d).log"