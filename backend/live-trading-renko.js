#!/usr/bin/env node

/**
 * Live Trading with Renko Strategy
 * Production-ready integration of RenkoTrendStrategy with live trading system
 */

const SuperTrendRenkoStrategy = require('./legacy-src/strategies/superTrendRenkoStrategy');
const { Portfolio } = require('./legacy-src/backtestEngine');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('🚀 Live Renko Trading System');
console.log('=' .repeat(60));

// Initialize strategy with production parameters
const strategy = new SuperTrendRenkoStrategy({
  atrMultiplier: 0.3,            // Smaller bricks for testing (0.3x ATR)
  supertrendPeriod: 10,          // SuperTrend period
  supertrendMultiplier: 3.0,     // SuperTrend multiplier
  macdFast: 12,                  // MACD fast period
  macdSlow: 26,                  // MACD slow period
  macdSignal: 9,                 // MACD signal period
  maxRiskPerTrade: 0.02,         // 2% risk per trade
  minRiskReward: 2.5,            // 2.5:1 risk reward
  minConfluenceScore: 6,         // Lower for testing (6/10)
  cooldownSeconds: 15,           // 15-second cooldown
  priceSource: 'close'           // Use close price
});

const portfolio = new Portfolio(100000);

console.log(`💰 Initial Portfolio: $${portfolio.initialCapital.toLocaleString()}`);
console.log(`📊 Strategy: ${strategy.name}`);
console.log(`🎯 Risk per trade: ${strategy.riskPercentage * 100}%`);
console.log(`🧱 Min consecutive bricks: ${strategy.minConsecutiveBricks}`);
console.log(`📈 Risk/Reward ratio: ${strategy.riskRewardRatio}:1`);
console.log('');

// Core data
let updateCount = 0;
let signalCount = 0;
let tradeCount = 0;
let lastPrice = null;
let trades = [];
let ws = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 50;
let lastUpdateTime = Date.now();
let sessionHighEquity = 100000;
let sessionLowEquity = 100000;

const startTime = Date.now();

// Trade storage setup
const tradesDir = path.join(__dirname, 'dashboard', 'trades');
if (!fs.existsSync(tradesDir)) {
  fs.mkdirSync(tradesDir, { recursive: true });
}

// Enhanced event monitoring for Renko
strategy.getRenkoEngine().on('newBrick', (brick) => {
  console.log(`🧱 Renko Brick #${brick.brickNumber}: ${brick.direction} | $${brick.open.toFixed(2)} -> $${brick.close.toFixed(2)} | Consecutive: ${brick.consecutiveCount}`);
});

strategy.getRenkoEngine().on('trendChange', (data) => {
  console.log(`🔄 Trend Change: ${data.oldDirection} -> ${data.newDirection} (${data.consecutiveCount} consecutive bricks)`);
});

strategy.getRenkoEngine().on('brickSizeCalculated', (data) => {
  console.log(`📏 Renko Brick Size: $${data.optimalBrickSize.toFixed(2)} (ATR: ${data.atr.toFixed(2)}, Multiplier: ${data.multiplier})`);
});

strategy.getRenkoEngine().on('error', (error) => {
  console.error(`❌ Renko Engine Error: ${error.message}`);
});

// Save trade to file
function saveTrade(trade) {
  const date = new Date().toISOString().split('T')[0];
  const tradesFile = path.join(tradesDir, `trades_${date}.json`);
  
  let trades = [];
  if (fs.existsSync(tradesFile)) {
    trades = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
  }
  
  trades.push(trade);
  fs.writeFileSync(tradesFile, JSON.stringify(trades, null, 2));
}

