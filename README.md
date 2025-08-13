# Backtesting Engine

A Node.js backtesting engine for trading strategies using real market data from Delta Exchange API.

## Features

- **Real Market Data**: Fetches 5-minute OHLC candles from Delta Exchange
- **Portfolio Management**: Tracks cash, positions, and equity over time
- **Trade Simulation**: Realistic execution with slippage and commission costs
- **Strategy Framework**: Extensible base class for implementing trading strategies
- **Performance Analysis**: Comprehensive metrics including returns, drawdown, and win rate

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your Delta Exchange API credentials
```

3. Run backtest:
```bash
npm start
```

## Configuration

- **Initial Capital**: $100,000 (configurable)
- **Timeframe**: 5-minute candles
- **Default Strategy**: SMA Crossover (20/50 periods)
- **Position Size**: 10% of available capital per trade

## Strategy Development

Extend the `BaseStrategy` class to create custom strategies:

```javascript
const BaseStrategy = require('./src/strategies/baseStrategy');

class MyStrategy extends BaseStrategy {
  generateSignal(currentCandle, historicalData, portfolio) {
    // Your strategy logic here
    return {
      action: 'BUY', // or 'SELL'
      quantity: 100,
      reason: 'Custom signal'
    };
  }
}
```

## API Requirements

Get your API credentials from Delta Exchange and add them to `.env`:
- `DELTA_API_KEY`: Your API key
- `DELTA_API_SECRET`: Your API secret