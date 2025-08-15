#!/bin/bash

echo "🔧 Starting Backend Trading Engine..."
echo "===================================="

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "❌ Backend directory not found!"
    exit 1
fi

cd backend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Backend package.json not found!"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Build if dist doesn't exist
if [ ! -d "dist" ]; then
    echo "🔨 Building backend..."
    npm run build
fi

# Start the backend
echo "🚀 Starting backend server..."
npm run start:dev