// Save session data with Renko statistics
function saveSessionData() {
  const sessionFile = path.join(tradesDir, 'current_session.json');
  const currentEquity = portfolio.cash + Array.from(portfolio.positions.values())
    .reduce((sum, pos) => sum + (pos.quantity * lastPrice), 0);
  
  const renkoStats = strategy.getRenkoEngine().getStatistics();
  const strategyStats = strategy.getStatistics();
  
  const sessionData = {
    symbol: 'BTCUSD',
    strategy: 'Renko Trend Strategy',
    initialCapital: portfolio.initialCapital,
    startTime: new Date(startTime).toISOString(),
    portfolio: {
      cash: portfolio.cash,
      equity: currentEquity,
      positions: Array.from(portfolio.positions.entries()).map(([symbol, pos]) => ({
        symbol,
        quantity: pos.quantity,
        avgPrice: pos.averagePrice
      })),
      totalReturn: ((currentEquity - portfolio.initialCapital) / portfolio.initialCapital) * 100
    },
    metrics: {
      totalTrades: tradeCount,
      winningTrades: trades.filter(t => t.pnl > 0).length,
      losingTrades: trades.filter(t => t.pnl < 0).length,
      totalPnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      maxDrawdown: ((sessionHighEquity - sessionLowEquity) / sessionHighEquity) * 100,
      winRate: trades.length > 0 ? (trades.filter(t => t.pnl > 0).length / trades.length) * 100 : 0,
      lastUpdate: new Date().toISOString()
    },
    renko: {
      totalBricks: renkoStats.totalBricks,
      currentDirection: renkoStats.currentDirection,
      consecutiveCount: renkoStats.consecutiveCount,
      maxConsecutive: renkoStats.maxConsecutive,
      trendChanges: renkoStats.trendChanges,
      brickSize: renkoStats.brickSize,
      trendStrength: renkoStats.trendStrength,
      entrySignals: strategyStats.entrySignals,
      exitSignals: strategyStats.exitSignals
    },
    lastCandleTime: new Date().toISOString(),
    lastPrice: lastPrice,
    openPositions: portfolio.positions.size,
    lastUpdate: new Date().toISOString()
  };
  
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
}

