# 🚀 Enterprise Trading System

A comprehensive, enterprise-grade cryptocurrency trading system with backtesting, live trading, and advanced analytics capabilities.

## ✨ Features

### 🔥 Core Trading Engine
- **Backtesting Engine**: Historical strategy testing with detailed metrics
- **Live Trading Engine**: Real-time strategy execution with risk management
- **Portfolio Management**: Advanced position tracking and P&L calculation
- **Risk Management**: Comprehensive risk controls and emergency stops

### 📊 Advanced Analytics
- **Performance Metrics**: Win rate, Sharpe ratio, max drawdown, profit factor
- **Interactive Charts**: Candlestick charts, P&L curves, performance heatmaps
- **Real-time Monitoring**: Live position tracking and trade execution
- **Historical Analysis**: Detailed trade history and strategy performance

### 🎯 Strategy Framework
- **Base Strategy Class**: Extensible framework for custom strategies
- **Technical Indicators**: 20+ built-in indicators (SMA, EMA, RSI, MACD, etc.)
- **Signal Generation**: Advanced signal processing and validation
- **Strategy Optimization**: Parameter tuning and backtesting

### 🖥️ Professional Dashboard
- **Next.js Frontend**: Modern React-based interface
- **Real-time Updates**: WebSocket-powered live data
- **Responsive Design**: Mobile-friendly and adaptive UI
- **Dark Theme**: Optimized for trading environments

## 🏗️ Architecture

### Enterprise-Grade Structure
```
AlgoMCP/
├── backend/           # Node.js/TypeScript Trading Engine
├── frontend/          # Next.js/React Dashboard  
├── shared/            # Shared utilities and types
├── docs/              # Documentation
├── scripts/           # Build and deployment scripts
└── docker/            # Container configurations
```

### Technology Stack
- **Backend**: Node.js, TypeScript, Express, WebSocket
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Data**: Delta Exchange API, Redis caching
- **Testing**: Jest, React Testing Library
- **Deployment**: Docker, Docker Compose

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker (optional)

### Simple Start (Recommended)
```bash
# 1. Clone and setup
git clone <repository-url>
cd AlgoMCP
./setup.sh

# 2. Start the system
./run-both.sh
```

### Available Run Scripts
- `./run-both.sh` - Start both backend and frontend (simple)
- `./run-backend.sh` - Start backend only (port 3000)
- `./run-frontend.sh` - Start frontend only (port 3001)

### Automated Setup
```bash
# Clone the repository
git clone <repository-url>
cd AlgoMCP

# Run automated setup
./setup.sh

# Start the system
./start.sh
```

### Manual Setup

#### Backend Setup
```bash
cd backend
npm install
npm run build
cp .env.example .env  # Update with your configuration
npm run start:dev
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run dev
```

## 📖 Usage

### Starting the System
```bash
# Start both backend and frontend
./run-both.sh

# Or individually
./run-backend.sh      # Backend on port 3000
./run-frontend.sh     # Frontend on port 3001

# Legacy scripts (also available)
./start.sh            # Comprehensive startup with health checks
./start-backend.sh    # Backend with detailed logging
./start-frontend.sh   # Frontend with build checks
```

### Accessing the Dashboard
- **Main Dashboard**: http://localhost:3001
- **API Documentation**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health

### Running Backtests
```bash
# CLI backtesting
cd backend
npm run backtest -- --strategy ScalpingStrategy --symbol BTCUSD --start 2024-01-01 --end 2024-12-31

# Or via dashboard
# Navigate to Analytics > Backtesting
```

### Live Trading
```bash
# Start live trading session
cd backend
npm run live -- --strategy ScalpingStrategy --symbol BTCUSD --capital 10000

# Monitor via dashboard
# Navigate to Positions > Live Trading
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# API Keys
DELTA_API_KEY=your_api_key
DELTA_API_SECRET=your_api_secret
DELTA_BASE_URL=https://api.delta.exchange

# Trading
DEFAULT_SYMBOL=BTCUSD
DEFAULT_CAPITAL=100000
MAX_POSITION_SIZE=0.1
STOP_LOSS_PERCENT=0.02
TAKE_PROFIT_PERCENT=0.03
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development
```

## 📊 Dashboard Features

### Live Positions Tab
- Real-time portfolio tracking
- Current position details with unrealized P&L
- Session uptime and performance metrics
- Risk management monitoring

### Trade History Tab
- Complete trading history with full details
- Advanced filtering by date, status, and type
- Detailed entry/exit information
- P&L analysis per trade

### Analytics Tab
- Comprehensive performance metrics
- Win rate and profit factor analysis
- Cumulative P&L charts
- Hourly performance breakdown
- Long vs Short trade statistics

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage   # Coverage report
```

### Frontend Testing
```bash
cd frontend
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:e2e        # End-to-end tests
```

## 🐳 Docker Deployment

### Development
```bash
# Start with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f
```

### Production
```bash
# Build and start production containers
docker-compose up -d

# Scale services
docker-compose up -d --scale backend=3
```

## 📚 Documentation

- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Complete architecture guide
- **[backend/README.md](backend/README.md)** - Backend documentation
- **[frontend/README.md](frontend/README.md)** - Frontend documentation
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Development guidelines
- **[API_REFERENCE.md](API_REFERENCE.md)** - API documentation

## 🔒 Security

### Built-in Security Features
- **Input Validation**: Comprehensive data validation
- **Rate Limiting**: API request throttling
- **CORS Protection**: Cross-origin request controls
- **Environment Variables**: Secure configuration management
- **Error Handling**: Safe error responses

### Best Practices
- Never commit API keys or secrets
- Use environment variables for configuration
- Regularly update dependencies
- Monitor for security vulnerabilities

## 🚀 Performance

### Optimization Features
- **Caching**: Redis for session data
- **Code Splitting**: Optimized bundle sizes
- **Lazy Loading**: On-demand component loading
- **Compression**: Gzip response compression
- **Connection Pooling**: Efficient API connections

### Benchmarks
- **Backend**: 1000+ requests/second
- **Frontend**: Sub-second page loads
- **Real-time**: <100ms WebSocket latency
- **Memory**: <500MB under normal load

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Write tests for new features
- Update documentation
- Follow the established code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues
- **Port conflicts**: Change ports in configuration files
- **API errors**: Verify API keys and network connectivity
- **Build failures**: Clear node_modules and reinstall

### Getting Help
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information

## 🔄 Updates

### Recent Changes
- ✅ Enterprise-grade architecture implementation
- ✅ Advanced risk management system
- ✅ Real-time WebSocket integration
- ✅ Comprehensive testing framework
- ✅ Docker containerization

### Roadmap
- 🔄 Multi-exchange support
- 🔄 Advanced charting features
- 🔄 Machine learning strategies
- 🔄 Mobile app development
- 🔄 Cloud deployment guides

---

**⚠️ Disclaimer**: This software is for educational and testing purposes. Live trading involves significant financial risk. Always test thoroughly before using real money.