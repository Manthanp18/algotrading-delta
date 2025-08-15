#!/bin/bash

echo "🚀 Starting Trading Dashboard..."
echo "================================"

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Not in the trading-dashboard directory. Please run this script from the trading-dashboard folder."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies..."
    npm install
    if [[ $? -ne 0 ]]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
fi

# Check if the parent directory has trading data
TRADES_DIR="../dashboard/trades"
if [[ ! -d "$TRADES_DIR" ]]; then
    echo "⚠️  Warning: Trading data directory not found at $TRADES_DIR"
    echo "   The dashboard will still work but may not show live data."
    echo "   Make sure your main trading system is running to generate data."
fi

echo "✅ Dependencies installed"
echo "🌐 Starting development server..."
echo ""
echo "Dashboard will be available at: http://localhost:3000"
echo ""
echo "Features:"
echo "  📊 Live Positions - Real-time portfolio and position tracking"
echo "  📈 Trade History - Complete trading history with detailed analytics"
echo "  📉 Analytics - Performance metrics, charts, and statistics"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"

# Start the Next.js development server
npm run dev