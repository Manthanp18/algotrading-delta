#!/usr/bin/env node

/**
 * Continuous Production Trading System
 * Runs 24/7 until manually stopped with Ctrl+C
 * Auto-reconnection ensures continuous data flow
 */

const ConfluenceScalpingStrategy = require('./legacy-src/strategies/confluenceScalpingStrategy');
const { Portfolio } = require('./legacy-src/backtestEngine');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('🚀 Continuous Production Trading System (24/7)');
console.log('=' .repeat(60));

const strategy = new ConfluenceScalpingStrategy(0.05);
const portfolio = new Portfolio(100000);

console.log(`💰 Initial Portfolio: $${portfolio.initialCapital.toLocaleString()}`);
console.log(`📊 Position Size: 5% | Auto-Reconnect: ON`);
console.log(`⏰ Runtime: Continuous (Stop with Ctrl+C)\n`);

// Core data
let candleHistory = [];
let currentCandle = null;
let candleStartTime = null;
let updateCount = 0;
let signalCount = 0;
let tradeCount = 0;
let lastPrice = null;
let trades = [];
let ws = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10000; // Virtually unlimited
let lastUpdateTime = Date.now();
let sessionHighEquity = 100000;
let sessionLowEquity = 100000;

const startTime = Date.now();

// Trade storage setup
const tradesDir = path.join(__dirname, 'dashboard', 'trades');
if (!fs.existsSync(tradesDir)) {
  fs.mkdirSync(tradesDir, { recursive: true });
}

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

// Save session data
function saveSessionData() {
  const sessionFile = path.join(tradesDir, 'current_session.json');
  const currentEquity = portfolio.cash + Array.from(portfolio.positions.values())
    .reduce((sum, pos) => sum + (pos.quantity * lastPrice), 0);
  
  const sessionData = {
    symbol: 'BTCUSD',
    strategy: 'Confluence Scalping',
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
    lastCandleTime: currentCandle ? new Date(currentCandle.timestamp).toISOString() : null,
    lastPrice: lastPrice,
    openPositions: portfolio.positions.size,
    lastUpdate: new Date().toISOString()
  };
  
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
}

function createBootstrapCandles(price, count = 20) {
  const candles = [];
  const now = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60000));
    timestamp.setSeconds(0, 0);
    
    const basePrice = price + (Math.random() - 0.5) * 100;
    const high = basePrice + Math.random() * 50;
    const low = basePrice - Math.random() * 50;
    
    candles.push({
      timestamp,
      open: Math.max(low + Math.random() * (high - low), 1000),
      high: Math.max(high, 1000),
      low: Math.max(low, 1000),
      close: Math.max(low + Math.random() * (high - low), 1000),
      volume: 1000000 + Math.random() * 2000000
    });
  }
  
  return candles;
}

