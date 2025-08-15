# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Node.js backtesting engine for cryptocurrency trading strategies using the Delta Exchange API. The system fetches real market data and simulates trading with portfolio management, including support for both long and short positions.

## Common Commands

**Basic Operations:**
- `npm start` - Run a backtest using the default strategy (index.js)
- `npm test` - Run Jest tests
- `npm run dev` - Run with nodemon for development

**CLI Operations:**
- `node cli.js run` - Run a new backtest
- `node cli.js list` - List all saved backtest results
- `node cli.js view <filename>` - View detailed results
- `node cli.js compare <file1> <file2>` - Compare multiple results
- `node cli.js export <filename>` - Export results to CSV
- `node cli.js cleanup [days]` - Delete old results (default: 30 days)

## Architecture

**Core Components:**

- **BacktestEngine** (`src/backtestEngine.js`) - Main engine that processes candle data and executes trades. Contains Portfolio class for position management and supports both long/short positions.
- **DataFetcher** (`src/dataFetcher.js`) - Handles Delta Exchange API integration for fetching historical OHLC data.
- **Strategy Framework** (`src/strategies/`) - Base class system for implementing trading strategies with built-in technical indicators (SMA, EMA, RSI).
- **Result Management** (`src/resultStorage.js`, `src/resultViewer.js`) - Handles saving, loading, and comparing backtest results.

**Key Features:**
- Supports both long and short positions with automatic position closing
- Portfolio tracks cash, positions, and equity with realistic trade execution
- Extensible strategy system with technical indicator utilities
- Comprehensive result storage with JSON files in `backtest-results/`

**Data Flow:**
1. DataFetcher retrieves 5-minute OHLC candles from Delta Exchange
2. BacktestEngine loads data and processes each candle sequentially
3. Strategy generates buy/sell signals based on technical analysis
4. Engine executes trades, manages portfolio, and tracks performance
5. Results are stored with detailed metrics and trade history

## Live Trading Components

**Live Trading Engine:**
- **LiveTradingEngine** (`src/liveTradingEngine.js`) - Real-time trading engine that processes live candle data and executes trades
- **LiveDataFetcherWS** (`src/liveDataFetcherWS.js`) - Optimized WebSocket-first data fetcher with REST fallback (95% cost reduction)
- **LiveSessionManager** (`src/liveSessionManager.js`) - Manages live trading sessions with event handling and persistence

**Live Trading Scripts:**
- `websocket-simulation.js` - Full-featured WebSocket trading simulation with comprehensive monitoring
- `run-public-live.js` - Public live trading using LiveSessionManager (no auth required)
- `simple-live.js` - Simplified live trading interface
- `server-live.js` - Live trading with integrated dashboard server

**Data Flow (Live Trading):**
1. LiveDataFetcherWS connects via WebSocket to Delta Exchange (`wss://socket.delta.exchange`)
2. Subscribes to v2/ticker channel for real-time price and volume updates
3. Constructs 1-minute OHLCV candles from ticker data in real-time
4. Falls back to REST API polling (every 5 minutes) if WebSocket connection fails
5. LiveTradingEngine processes each new candle through the selected strategy
6. Trades are executed in simulation mode with full portfolio tracking

**Environment Setup:**
- Requires `.env` file with Delta Exchange API credentials:
  - `DELTA_API_KEY`
  - `DELTA_API_SECRET`
  - `DELTA_BASE_URL`
- Note: Simulation mode works without credentials using public data feeds

## Trading Dashboard

**Next.js Dashboard** (`trading-dashboard/`) - Comprehensive web-based dashboard for monitoring trading activities

**Features:**
- **Live Positions**: Real-time portfolio tracking with current positions, unrealized P&L, and session metrics
- **Trade History**: Complete trading history with advanced filtering, sorting, and detailed trade information
- **Analytics**: Performance metrics, win rate analysis, cumulative P&L charts, and hourly breakdowns

**Dashboard Commands:**
- `cd trading-dashboard && ./start-dashboard.sh` - Start the web dashboard
- `cd trading-dashboard && npm run dev` - Start development server manually
- `cd trading-dashboard && npm run build` - Build for production

**Dashboard API Endpoints:**
- `/api/session` - Current live trading session data
- `/api/trades?date=YYYY-MM-DD` - Trading history for specific date
- `/api/analytics?date=YYYY-MM-DD` - Performance analytics and metrics

**Data Integration:**
- Automatically reads from `dashboard/trades/current_session.json` for live data
- Reads from `dashboard/trades/trades_YYYY-MM-DD.json` for historical trades
- Real-time updates every 30 seconds for live session data
- No additional configuration required - connects to existing trading system data

**Technology Stack:**
- Next.js 15 with React 19 for optimal performance
- Tailwind CSS for responsive design
- Recharts for interactive trading charts
- TypeScript for type safety
- Lucide React for modern icons