#!/bin/bash

echo "🚀 Starting Enterprise Trading System..."
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

# Check ports
echo "🔍 Checking ports..."
if ! check_port 3000; then
    echo "❌ Backend port 3000 is already in use. Please stop the existing process."
    exit 1
fi

if ! check_port 3001; then
    echo "❌ Frontend port 3001 is already in use. Please stop the existing process."
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo "✅ All services stopped"
    exit 0
}

# Handle Ctrl+C
trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}🔧 Starting backend...${NC}"
./run-backend.sh &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Start frontend
echo -e "${BLUE}🎨 Starting frontend...${NC}"
./run-frontend.sh &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Trading System Started Successfully!${NC}"
echo "========================================"
echo -e "${BLUE}📊 Backend API:${NC} http://localhost:3000"
echo -e "${BLUE}🎨 Frontend Dashboard:${NC} http://localhost:3001"
echo -e "${BLUE}📚 API Documentation:${NC} http://localhost:3000/docs"
echo -e "${BLUE}🔍 Health Check:${NC} http://localhost:3000/health"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for processes to finish
wait