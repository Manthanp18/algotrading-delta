# Renko Trading Strategy Implementation Guide

## Overview

This implementation provides a complete Renko-based trading system with two main components:
1. **RenkoEngine** - Core Renko chart calculation engine
2. **RenkoTrendStrategy** - Trend-following trading strategy

## Features

### ✅ Core Renko Engine Features
- **ATR-based brick sizing** with automatic calculation
- **Real-time price updates** with multi-brick formation support
- **Multiple price sources** (close, hl2, hlc3, ohlc4)
- **Event-driven architecture** with comprehensive monitoring
- **Trend analysis** with consecutive brick counting and strength measurement
- **Error handling** with graceful degradation

### ✅ Trading Strategy Features
- **Entry Rules**: Minimum 3 consecutive bricks in same direction
- **Exit Rules**: 2 opposite bricks OR trend exhaustion after 15 bricks
- **Risk Management**: 2% default risk with dynamic position sizing
- **Stop Loss**: 5-brick lookback with 0.5 brick buffer
- **Take Profit**: 2.5x risk-reward ratio
- **Confidence Scoring**: Based on trend strength and consecutive count

## Installation & Setup

### 1. File Structure
```
backend/
├── legacy-src/
│   ├── engines/
│   │   └── RenkoEngine.js          # Core Renko calculation engine
│   └── strategies/
│       └── renkoTrendStrategy.js   # Trading strategy implementation
├── live-trading-renko.js           # Production live trading script
└── test-renko-integration.js       # Integration test script
```

### 2. Dependencies
All required dependencies are already available in your existing Node.js setup:
- `events` (EventEmitter for event handling)
- `ws` (WebSocket for live data)
- `fs` (File system for trade storage)

## Usage Examples

### Basic Strategy Usage

```javascript
const RenkoTrendStrategy = require('./legacy-src/strategies/renkoTrendStrategy');
const { Portfolio } = require('./legacy-src/backtestEngine');

// Initialize strategy with custom parameters
const strategy = new RenkoTrendStrategy({
  riskPercentage: 0.02,          // 2% risk per trade
  minConsecutiveBricks: 3,       // Min consecutive bricks for entry
  maxTrendLength: 15,            // Max trend length before exhaustion
  atrPeriod: 14,                 // ATR period for brick sizing
  atrMultiplier: 0.5,            // ATR multiplier (0.5 = smaller bricks)
  riskRewardRatio: 2.5           // Risk/reward ratio
});

const portfolio = new Portfolio(100000);

// Process candle data
const signal = strategy.generateSignal(candle, historicalData, portfolio);

if (signal) {
  console.log(`Signal: ${signal.action} at $${signal.entryPrice}`);
  console.log(`Stop Loss: $${signal.stopLoss}`);
  console.log(`Take Profit: $${signal.takeProfit}`);
  console.log(`Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
}
```

### Advanced Renko Engine Usage

```javascript
const RenkoEngine = require('./legacy-src/engines/RenkoEngine');

// Initialize with custom options
const renkoEngine = new RenkoEngine({
  priceSource: 'hlc3',           // Use HLC3 price
  atrPeriod: 20,                 // 20-period ATR
  atrMultiplier: 0.3,            // Smaller bricks (0.3x ATR)
  autoCalculateBrickSize: true   // Auto-calculate brick size
});

// Event handling
renkoEngine.on('newBrick', (brick) => {
  console.log(`New ${brick.direction} brick: $${brick.close.toFixed(2)}`);
});

renkoEngine.on('trendChange', (data) => {
  console.log(`Trend changed: ${data.oldDirection} -> ${data.newDirection}`);
});

// Update with price data
const newBrickFormed = renkoEngine.updatePrice({
  close: 118500,
  high: 118520,
  low: 118480,
  timestamp: new Date()
});

// Get trend information
const consecutive = renkoEngine.getConsecutiveBricks();
console.log(`${consecutive.count} consecutive ${consecutive.direction} bricks`);

const trendStrength = renkoEngine.getRenkoTrendStrength();
console.log(`Trend strength: ${(trendStrength * 100).toFixed(1)}%`);
```

## Running the System

### 1. Integration Test
```bash
cd backend/legacy-src
node test-renko-integration.js
```

### 2. Live Trading
```bash
cd backend
node live-trading-renko.js
```

### 3. Replace Existing Strategy
To use Renko strategy in your current live trading system:

```javascript
// In live-trading-continuous.js, replace:
const EliteScalpingStrategy = require('./legacy-src/strategies/eliteScalpingStrategy');
const strategy = new EliteScalpingStrategy(0.05);

