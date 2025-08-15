# 🏗️ Enterprise Trading System - Complete Project Structure

## 📁 Root Directory Structure

```
AlgoMCP/
├── backend/                      # Backend Trading Engine (Node.js/TypeScript)
├── frontend/                     # Frontend Dashboard (Next.js/React)
├── shared/                       # Shared utilities and types
├── docs/                         # Documentation
├── scripts/                      # Build and deployment scripts
├── docker/                       # Docker configurations
├── run-backend.sh                # Start backend only
├── run-frontend.sh               # Start frontend only
├── run-both.sh                   # Start both backend and frontend
├── setup.sh                      # Automated project setup
├── .env.example                  # Environment variables template
├── docker-compose.yml            # Multi-service deployment
├── README.md                     # Main project documentation
└── CONTRIBUTING.md               # Contribution guidelines
```

## 🔧 Backend Architecture (`backend/`)

### Core Structure
```
backend/
├── src/
│   ├── app/                      # Application layer
│   │   ├── TradingApp.ts         # Main application class
│   │   └── middleware/           # Express middleware
│   ├── core/                     # Business logic core
│   │   ├── engine/               # Trading engines
│   │   │   ├── BacktestEngine.ts # Historical backtesting
│   │   │   ├── LiveEngine.ts     # Real-time trading
│   │   │   ├── PortfolioManager.ts # Portfolio management
│   │   │   └── RiskManager.ts    # Risk management
│   │   └── analysis/             # Performance analysis
│   ├── data/                     # Data layer
│   │   ├── providers/            # Data source providers
│   │   │   ├── DeltaExchangeProvider.ts
│   │   │   ├── BinanceProvider.ts
│   │   │   └── DataProvider.interface.ts
│   │   ├── repositories/         # Data persistence
│   │   │   ├── TradeRepository.ts
│   │   │   ├── SessionRepository.ts
│   │   │   └── Repository.interface.ts
│   │   └── models/               # Data models
│   ├── strategies/               # Trading strategies
│   │   ├── BaseStrategy.ts       # Abstract base class
│   │   ├── implementations/      # Concrete strategies
│   │   │   ├── ScalpingStrategy.ts
│   │   │   ├── MomentumStrategy.ts
│   │   │   └── GridStrategy.ts
│   │   └── indicators/           # Technical indicators
│   ├── services/                 # Application services
│   │   ├── SessionManager.ts     # Trading session management
│   │   ├── ApiService.ts         # REST API service
│   │   ├── WebSocketService.ts   # Real-time communication
│   │   ├── NotificationService.ts # Alerts and notifications
│   │   └── AnalyticsService.ts   # Performance analytics
│   ├── utils/                    # Utility functions
│   │   ├── logger.ts             # Centralized logging
│   │   ├── validators.ts         # Input validation
│   │   ├── formatters.ts         # Data formatting
│   │   ├── calculations.ts       # Mathematical utilities
│   │   └── constants.ts          # Application constants
│   ├── types/                    # TypeScript definitions
│   │   ├── index.ts              # Core types
│   │   ├── api.ts                # API-related types
│   │   ├── strategy.ts           # Strategy types
│   │   └── market.ts             # Market data types
│   ├── config/                   # Configuration management
│   │   ├── index.ts              # Main configuration
│   │   ├── database.ts           # Database configuration
│   │   ├── api.ts                # API configuration
│   │   └── environments/         # Environment-specific configs
│   ├── cli/                      # Command-line interface
│   │   ├── backtest.ts           # Backtesting CLI
│   │   ├── live.ts               # Live trading CLI
│   │   ├── analyze.ts            # Analysis CLI
│   │   └── migrate.ts            # Data migration CLI
│   └── index.ts                  # Application entry point
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   ├── e2e/                      # End-to-end tests
│   └── fixtures/                 # Test data
├── dist/                         # Compiled JavaScript (generated)
├── logs/                         # Application logs (generated)
├── data/                         # Persistent data storage
├── backups/                      # Data backups
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Testing configuration
├── .eslintrc.js                  # Code linting rules
└── .env                          # Environment variables
```

## 🎨 Frontend Architecture (`frontend/`)

