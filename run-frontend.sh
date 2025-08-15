#!/bin/bash

echo "🎨 Starting Frontend Dashboard..."
echo "================================="

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Frontend directory not found!"
    exit 1
fi

cd frontend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Frontend package.json not found!"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Build if .next doesn't exist
if [ ! -d ".next" ]; then
    echo "🔨 Building frontend..."
    npm run build
fi

# Start the frontend
echo "🚀 Starting frontend server..."
npm run dev