// Performance tracking with Renko-specific metrics
const performanceTracker = setInterval(() => {
  const runtime = ((Date.now() - startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const rate = updateCount > 0 ? (updateCount / runtime).toFixed(1) : '0.0';
  const timeSinceLastUpdate = ((Date.now() - lastUpdateTime) / 1000).toFixed(0);
  
  // Update session highs/lows
  if (portfolio.equity > sessionHighEquity) sessionHighEquity = portfolio.equity;
  if (portfolio.equity < sessionLowEquity) sessionLowEquity = portfolio.equity;
  
  console.log(`\n📊 RENKO TRADING SESSION (${hours}h ${minutes}m):`);
  console.log(`⚡ Updates: ${updateCount} (${rate}/sec) | Signals: ${signalCount} | Trades: ${tradeCount}`);
  console.log(`💰 Equity: $${portfolio.equity.toLocaleString()} | Cash: $${portfolio.cash.toLocaleString()}`);
  console.log(`📈 Session High: $${sessionHighEquity.toLocaleString()} | Low: $${sessionLowEquity.toLocaleString()}`);
  console.log(`🔗 Connection: ${getConnectionStatus()} | Last Update: ${timeSinceLastUpdate}s ago`);
  
  // Renko-specific status
  const renkoStats = strategy.getRenkoEngine().getStatistics();
  const consecutiveInfo = strategy.getRenkoEngine().getConsecutiveBricks();
  
  console.log(`🧱 Renko Status:`);
  console.log(`   Total Bricks: ${renkoStats.totalBricks} | Brick Size: $${renkoStats.brickSize?.toFixed(2) || 'Calculating...'}`);
  console.log(`   Current Trend: ${consecutiveInfo.count} ${consecutiveInfo.direction || 'INIT'} bricks`);
  console.log(`   Trend Strength: ${(renkoStats.trendStrength * 100).toFixed(1)}% | Max Consecutive: ${renkoStats.maxConsecutive}`);
  console.log(`   Trend Changes: ${renkoStats.trendChanges} | Entry Signals: ${strategy.getStatistics().entrySignals}`);
  
  // Auto-reconnect if no updates for 60 seconds
  if (timeSinceLastUpdate > 60 && reconnectAttempts < maxReconnectAttempts) {
    console.log(`⚠️ No updates for ${timeSinceLastUpdate}s - reconnecting...`);
    reconnectWebSocket();
  }
  
  const btcPosition = portfolio.positions.get('BTCUSD');
  if (btcPosition && btcPosition.quantity > 0) {
    const currentValue = btcPosition.quantity * (lastPrice || 0);
    const pnl = currentValue - (btcPosition.quantity * btcPosition.averagePrice);
    const pnlPercent = (pnl / (btcPosition.quantity * btcPosition.averagePrice)) * 100;
    
    console.log(`📈 Position: ${btcPosition.quantity.toFixed(6)} BTC @ $${btcPosition.averagePrice.toFixed(2)}`);
    console.log(`💵 Value: $${currentValue.toFixed(2)} | P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
  } else {
    console.log(`📊 Position: None (Cash only)`);
  }
  
  // Save session data for dashboard
  saveSessionData();
}, 15000);

function getConnectionStatus() {
  if (!ws) return '❌ Disconnected';
  if (ws.readyState === WebSocket.OPEN) return '✅ Connected';
  if (ws.readyState === WebSocket.CONNECTING) return '🔄 Connecting';
  if (ws.readyState === WebSocket.CLOSING) return '⚠️ Closing';
  return '❌ Closed';
}

function executeTradeSignal(signal, candle) {
  tradeCount++;
  console.log(`\n💰 EXECUTING RENKO TRADE #${tradeCount}:`);
  
  try {
    if (signal.action === 'BUY') {
      const positionValue = signal.positionSize * candle.close;
      
      console.log(`📊 BUY: ${signal.positionSize.toFixed(6)} BTC @ $${candle.close.toFixed(2)}`);
      console.log(`💰 Position Value: $${positionValue.toFixed(2)}`);
      console.log(`🎯 Take Profit: $${signal.takeProfit.toFixed(2)} | Stop Loss: $${signal.stopLoss.toFixed(2)}`);
      console.log(`📊 Risk/Reward: 1:${signal.riskReward?.toFixed(2) || 'N/A'}`);
      
      portfolio.cash -= positionValue;
      portfolio.positions.set('BTCUSD', {
        quantity: signal.positionSize,
        averagePrice: candle.close,
        totalCost: positionValue
      });
      
      console.log(`✅ BUY EXECUTED | Remaining Cash: $${portfolio.cash.toLocaleString()}`);
      
      const trade = {
        id: `renko_trade_${Date.now()}`,
        symbol: 'BTCUSD',
        type: 'BUY',
        signal_type: 'RENKO_LONG_ENTRY',
        quantity: signal.positionSize,
        entryPrice: candle.close,
        entryTime: new Date().toISOString(),
        reason: signal.reason,
        takeProfitPrice: signal.takeProfit,
        stopLossPrice: signal.stopLoss,
        confidence: signal.confidence,
        riskReward: signal.riskReward,
        status: 'OPEN',
        timestamp: new Date().toISOString(),
        renkoBricks: strategy.getRenkoEngine().getConsecutiveBricks(),
        brickSize: strategy.getRenkoEngine().getCurrentBrickSize()
      };
      
      trades.push(trade);
      saveTrade(trade);
    }
    
    if (signal.action === 'SELL') {
      const position = portfolio.positions.get('BTCUSD');
      if (position && position.quantity > 0) {
        console.log(`📊 SELL: ${position.quantity.toFixed(6)} BTC @ $${candle.close.toFixed(2)}`);
        console.log(`💡 Reason: ${signal.reason}`);
        
        const sellValue = position.quantity * candle.close;
        const pnl = sellValue - position.totalCost;
        const pnlPercent = (pnl / position.totalCost) * 100;
        
        portfolio.cash += sellValue;
        portfolio.positions.delete('BTCUSD');
        
        console.log(`✅ SELL EXECUTED | P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
        console.log(`💰 New Cash: $${portfolio.cash.toLocaleString()}`);
        
        // Update the open trade
        const openTrade = trades.find(t => t.status === 'OPEN');
        if (openTrade) {
          openTrade.status = 'CLOSED';
          openTrade.exitPrice = candle.close;
          openTrade.exitTime = new Date().toISOString();
          openTrade.pnl = pnl;
          openTrade.pnlPercent = pnlPercent;
          openTrade.exitReason = signal.reason;
          openTrade.holdingPeriod = Math.floor((Date.now() - new Date(openTrade.entryTime).getTime()) / 60000);
        }
      }
    }
    
    const position = portfolio.positions.get('BTCUSD');
    portfolio.equity = portfolio.cash + (position ? position.quantity * candle.close : 0);
    
    saveSessionData();
    
  } catch (error) {
    console.error(`❌ Trade execution error: ${error.message}`);
  }
}

function connectWebSocket() {
  console.log(`📡 Connecting to WebSocket (attempt ${reconnectAttempts + 1})...`);
  
  ws = new WebSocket('wss://socket.delta.exchange');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    reconnectAttempts = 0;
    
    const subscribeMessage = {
      type: 'subscribe',
      payload: {
        channels: [
          { name: 'v2/ticker', symbols: ['BTCUSD'] }
        ]
      }
    };
    
    ws.send(JSON.stringify(subscribeMessage));
    console.log('📡 Renko trading channels subscribed');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      lastUpdateTime = Date.now();
      
      if (message.type === 'subscriptions') {
        console.log('🚀 RENKO TRADING ACTIVE!\n');
        return;
      }
      
      let currentPrice = null;
      let volume = 1000;
      
      if (message.type === 'v2/ticker') {
        currentPrice = parseFloat(message.close || message.mark_price);
        volume = parseFloat(message.volume || 1000);
        
        // Log mark price
        if (message.mark_price) {
          console.log(`📍 Mark Price: $${parseFloat(message.mark_price).toFixed(2)} | Time: ${new Date().toISOString().substring(11, 19)}`);
        }
      }
      
      if (currentPrice && currentPrice > 0) {
        updateCount++;
        lastPrice = currentPrice;
        
        // Create candle data for strategy
        const candle = {
          timestamp: new Date(),
          open: currentPrice,
          high: currentPrice * 1.0001,
          low: currentPrice * 0.9999,
          close: currentPrice,
          volume: volume
        };
        
        try {
          // Generate Renko signal
          const signal = strategy.generateSignal(candle, [], portfolio);
          
          if (signal) {
            signalCount++;
            
            console.log(`\n🎯 RENKO SIGNAL #${signalCount}:`);
            console.log(`📊 ${signal.action} at $${currentPrice.toFixed(2)}`);
            console.log(`💡 ${signal.reason}`);
            console.log(`🎯 Confidence: ${((signal.confidence || 0) * 100).toFixed(1)}%`);
            
            if (signal.takeProfit) {
              console.log(`📈 Take Profit: $${signal.takeProfit.toFixed(2)}`);
            }
            if (signal.stopLoss) {
              console.log(`📉 Stop Loss: $${signal.stopLoss.toFixed(2)}`);
            }
            
            executeTradeSignal(signal, candle);
          }
        } catch (error) {
          console.error(`❌ Strategy error: ${error.message}`);
        }
        
        // Update portfolio equity
        const position = portfolio.positions.get('BTCUSD');
        if (position) {
          portfolio.equity = portfolio.cash + (position.quantity * currentPrice);
        }
      }
      
    } catch (error) {
      // Silently ignore parsing errors
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket disconnected: ${code} ${reason}`);
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectWebSocket();
    }
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error: ${error.message}`);
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectWebSocket();
    }
  });
  
  return ws;
}

function reconnectWebSocket() {
  if (ws) {
    ws.removeAllListeners();
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }
  
  reconnectAttempts++;
  
  if (reconnectAttempts > maxReconnectAttempts) {
    console.error(`❌ Max reconnection attempts exceeded!`);
    cleanup();
    return;
  }
  
  const backoffTime = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts, 10)), 60000);
  console.log(`🔄 Reconnecting in ${backoffTime/1000}s...`);
  
  setTimeout(() => {
    if (reconnectAttempts <= maxReconnectAttempts) {
      connectWebSocket();
    }
  }, backoffTime);
}

