#!/bin/bash

echo "🚀 Setting up Enterprise Trading System..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        print_status "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    REQUIRED_VERSION="18.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+."
        exit 1
    fi
    
    print_success "Node.js $NODE_VERSION detected"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    print_success "npm $NPM_VERSION detected"
}

# Setup backend
setup_backend() {
    print_status "Setting up backend..."
    
    cd backend || exit 1
    
    if [ ! -f "package.json" ]; then
        print_error "Backend package.json not found. Please ensure you're in the correct directory."
        exit 1
    fi
    
    print_status "Installing backend dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        print_error "Failed to install backend dependencies"
        exit 1
    fi
    
    print_status "Setting up backend environment..."
    if [ ! -f ".env" ]; then
        if [ -f "../.env.example" ]; then
            cp ../.env.example .env
            print_warning "Created .env file from root .env.example. Please update with your configuration."
        else
            cat > .env << EOF
# Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
DB_PATH=./data
BACKUP_PATH=./backups
AUTO_BACKUP=false

# API Configuration
DELTA_BASE_URL=https://api.delta.exchange
DELTA_API_KEY=
DELTA_API_SECRET=

# Trading Configuration
DEFAULT_SYMBOL=BTCUSD
DEFAULT_TIMEFRAME=1m
DEFAULT_CAPITAL=100000
MAX_SESSIONS=5

# Risk Management
MAX_POSITION_SIZE=0.1
MAX_DRAWDOWN=0.2
STOP_LOSS_PERCENT=0.02
TAKE_PROFIT_PERCENT=0.03
MAX_OPEN_POSITIONS=3

# Dashboard
DASHBOARD_PORT=3001
REFRESH_INTERVAL=30000

# Logging
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs
LOG_CONSOLE_ENABLED=true
EOF
            print_success "Created default .env file"
        fi
    fi
    
    print_status "Creating required directories..."
    mkdir -p data logs backups dist
    
    print_status "Building backend..."
    npm run build
    
    if [ $? -ne 0 ]; then
        print_error "Failed to build backend"
        exit 1
    fi
    
    print_success "Backend setup completed"
    cd ..
}

# Setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    
    # Check if we have the frontend structure
    if [ -d "frontend" ]; then
        cd frontend || exit 1
        FRONTEND_DIR="frontend"
    else
        print_error "Frontend directory not found. Expected 'frontend'."
        exit 1
    fi
    
    if [ ! -f "package.json" ]; then
        print_error "Frontend package.json not found."
        exit 1
    fi
    
    print_status "Installing frontend dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        print_error "Failed to install frontend dependencies"
        exit 1
    fi
    
    print_status "Setting up frontend environment..."
    if [ ! -f ".env.local" ]; then
        cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# Environment
NEXT_PUBLIC_ENVIRONMENT=development
EOF
        print_success "Created frontend .env.local file"
    fi
    
    print_status "Building frontend..."
    npm run build
    
    if [ $? -ne 0 ]; then
        print_error "Failed to build frontend"
        exit 1
    fi
    
    print_success "Frontend setup completed"
    cd ..
}

# Create startup scripts
create_scripts() {
    print_status "Creating startup scripts..."
    
    # Backend start script
    cat > start-backend.sh << 'EOF'
#!/bin/bash
echo "🔧 Starting Trading Engine Backend..."
cd backend
npm run start:dev
EOF
    
    # Frontend start script
    cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "🎨 Starting Trading Dashboard Frontend..."
cd frontend
npm run dev
EOF
    
    # Combined start script
    cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Enterprise Trading System..."
echo "======================================"

# Function to start background process
start_service() {
    local service_name=$1
    local script_path=$2
    
    echo "Starting $service_name..."
    if [ -f "$script_path" ]; then
        chmod +x "$script_path"
        $script_path &
        echo "$service_name started (PID: $!)"
    else
        echo "Error: $script_path not found"
        exit 1
    fi
}

# Start backend
start_service "Backend" "./start-backend.sh"
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
start_service "Frontend" "./start-frontend.sh"
FRONTEND_PID=$!

echo ""
echo "✅ Trading System Started Successfully!"
echo "======================================"
echo "📊 Backend API: http://localhost:3000"
echo "🎨 Frontend Dashboard: http://localhost:3001"
echo "📚 API Documentation: http://localhost:3000/docs"
echo "🔍 Health Check: http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Handle shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
EOF
    
    # Make scripts executable
    chmod +x start-backend.sh
    chmod +x start-frontend.sh
    chmod +x start.sh
    
    print_success "Startup scripts created"
}

# Create Docker setup
create_docker() {
    print_status "Creating Docker configuration..."
    
    # Docker Compose for development
    cat > docker-compose.dev.yml << 'EOF'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - redis
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
EOF
    
    # Docker Compose for production
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - redis
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
EOF
    
    print_success "Docker configuration created"
}

# Main setup process
main() {
    print_status "Enterprise Trading System Setup"
    print_status "==============================="
    
    # Check prerequisites
    check_node
    check_npm
    
    # Setup components
    setup_backend
    setup_frontend
    
    # Create additional files
    create_scripts
    create_docker
    
    print_success "=========================================="
    print_success "🎉 Setup completed successfully!"
    print_success "=========================================="
    print_status ""
    print_status "Next steps:"
    print_status "1. Update backend/.env with your API keys"
    print_status "2. Run './start.sh' to start the system"
    print_status "3. Visit http://localhost:3001 for the dashboard"
    print_status ""
    print_status "Available commands:"
    print_status "• ./start.sh              - Start both backend and frontend"
    print_status "• ./start-backend.sh      - Start only backend"
    print_status "• ./start-frontend.sh     - Start only frontend"
    print_status "• docker-compose up -d    - Start with Docker"
    print_status ""
    print_status "Documentation:"
    print_status "• PROJECT_STRUCTURE.md   - Complete architecture guide"
    print_status "• backend/README.md       - Backend documentation"
    print_status "• frontend/README.md      - Frontend documentation"
}

# Run main function
main "$@"