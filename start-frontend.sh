#!/bin/bash

echo "🎨 Starting Frontend Dashboard..."
echo "=================================="

cd frontend

echo "📦 Installing dependencies (if needed)..."
npm install

echo "🌐 Starting Next.js Dashboard (Port 3000)..."
npm run dev

echo "✅ Frontend dashboard started!"
echo "🌐 Dashboard: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop..."