function cleanup() {
  clearInterval(performanceTracker);
  
  const runtime = ((Date.now() - startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL RENKO TRADING SESSION RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Runtime: ${hours}h ${minutes}m | Updates: ${updateCount}`);
  console.log(`🎯 Signals: ${signalCount} | Trades: ${tradeCount}`);
  console.log(`💰 Final Equity: $${portfolio.equity.toLocaleString()}`);
  
  const totalReturn = portfolio.equity - portfolio.initialCapital;
  const returnPercent = (totalReturn / portfolio.initialCapital) * 100;
  console.log(`📊 Total Return: $${totalReturn.toFixed(2)} (${returnPercent.toFixed(2)}%)`);
  
  // Final Renko statistics
  const renkoStats = strategy.getRenkoEngine().getStatistics();
  const strategyStats = strategy.getStatistics();
  
  console.log(`\n🧱 Renko Engine Final Stats:`);
  console.log(`   Total Bricks: ${renkoStats.totalBricks}`);
  console.log(`   Trend Changes: ${renkoStats.trendChanges}`);
  console.log(`   Max Consecutive: ${renkoStats.maxConsecutive}`);
  console.log(`   Final Trend: ${renkoStats.consecutiveCount} ${renkoStats.currentDirection} bricks`);
  
  console.log(`\n📊 Strategy Performance:`);
  console.log(`   Entry Signals: ${strategyStats.entrySignals}`);
  console.log(`   Exit Signals: ${strategyStats.exitSignals}`);
  console.log(`   Trend Exhaustion Exits: ${strategyStats.trendExhaustionExits}`);
  
  console.log(`\n✅ Renko Trading Session Complete!`);
  process.exit(0);
}

// Start the system
console.log('🎯 Starting Renko trading system...');
console.log('💡 Press Ctrl+C to stop at any time\n');
connectWebSocket();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Shutdown signal received...');
  console.log('🔄 Closing positions and saving results...');
  if (ws) ws.close();
  cleanup();
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Unexpected error:', error.message);
  console.log('🔄 Attempting to recover...');
  reconnectWebSocket();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n⚠️ Unhandled promise rejection:', reason);
  console.log('🔄 System continuing...');
});