// With:
const RenkoTrendStrategy = require('./legacy-src/strategies/renkoTrendStrategy');
const strategy = new RenkoTrendStrategy({
  riskPercentage: 0.02,
  minConsecutiveBricks: 3,
  maxTrendLength: 12,
  atrMultiplier: 0.4
});
```

## Signal Format

The strategy generates signals in the standard format compatible with your existing trading system:

```javascript
{
  action: 'BUY'|'SELL'|'CLOSE',     // Trading action
  entryPrice: 118500.50,             // Entry price
  stopLoss: 118200.25,               // Stop loss price
  takeProfit: 119250.75,             // Take profit price
  positionSize: 0.042444,            // Position size in BTC
  confidence: 0.75,                  // Confidence score (0-1)
  reason: "Renko UP trend: 4 consecutive bricks (confidence: 75.0%)",
  signal_type: 'LONG_ENTRY',         // Signal type
  riskAmount: 2000,                  // Risk amount in USD
  stopDistance: 300.25,              // Distance to stop loss
  riskReward: 2.5                    // Risk/reward ratio
}
```

## Configuration Parameters

### RenkoEngine Options
```javascript
{
  brickSize: null,                   // Manual brick size (null = auto-calculate)
  priceSource: 'close',              // 'close', 'hl2', 'hlc3', 'ohlc4'
  atrPeriod: 14,                     // ATR calculation period
  atrMultiplier: 0.5,                // ATR multiplier for brick size
  autoCalculateBrickSize: true       // Auto-calculate brick size
}
```

### RenkoTrendStrategy Options
```javascript
{
  riskPercentage: 0.02,              // 2% risk per trade
  minConsecutiveBricks: 3,           // Min consecutive for entry
  maxTrendLength: 15,                // Max trend before exhaustion
  exitConsecutiveBricks: 2,          // Opposite bricks for exit
  stopLossLookback: 5,               // Bricks for stop loss calculation
  stopLossBufferMultiplier: 0.5,     // Stop loss buffer (0.5x brick size)
  riskRewardRatio: 2.5,              // Risk/reward ratio
  maxPositionSize: 0.1,              // Max 10% of portfolio
  atrPeriod: 14,                     // ATR period
  atrMultiplier: 0.5,                // ATR multiplier
  priceSource: 'close'               // Price source
}
```

## Performance Monitoring

### Real-time Statistics
The system provides comprehensive real-time monitoring:

```
📊 RENKO TRADING SESSION (2h 15m):
⚡ Updates: 4250 (0.5/sec) | Signals: 12 | Trades: 8
💰 Equity: $102,450 | Cash: $95,200
🧱 Renko Status:
   Total Bricks: 145 | Brick Size: $118.50
   Current Trend: 4 UP bricks
   Trend Strength: 32.1% | Max Consecutive: 8
   Trend Changes: 23 | Entry Signals: 8
```

### Dashboard Integration
The system automatically saves trading data compatible with your existing dashboard:
- `dashboard/trades/current_session.json` - Live session data
- `dashboard/trades/trades_YYYY-MM-DD.json` - Daily trade history

## Event System

### Available Events

#### RenkoEngine Events
- `newBrick` - New brick formed
- `multipleBricks` - Multiple bricks formed at once
- `trendChange` - Trend direction changed
- `brickSizeCalculated` - Brick size calculated
- `error` - Engine error occurred

#### Strategy Events
- Inherits all RenkoEngine events
- Integrates with existing portfolio events

### Event Handling Example
```javascript
strategy.getRenkoEngine().on('newBrick', (brick) => {
  console.log(`Brick #${brick.brickNumber}: ${brick.direction}`);
  
  // Custom logic here
  if (brick.consecutiveCount >= 5) {
    console.log('Strong trend detected!');
  }
});

strategy.getRenkoEngine().on('trendChange', (data) => {
  console.log(`Trend reversal: ${data.consecutiveCount} bricks`);
  
  // Alert or notification logic
  sendAlert(`Renko trend changed to ${data.newDirection}`);
});
```

## Backtesting Support

The system supports backtesting with historical data:

```javascript
// Load historical candle data
const historicalData = loadHistoricalData('BTCUSD', '1m');

// Process each candle
for (const candle of historicalData) {
  const signal = strategy.generateSignal(candle, [], portfolio);
  
  if (signal) {
    // Execute trade in backtest
    executeBacktestTrade(signal, candle, portfolio);
  }
}

// Analyze results
const results = analyzeBacktestResults(portfolio, trades);
```

## Tips for Optimization

### 1. Brick Size Tuning
- **Smaller bricks** (lower ATR multiplier): More signals, faster reactions
- **Larger bricks** (higher ATR multiplier): Fewer signals, less noise

### 2. Risk Management
- **Conservative**: 1% risk, 3:1 reward ratio
- **Aggressive**: 3% risk, 2:1 reward ratio
- **Balanced**: 2% risk, 2.5:1 reward ratio (default)

### 3. Trend Parameters
- **Scalping**: 2-3 min consecutive, 8-10 max length
- **Swing Trading**: 4-5 min consecutive, 20+ max length
- **Day Trading**: 3-4 min consecutive, 15 max length (default)

### 4. Market Conditions
- **Trending Markets**: Lower min consecutive (2-3)
- **Choppy Markets**: Higher min consecutive (4-5)
- **High Volatility**: Larger ATR multiplier (0.6-0.8)
- **Low Volatility**: Smaller ATR multiplier (0.3-0.4)

## Troubleshooting

### Common Issues

1. **No Signals Generated**
   - Check if brick size is calculated (needs 14+ candles)
   - Verify price updates are calling `updatePrice()`
   - Check if minimum consecutive bricks requirement is met

2. **Too Many Signals**
   - Increase `minConsecutiveBricks` parameter
   - Increase `atrMultiplier` for larger bricks
   - Add volume or other filters

3. **Poor Performance**
   - Adjust `riskRewardRatio` for better risk management
   - Tune `maxTrendLength` for market conditions
   - Consider different `priceSource` (hlc3 often works better)

### Debug Mode
Enable debug logging:
```javascript
strategy.getRenkoEngine().on('error', (error) => {
  console.error('Renko Error:', error);
});

// Check engine statistics
console.log(strategy.getRenkoEngine().getStatistics());
console.log(strategy.getStatistics());
```

## Conclusion

This Renko trading system provides a robust, production-ready implementation with:
- ✅ Mathematical accuracy in Renko calculations
- ✅ Comprehensive risk management
- ✅ Real-time monitoring and events
- ✅ Seamless integration with existing infrastructure
- ✅ Extensive customization options

The system is designed to be both powerful for advanced users and simple for basic usage, with sensible defaults that work well for most market conditions.

For support or questions, refer to the test files and example implementations provided.