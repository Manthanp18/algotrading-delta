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

**Environment Setup:**
- Requires `.env` file with Delta Exchange API credentials:
  - `DELTA_API_KEY`
  - `DELTA_API_SECRET`
  - `DELTA_BASE_URL`