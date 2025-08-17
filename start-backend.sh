#!/bin/bash

echo "🚀 Starting Backend Trading System..."
echo "========================================"

cd backend

echo "📊 Starting Dashboard API Server (Port 8080)..."
node dashboard/server.js &
DASHBOARD_PID=$!

echo "⚡ Starting SuperTrend Renko Trading Engine..."
npm start

# Cleanup when script exits
trap "kill $DASHBOARD_PID 2>/dev/null" EXIT

echo "✅ Backend system started!"
echo "📊 Dashboard API: http://localhost:8080"
echo "🎯 Trading Engine: Active"
echo ""
echo "Press Ctrl+C to stop..."

wait