### Next.js Structure
```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (dashboard)/          # Dashboard routes group
│   │   │   ├── layout.tsx        # Dashboard layout
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── trades/           # Trades management
│   │   │   ├── analytics/        # Performance analytics
│   │   │   ├── positions/        # Position management
│   │   │   └── settings/         # Configuration
│   │   ├── api/                  # API routes (Next.js)
│   │   │   ├── trades/           # Trades API endpoints
│   │   │   ├── sessions/         # Session API endpoints
│   │   │   ├── analytics/        # Analytics API endpoints
│   │   │   └── websocket/        # WebSocket endpoints
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Landing page
│   ├── components/               # React components
│   │   ├── ui/                   # Base UI components
│   │   │   ├── Button.tsx        # Reusable button component
│   │   │   ├── Card.tsx          # Card containers
│   │   │   ├── Modal.tsx         # Modal dialogs
│   │   │   ├── Table.tsx         # Data tables
│   │   │   ├── Chart.tsx         # Chart components
│   │   │   ├── Form/             # Form components
│   │   │   ├── Loading/          # Loading states
│   │   │   └── Error/            # Error components
│   │   ├── features/             # Feature-specific components
│   │   │   ├── trades/           # Trading components
│   │   │   │   ├── TradesList.tsx
│   │   │   │   ├── TradeForm.tsx
│   │   │   │   └── TradeDetails.tsx
│   │   │   ├── analytics/        # Analytics components
│   │   │   │   ├── PerformanceChart.tsx
│   │   │   │   ├── MetricsCards.tsx
│   │   │   │   └── ReportsTable.tsx
│   │   │   ├── positions/        # Position components
│   │   │   │   ├── PositionsList.tsx
│   │   │   │   ├── PositionCard.tsx
│   │   │   │   └── PositionActions.tsx
│   │   │   └── strategies/       # Strategy components
│   │   │       ├── StrategyList.tsx
│   │   │       ├── StrategyForm.tsx
│   │   │       └── StrategyBacktest.tsx
│   │   ├── layout/               # Layout components
│   │   │   ├── Header.tsx        # Main header
│   │   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   │   ├── Footer.tsx        # Footer
│   │   │   └── Navigation.tsx    # Navigation components
│   │   └── providers/            # Context providers
│   │       ├── ThemeProvider.tsx # Theme management
│   │       ├── AuthProvider.tsx  # Authentication
│   │       └── DataProvider.tsx  # Data fetching
│   ├── hooks/                    # Custom React hooks
│   │   ├── api/                  # API hooks
│   │   │   ├── useTrades.ts      # Trades data hooks
│   │   │   ├── useAnalytics.ts   # Analytics hooks
│   │   │   ├── usePositions.ts   # Positions hooks
│   │   │   └── useWebSocket.ts   # Real-time data hooks
│   │   ├── ui/                   # UI hooks
│   │   │   ├── useModal.ts       # Modal management
│   │   │   ├── useForm.ts        # Form handling
│   │   │   └── useToast.ts       # Notifications
│   │   └── utils/                # Utility hooks
│   │       ├── useLocalStorage.ts
│   │       ├── useDebounce.ts
│   │       └── useMediaQuery.ts
│   ├── lib/                      # Utility libraries
│   │   ├── api/                  # API client
│   │   │   ├── client.ts         # HTTP client
│   │   │   ├── endpoints.ts      # API endpoints
│   │   │   └── types.ts          # API types
│   │   ├── utils/                # Utility functions
│   │   │   ├── formatters.ts     # Data formatting
│   │   │   ├── validators.ts     # Validation utilities
│   │   │   ├── calculations.ts   # Mathematical functions
│   │   │   └── constants.ts      # Application constants
│   │   ├── auth/                 # Authentication
│   │   │   ├── config.ts         # Auth configuration
│   │   │   └── utils.ts          # Auth utilities
│   │   └── charts/               # Chart configurations
│   │       ├── themes.ts         # Chart themes
│   │       └── configs.ts        # Chart configurations
│   ├── styles/                   # Styling
│   │   ├── globals.css           # Global CSS
│   │   ├── components.css        # Component styles
│   │   └── variables.css         # CSS variables
│   ├── types/                    # TypeScript definitions
│   │   ├── index.ts              # Core types
│   │   ├── api.ts                # API types
│   │   ├── components.ts         # Component types
│   │   └── chart.ts              # Chart types
│   └── config/                   # Configuration
│       ├── index.ts              # Main config
│       ├── api.ts                # API configuration
│       └── chart.ts              # Chart configuration
├── public/                       # Static assets
│   ├── icons/                    # Icon files
│   ├── images/                   # Image assets
│   └── favicon.ico               # Favicon
├── docs/                         # Frontend documentation
├── tests/                        # Frontend tests
│   ├── components/               # Component tests
│   ├── hooks/                    # Hook tests
│   ├── utils/                    # Utility tests
│   └── e2e/                      # E2E tests
├── .next/                        # Next.js build output (generated)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.js            # Tailwind CSS config
├── next.config.js                # Next.js config
├── jest.config.js                # Testing config
└── .env.local                    # Environment variables
```

## 🔄 Data Flow Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources  │───▶│  Backend Engine │───▶│  Frontend UI    │
│                 │    │                 │    │                 │
│ • Delta Exchange│    │ • Strategy Exec │    │ • Dashboard     │
│ • Binance       │    │ • Risk Mgmt     │    │ • Analytics     │
│ • WebSocket     │    │ • Portfolio     │    │ • Controls      │
│ • REST APIs     │    │ • Persistence   │    │ • Real-time     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Request Flow
```
Frontend Component
    ↓
Custom Hook (useQuery/useMutation)
    ↓
API Client (Axios/Fetch)
    ↓
Backend API Route
    ↓
Service Layer
    ↓
Repository/Data Provider
    ↓
External API/Database
```

## 🛠️ Development Workflow

### Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd AlgoMCP

# Setup backend
cd backend
npm install
npm run build
npm run test

# Setup frontend
cd ../frontend
npm install
npm run build
npm run test

# Start development servers
npm run dev:backend    # Backend on :3000
npm run dev:frontend   # Frontend on :3001
```

### Code Quality Standards

#### Backend Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Code formatting
- **Jest**: Unit and integration testing
- **Logging**: Winston with structured logging
- **Documentation**: JSDoc for all public methods

#### Frontend Standards
- **TypeScript**: Strict mode with exact types
- **ESLint**: Next.js recommended + custom rules
- **Tailwind CSS**: Utility-first styling
- **Testing**: Jest + React Testing Library
- **Storybook**: Component documentation
- **Accessibility**: WCAG 2.1 AA compliance

## 📊 Performance Considerations

### Backend Optimization
- **Caching**: Redis for session data
- **Database**: Optimized queries with indexes
- **Memory**: Efficient data structures
- **CPU**: Asynchronous processing
- **Network**: Connection pooling

### Frontend Optimization
- **Bundle Size**: Code splitting and tree shaking
- **Rendering**: SSR/SSG where appropriate
- **Images**: Next.js Image optimization
- **Caching**: Browser and CDN caching
- **Lazy Loading**: Component and route level

## 🔒 Security Architecture

### Backend Security
- **Authentication**: JWT tokens
- **Authorization**: Role-based access control
- **Input Validation**: Joi schema validation
- **Rate Limiting**: Express rate limiter
- **CORS**: Configured for specific origins
- **Environment**: Secrets management

### Frontend Security
- **CSP**: Content Security Policy headers
- **XSS Protection**: Input sanitization
- **Authentication**: Secure token storage
- **HTTPS**: SSL/TLS enforcement
- **Dependencies**: Regular security audits

## 📦 Deployment Architecture

### Development
```yaml
# docker-compose.dev.yml
services:
  backend:
    build: ./backend
    ports: ["3000:3000"]
    environment:
      NODE_ENV: development
    volumes:
      - ./backend:/app
  
  frontend:
    build: ./frontend
    ports: ["3001:3001"]
    environment:
      NODE_ENV: development
    volumes:
      - ./frontend:/app
  
  redis:
    image: redis:alpine
    ports: ["6379:6379"]
```

### Production
```yaml
# docker-compose.prod.yml
services:
  backend:
    image: trading-backend:latest
    ports: ["3000:3000"]
    environment:
      NODE_ENV: production
    restart: unless-stopped
  
  frontend:
    image: trading-frontend:latest
    ports: ["80:3000"]
    environment:
      NODE_ENV: production
    restart: unless-stopped
  
  nginx:
    image: nginx:alpine
    ports: ["443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
```

## 📈 Monitoring & Observability

### Logging Strategy
- **Structured Logs**: JSON format with correlation IDs
- **Log Levels**: Error, Warn, Info, Debug
- **Log Aggregation**: ELK stack or similar
- **Metrics**: Prometheus + Grafana
- **Alerts**: Critical error notifications

### Health Checks
- **Backend**: `/health` endpoint with dependency checks
- **Frontend**: Service worker for offline capabilities
- **Infrastructure**: Docker health checks
- **External**: API endpoint monitoring

## 🧪 Testing Strategy

### Backend Testing
```
tests/
├── unit/                    # Individual component tests
│   ├── strategies/          # Strategy unit tests
│   ├── engines/             # Engine unit tests
│   └── utils/               # Utility function tests
├── integration/             # Service integration tests
│   ├── api/                 # API endpoint tests
│   ├── database/            # Database integration tests
│   └── external/            # External API tests
└── e2e/                     # End-to-end testing
    ├── trading/             # Trading workflow tests
    ├── backtesting/         # Backtesting tests
    └── dashboard/           # Dashboard interaction tests
```

### Frontend Testing
```
tests/
├── components/              # Component unit tests
├── hooks/                   # Custom hook tests
├── utils/                   # Utility function tests
├── integration/             # Integration tests
└── e2e/                     # End-to-end tests
    ├── user-flows/          # User journey tests
    ├── performance/         # Performance tests
    └── accessibility/       # A11y tests
```

## 🔧 Configuration Management

### Environment Variables
```bash
# Backend (.env)
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading
DB_USER=admin
DB_PASSWORD=secret

# API Keys
DELTA_API_KEY=your_api_key
DELTA_API_SECRET=your_api_secret
DELTA_BASE_URL=https://api.delta.exchange

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development
```

This enterprise-grade structure provides:

✅ **Scalability**: Modular architecture that can grow
✅ **Maintainability**: Clear separation of concerns
✅ **Testability**: Comprehensive testing strategy
✅ **Security**: Built-in security best practices
✅ **Performance**: Optimized for production use
✅ **Developer Experience**: Clear structure and tooling
✅ **Documentation**: Self-documenting code structure

The structure follows industry best practices and enterprise standards, making it easy for developers to navigate, contribute, and maintain the codebase as it scales.