// Performance tracking with session stats
const performanceTracker = setInterval(() => {
  const runtime = ((Date.now() - startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const rate = updateCount > 0 ? (updateCount / runtime).toFixed(1) : '0.0';
  const timeSinceLastUpdate = ((Date.now() - lastUpdateTime) / 1000).toFixed(0);
  
  // Update session highs/lows
  if (portfolio.equity > sessionHighEquity) sessionHighEquity = portfolio.equity;
  if (portfolio.equity < sessionLowEquity) sessionLowEquity = portfolio.equity;
  
  console.log(`\n📊 SESSION STATUS (${hours}h ${minutes}m):`);
  console.log(`⚡ Updates: ${updateCount} (${rate}/sec) | Signals: ${signalCount} | Trades: ${tradeCount}`);
  console.log(`💰 Equity: $${portfolio.equity.toLocaleString()} | Cash: $${portfolio.cash.toLocaleString()}`);
  console.log(`📈 Session High: $${sessionHighEquity.toLocaleString()} | Low: $${sessionLowEquity.toLocaleString()}`);
  console.log(`🔗 Connection: ${getConnectionStatus()} | Last Update: ${timeSinceLastUpdate}s ago`);
  
  // Auto-reconnect if no updates for 30 seconds
  if (timeSinceLastUpdate > 30 && reconnectAttempts < maxReconnectAttempts) {
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
  
  // Daily summary every 24 hours
  if (hours > 0 && hours % 24 === 0 && minutes === 0) {
    printDailySummary();
  }
  
  // Save session data periodically for dashboard updates
  saveSessionData();
}, 15000);

function printDailySummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 24-HOUR SUMMARY');
  console.log('='.repeat(60));
  const totalReturn = portfolio.equity - portfolio.initialCapital;
  const returnPercent = (totalReturn / portfolio.initialCapital) * 100;
  console.log(`💰 Current Equity: $${portfolio.equity.toLocaleString()}`);
  console.log(`📈 24h Return: $${totalReturn.toFixed(2)} (${returnPercent.toFixed(2)}%)`);
  console.log(`🎯 Total Trades: ${tradeCount}`);
  console.log('='.repeat(60) + '\n');
}

function getConnectionStatus() {
  if (!ws) return '❌ Disconnected';
  if (ws.readyState === WebSocket.OPEN) return '✅ Connected';
  if (ws.readyState === WebSocket.CONNECTING) return '🔄 Connecting';
  if (ws.readyState === WebSocket.CLOSING) return '⚠️ Closing';
  return '❌ Closed';
}

function initializeCurrentCandle(price) {
  const now = new Date();
  const candleStart = new Date(now);
  candleStart.setSeconds(0, 0);
  
  candleStartTime = candleStart.getTime();
  currentCandle = {
    timestamp: candleStart,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0
  };
}

function updateCurrentCandle(price, volume = 1000) {
  if (!currentCandle) {
    initializeCurrentCandle(price);
    return;
  }
  
  currentCandle.high = Math.max(currentCandle.high, price);
  currentCandle.low = Math.min(currentCandle.low, price);
  currentCandle.close = price;
  currentCandle.volume += volume;
  
  const candleAge = Date.now() - candleStartTime;
  if (candleAge >= 60000) {
    completeCurrentCandle();
    initializeCurrentCandle(price);
  }
}

function closeExistingPosition(currentPrice) {
  const position = portfolio.positions.get('BTCUSD');
  if (position && position.quantity > 0) {
    console.log(`\n🔄 CLOSING POSITION:`);
    console.log(`📊 Closing ${position.quantity.toFixed(6)} BTC @ $${currentPrice.toFixed(2)}`);
    
    const sellValue = position.quantity * currentPrice;
    const buyValue = position.quantity * position.averagePrice;
    const pnl = sellValue - buyValue;
    const pnlPercent = (pnl / buyValue) * 100;
    
    portfolio.cash += sellValue;
    portfolio.positions.delete('BTCUSD');
    
    console.log(`✅ Position closed: P&L $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    console.log(`💰 New Cash: $${portfolio.cash.toLocaleString()}`);
    
    // Find the open trade to close
    const openTrade = trades.find(t => t.status === 'OPEN');
    if (openTrade) {
      openTrade.status = 'CLOSED';
      openTrade.exitPrice = currentPrice;
      openTrade.exitTime = new Date().toISOString();
      openTrade.pnl = pnl;
      openTrade.pnlPercent = pnlPercent;
      openTrade.holdingPeriod = Math.floor((Date.now() - new Date(openTrade.entryTime).getTime()) / 60000);
      openTrade.exitReason = 'Signal reversal';
      
      // Update the trade in the file
      const date = new Date().toISOString().split('T')[0];
      const tradesFile = path.join(tradesDir, `trades_${date}.json`);
      if (fs.existsSync(tradesFile)) {
        let allTrades = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
        const index = allTrades.findIndex(t => t.id === openTrade.id);
        if (index !== -1) {
          allTrades[index] = openTrade;
          fs.writeFileSync(tradesFile, JSON.stringify(allTrades, null, 2));
        }
      }
    }
    
    trades.push({
      type: 'CLOSE',
      quantity: position.quantity,
      price: currentPrice,
      pnl: pnl,
      pnlPercent: pnlPercent,
      timestamp: new Date()
    });
    
    saveSessionData();
  }
  return true;
}

function completeCurrentCandle() {
  if (!currentCandle) return;
  
  candleHistory.push({ ...currentCandle });
  if (candleHistory.length > 100) candleHistory.shift();
  
  console.log(`\n✅ CANDLE #${candleHistory.length}:`);
  console.log(`⏰ ${currentCandle.timestamp.toISOString().substring(11, 19)}`);
  console.log(`📊 O:${currentCandle.open.toFixed(2)} H:${currentCandle.high.toFixed(2)} L:${currentCandle.low.toFixed(2)} C:${currentCandle.close.toFixed(2)} V:${currentCandle.volume.toLocaleString()}`);
  
  if (candleHistory.length >= 15) {
    try {
      const signal = strategy.generateSignal(currentCandle, candleHistory, portfolio);
      
      if (signal && signal.action !== 'HOLD') {
        signalCount++;
        
        const fixedSignal = {
          action: signal.action,
          size: signal.quantity || signal.size || 0.05,
          confidence: signal.confidence || 'High',
          reason: signal.reason
        };
        
        console.log(`\n🎯 SIGNAL #${signalCount}:`);
        console.log(`📊 ${fixedSignal.action} at $${currentCandle.close.toFixed(2)}`);
        console.log(`💡 ${fixedSignal.reason}`);
        
        executeTradeSignal(fixedSignal, currentCandle);
      }
    } catch (error) {
      console.error(`❌ Strategy error: ${error.message}`);
    }
  }
}

function executeTradeSignal(signal, candle) {
  tradeCount++;
  console.log(`\n💰 EXECUTING TRADE #${tradeCount}:`);
  
  try {
    closeExistingPosition(candle.close);
    
    if (signal.action === 'BUY') {
      const positionValue = portfolio.cash * 0.05;
      const quantity = positionValue / candle.close;
      
      console.log(`📊 BUY: ${quantity.toFixed(6)} BTC @ $${candle.close.toFixed(2)}`);
      console.log(`💰 Position Value: $${positionValue.toFixed(2)}`);
      
      portfolio.cash -= positionValue;
      portfolio.positions.set('BTCUSD', {
        quantity: quantity,
        averagePrice: candle.close,
        totalCost: positionValue
      });
      
      console.log(`✅ BUY EXECUTED | Remaining Cash: $${portfolio.cash.toLocaleString()}`);
      
      const trade = {
        id: `trade_${Date.now()}`,
        symbol: 'BTCUSD',
        type: 'BUY',
        signal_type: 'LONG_ENTRY',
        quantity: quantity,
        entryPrice: candle.close,
        entryTime: new Date().toISOString(),
        reason: signal.reason || 'Confluence signal',
        takeProfitPrice: candle.close * 1.03,
        stopLossPrice: candle.close * 0.98,
        status: 'OPEN',
        timestamp: new Date().toISOString()
      };
      
      trades.push(trade);
      saveTrade(trade);
      saveSessionData();
    }
    
    const position = portfolio.positions.get('BTCUSD');
    portfolio.equity = portfolio.cash + (position ? position.quantity * candle.close : 0);
    
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
          { name: 'v2/ticker', symbols: ['BTCUSD'] },
          { name: 'l2_orderbook', symbols: ['BTCUSD'] }
        ]
      }
    };
    
    ws.send(JSON.stringify(subscribeMessage));
    console.log('📡 High-frequency channels subscribed');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      lastUpdateTime = Date.now();
      
      if (message.type === 'subscriptions') {
        console.log('🚀 CONTINUOUS TRADING ACTIVE! (Stop with Ctrl+C)\n');
        return;
      }
      
      let currentPrice = null;
      let volume = 1000;
      
      if (message.type === 'v2/ticker') {
        currentPrice = parseFloat(message.close || message.mark_price);
        volume = parseFloat(message.volume || 1000);
      } else if (message.type === 'l2_orderbook' && message.buy && message.buy[0]) {
        currentPrice = parseFloat(message.buy[0].limit_price);
        volume = parseFloat(message.buy[0].size || 100);
      }
      
      if (currentPrice && currentPrice > 0) {
        updateCount++;
        
        if (candleHistory.length === 0 && !lastPrice) {
          console.log(`🧪 Bootstrap from: $${currentPrice.toFixed(2)}`);
          candleHistory = createBootstrapCandles(currentPrice, 20);
          console.log(`✅ Ready with ${candleHistory.length} candles\n`);
        }
        
        updateCurrentCandle(currentPrice, volume);
        
        const position = portfolio.positions.get('BTCUSD');
        if (position) {
          portfolio.equity = portfolio.cash + (position.quantity * currentPrice);
        }
        
        lastPrice = currentPrice;
      }
      
    } catch (error) {
      // Silently ignore parsing errors
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket disconnected: ${code} ${reason}`);
    reconnectWebSocket();
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error: ${error.message}`);
    reconnectWebSocket();
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
  const backoffTime = Math.min(5000 * Math.min(reconnectAttempts, 6), 30000);
  
  console.log(`🔄 Reconnecting in ${backoffTime/1000}s (attempt ${reconnectAttempts})...`);
  
  setTimeout(() => {
    connectWebSocket();
  }, backoffTime);
}

function cleanup() {
  clearInterval(performanceTracker);
  
  if (lastPrice) {
    closeExistingPosition(lastPrice);
  }
  
  const runtime = ((Date.now() - startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const rate = updateCount > 0 ? (updateCount / runtime).toFixed(1) : '0.0';
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TRADING SESSION RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Runtime: ${hours}h ${minutes}m | Updates: ${updateCount} (${rate}/sec)`);
  console.log(`🎯 Signals: ${signalCount} | Trades: ${tradeCount}`);
  console.log(`💰 Final Equity: $${portfolio.equity.toLocaleString()}`);
  console.log(`📈 Session High: $${sessionHighEquity.toLocaleString()}`);
  console.log(`📉 Session Low: $${sessionLowEquity.toLocaleString()}`);
  console.log(`🔄 Total Reconnections: ${reconnectAttempts}`);
  
  const totalReturn = portfolio.equity - portfolio.initialCapital;
  const returnPercent = (totalReturn / portfolio.initialCapital) * 100;
  console.log(`📊 Total Return: $${totalReturn.toFixed(2)} (${returnPercent.toFixed(2)}%)`);
  
  if (trades.length > 0) {
    console.log(`\n💰 TRADE HISTORY:`);
    let totalPnl = 0;
    let winCount = 0;
    let lossCount = 0;
    
    trades.forEach((trade, i) => {
      if (trade.pnl !== undefined) {
        if (trade.pnl > 0) winCount++;
        else if (trade.pnl < 0) lossCount++;
        totalPnl += trade.pnl;
      }
    });
    
    console.log(`✅ Wins: ${winCount} | ❌ Losses: ${lossCount}`);
    console.log(`🎯 Win Rate: ${((winCount / (winCount + lossCount)) * 100).toFixed(1)}%`);
    console.log(`💰 Total P&L: $${totalPnl.toFixed(2)}`);
  }
  
  console.log(`\n✅ Trading session ended successfully!`);
  console.log(`📊 Thank you for using the High-Frequency Trading System`);
  process.exit(0);
}

// Start the system
console.log('🎯 Starting continuous trading system (24/7)...');
console.log('💡 Press Ctrl+C to stop at any time\n');
connectWebSocket();

// Graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Shutdown signal received...');
  console.log('🔄 Closing positions and saving results...');
  if (ws) ws.close();
  cleanup();
});

// Handle unexpected errors gracefully
process.on('uncaughtException', (error) => {
  console.error('\n❌ Unexpected error:', error.message);
  console.log('🔄 Attempting to recover...');
  reconnectWebSocket();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n⚠️ Unhandled promise rejection:', reason);
  console.log('🔄 System continuing...');
});

// NO AUTO-STOP - Will run continuously until manually stopped!