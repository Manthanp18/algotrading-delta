#!/bin/bash

echo "🚀 Starting Complete Trading System..."
echo "======================================"

# Function to kill background processes
cleanup() {
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM

echo "📊 Starting Backend API Server..."
cd backend && node dashboard/server.js &
BACKEND_PID=$!

echo "⚡ Starting Trading Engine..."
cd ../backend && npm start &
TRADING_PID=$!

echo "🎨 Starting Frontend Dashboard..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ All services started!"
echo "📊 Backend API: http://localhost:8080"
echo "🎨 Frontend Dashboard: http://localhost:3000"
echo "⚡ Trading Engine: Active"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for all background processes
wait