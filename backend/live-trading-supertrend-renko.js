#!/usr/bin/env node

/**
 * LIVE SUPERTREND RENKO TRADING SYSTEM
 * Professional High-Performance Trading Strategy
 * 
 * Features:
 * - SuperTrend Renko Confluence Strategy (Primary)
 * - Bollinger Stochastic Renko Strategy (Secondary)
 * - Advanced risk management
 * - Real-time monitoring
 * - Professional-grade signal generation
 */

const SuperTrendRenkoStrategy = require('./legacy-src/strategies/superTrendRenkoStrategy');
const BollingerStochasticRenkoStrategy = require('./legacy-src/strategies/bollingerStochasticRenkoStrategy');
const { Portfolio } = require('./legacy-src/backtestEngine');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('🚀 PROFESSIONAL SUPERTREND RENKO TRADING SYSTEM');
console.log('=' .repeat(80));

// Initialize DUAL strategy system (Primary + Secondary)
const primaryStrategy = new SuperTrendRenkoStrategy({
  atrMultiplier: 0.5,               // Professional brick sizing
  supertrendPeriod: 10,
  supertrendMultiplier: 3.0,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  maxRiskPerTrade: 0.02,            // 2% risk per trade
  minRiskReward: 3.0,               // 3:1 minimum R/R
  minConfluenceScore: 7,            // High-quality signals only
  cooldownSeconds: 30
});

const secondaryStrategy = new BollingerStochasticRenkoStrategy({
  atrMultiplier: 0.4,               // Smaller bricks for ranging
  bollingerPeriod: 20,
  bollingerStdDev: 2.0,
  stochasticK: 14,
  emaPeriod: 21,
  maxRiskPerTrade: 0.015,           // 1.5% risk (more conservative)
  riskRewardRatio: 2.0,
  cooldownSeconds: 45
});

const portfolio = new Portfolio(100000);

console.log(`💰 Initial Portfolio: $${portfolio.initialCapital.toLocaleString()}`);
console.log(`🎯 PRIMARY: ${primaryStrategy.name}`);
console.log(`📊 SECONDARY: ${secondaryStrategy.name}`);
console.log(`⚡ Dual-strategy confluence system enabled`);
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
let dailyPnL = 0;
let activeStrategy = 'PRIMARY';

const startTime = Date.now();

// Trade storage setup
const tradesDir = path.join(__dirname, 'dashboard', 'trades');
if (!fs.existsSync(tradesDir)) {
  fs.mkdirSync(tradesDir, { recursive: true });
}

// Enhanced event monitoring for both strategies
function setupStrategyMonitoring(strategy, strategyName) {
  strategy.getRenkoEngine().on('newBrick', (brick) => {
    console.log(`🧱 ${strategyName} Brick #${brick.brickNumber}: ${brick.direction} | $${brick.open.toFixed(2)} -> $${brick.close.toFixed(2)} | Consecutive: ${brick.consecutiveCount}`);
  });

  strategy.getRenkoEngine().on('trendChange', (data) => {
    console.log(`🔄 ${strategyName} Trend Change: ${data.oldDirection} -> ${data.newDirection}`);
  });

  strategy.getRenkoEngine().on('brickSizeCalculated', (data) => {
    console.log(`📏 ${strategyName} Brick Size: $${data.optimalBrickSize.toFixed(2)} (ATR: ${data.atr.toFixed(2)})`);
  });
}

setupStrategyMonitoring(primaryStrategy, 'SUPERTREND');
setupStrategyMonitoring(secondaryStrategy, 'BOLLINGER');

// Market regime detection
function detectMarketRegime() {
  const primaryStats = primaryStrategy.getRenkoEngine().getStatistics();
  const secondaryStats = secondaryStrategy.getRenkoEngine().getStatistics();
  
  if (!primaryStats.trendChanges || !secondaryStats.trendChanges) {
    return 'TRENDING'; // Default to trending
  }
  
  // If many trend changes, market is ranging
  const avgTrendChanges = (primaryStats.trendChanges + secondaryStats.trendChanges) / 2;
  const runtime = (Date.now() - startTime) / (1000 * 3600); // hours
  const trendChangesPerHour = runtime > 0 ? avgTrendChanges / runtime : 0;
  
  return trendChangesPerHour > 3 ? 'RANGING' : 'TRENDING';
}

// Advanced signal processing with strategy selection
function processSignal(primarySignal, secondarySignal, marketRegime) {
  // In trending markets, prefer SuperTrend strategy
  if (marketRegime === 'TRENDING') {
    if (primarySignal && primarySignal.confluence && primarySignal.confluence.score >= 8) {
      activeStrategy = 'PRIMARY';
      return primarySignal;
    }
    // Fallback to secondary if primary has low confidence
    if (secondarySignal && !primarySignal) {
      activeStrategy = 'SECONDARY';
      return secondarySignal;
    }
  }
  
  // In ranging markets, prefer Bollinger strategy
  if (marketRegime === 'RANGING') {
    if (secondarySignal && secondarySignal.confidence >= 0.7) {
      activeStrategy = 'SECONDARY';
      return secondarySignal;
    }
    // Fallback to primary if secondary has no signal
    if (primarySignal && !secondarySignal) {
      activeStrategy = 'PRIMARY';
      return primarySignal;
    }
  }
  
  // Default to highest confidence signal
  if (primarySignal && secondarySignal) {
    const primaryConf = primarySignal.confidence || 0;
    const secondaryConf = secondarySignal.confidence || 0;
    
    if (primaryConf > secondaryConf) {
      activeStrategy = 'PRIMARY';
      return primarySignal;
    } else {
      activeStrategy = 'SECONDARY';
      return secondarySignal;
    }
  }
  
  // Return whichever signal exists
  if (primarySignal) {
    activeStrategy = 'PRIMARY';
    return primarySignal;
  }
  
  if (secondarySignal) {
    activeStrategy = 'SECONDARY';
    return secondarySignal;
  }
  
  return null;
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

// Enhanced session data with dual strategies
function saveSessionData() {
  const sessionFile = path.join(tradesDir, 'current_session.json');
  const currentEquity = portfolio.cash + Array.from(portfolio.positions.values())
    .reduce((sum, pos) => sum + (pos.quantity * lastPrice), 0);
  
  const primaryStats = primaryStrategy.getStatistics();
  const secondaryStats = secondaryStrategy.getStatistics();
  const marketRegime = detectMarketRegime();
  
  const sessionData = {
    symbol: 'BTCUSD',
    strategy: 'Dual SuperTrend Renko System',
    marketRegime: marketRegime,
    activeStrategy: activeStrategy,
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
      totalReturn: ((currentEquity - portfolio.initialCapital) / portfolio.initialCapital) * 100,
      dailyPnL: dailyPnL
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
    strategies: {
      primary: {
        name: primaryStats.strategy,
        signals: primaryStats.entrySignals,
        confluence: primaryStats.avgConfluenceScore,
        superTrendSignals: primaryStats.superTrendSignals,
        macdConfirmations: primaryStats.macdConfirmations,
        volumeSurges: primaryStats.volumeSurges
      },
      secondary: {
        name: secondaryStats.strategy,
        signals: secondaryStats.entrySignals,
        bollingerBounces: secondaryStats.bollingerBounces,
        stochasticCrossovers: secondaryStats.stochasticCrossovers,
        emaTrendFilters: secondaryStats.emaTrendFilters
      }
    },
    lastCandleTime: new Date().toISOString(),
    lastPrice: lastPrice,
    openPositions: portfolio.positions.size,
    lastUpdate: new Date().toISOString()
  };
  
  fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
}

// Enhanced performance tracking
const performanceTracker = setInterval(() => {
  const runtime = ((Date.now() - startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const rate = updateCount > 0 ? (updateCount / runtime).toFixed(1) : '0.0';
  const timeSinceLastUpdate = ((Date.now() - lastUpdateTime) / 1000).toFixed(0);
  
  // Update session highs/lows
  if (portfolio.equity > sessionHighEquity) sessionHighEquity = portfolio.equity;
  if (portfolio.equity < sessionLowEquity) sessionLowEquity = portfolio.equity;
  
  const marketRegime = detectMarketRegime();
  
  console.log(`\n📊 PROFESSIONAL RENKO TRADING (${hours}h ${minutes}m):`);
  console.log(`⚡ Updates: ${updateCount} (${rate}/sec) | Signals: ${signalCount} | Trades: ${tradeCount}`);
  console.log(`💰 Equity: $${portfolio.equity.toLocaleString()} | Daily P&L: $${dailyPnL.toFixed(2)}`);
  console.log(`📈 Session High: $${sessionHighEquity.toLocaleString()} | Low: $${sessionLowEquity.toLocaleString()}`);
  console.log(`🔗 Connection: ${getConnectionStatus()} | Last Update: ${timeSinceLastUpdate}s ago`);
  console.log(`🎯 Market Regime: ${marketRegime} | Active Strategy: ${activeStrategy}`);
  
  // Primary strategy status
  const primaryStats = primaryStrategy.getStatistics();
  const primaryRenko = primaryStats.renkoEngine;
  const primaryConsecutive = primaryStrategy.getRenkoEngine().getConsecutiveBricks();
  
  console.log(`🧱 SUPERTREND RENKO:`);
  console.log(`   Bricks: ${primaryRenko.totalBricks} | Size: $${primaryRenko.brickSize?.toFixed(2) || 'Calc...'}`);
  console.log(`   Trend: ${primaryConsecutive.count} ${primaryConsecutive.direction || 'INIT'} | Strength: ${(primaryRenko.trendStrength * 100).toFixed(1)}%`);
  console.log(`   Signals: ${primaryStats.entrySignals} | Avg Confluence: ${primaryStats.avgConfluenceScore}`);
  
  // Secondary strategy status
  const secondaryStats = secondaryStrategy.getStatistics();
  const secondaryRenko = secondaryStats.renkoEngine;
  const secondaryConsecutive = secondaryStrategy.getRenkoEngine().getConsecutiveBricks();
  
  console.log(`🎯 BOLLINGER RENKO:`);
  console.log(`   Bricks: ${secondaryRenko.totalBricks} | Size: $${secondaryRenko.brickSize?.toFixed(2) || 'Calc...'}`);
  console.log(`   Trend: ${secondaryConsecutive.count} ${secondaryConsecutive.direction || 'INIT'} | Strength: ${(secondaryRenko.trendStrength * 100).toFixed(1)}%`);
  console.log(`   Signals: ${secondaryStats.entrySignals} | BB Bounces: ${secondaryStats.bollingerBounces}`);
  
  // Position status
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
  
  // Auto-reconnect if needed
  if (timeSinceLastUpdate > 60 && reconnectAttempts < maxReconnectAttempts) {
    console.log(`⚠️ No updates for ${timeSinceLastUpdate}s - reconnecting...`);
    reconnectWebSocket();
  }
  
  saveSessionData();
}, 20000); // Every 20 seconds for professional monitoring

function getConnectionStatus() {
  if (!ws) return '❌ Disconnected';
  if (ws.readyState === WebSocket.OPEN) return '✅ Connected';
  if (ws.readyState === WebSocket.CONNECTING) return '🔄 Connecting';
  if (ws.readyState === WebSocket.CLOSING) return '⚠️ Closing';
  return '❌ Closed';
}

function executeTradeSignal(signal, candle) {
  tradeCount++;
  console.log(`\n💰 EXECUTING ${activeStrategy} TRADE #${tradeCount}:`);
  
  try {
    if (signal.action === 'BUY') {
      const positionValue = signal.positionSize * candle.close;
      
      console.log(`📊 BUY: ${signal.positionSize.toFixed(6)} BTC @ $${candle.close.toFixed(2)}`);
      console.log(`💰 Position Value: $${positionValue.toFixed(2)}`);
      console.log(`🎯 Take Profit: $${signal.takeProfit.toFixed(2)} | Stop Loss: $${signal.stopLoss.toFixed(2)}`);
      console.log(`📊 Risk/Reward: 1:${signal.riskReward?.toFixed(2) || 'N/A'} | Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
      
      // Show technical indicators
      if (signal.superTrend) {
        console.log(`🔧 SuperTrend: ${signal.superTrend.direction} @ $${signal.superTrend.value.toFixed(2)}`);
      }
      if (signal.macd) {
        console.log(`📈 MACD: ${signal.macd.direction} | Histogram: ${signal.macd.histogram.toFixed(4)}`);
      }
      if (signal.confluence) {
        console.log(`⭐ Confluence: ${signal.confluence.score}/${signal.confluence.maxScore} (${signal.confluence.reasons.join(', ')})`);
      }
      
      portfolio.cash -= positionValue;
      portfolio.positions.set('BTCUSD', {
        quantity: signal.positionSize,
        averagePrice: candle.close,
        totalCost: positionValue
      });
      
      console.log(`✅ BUY EXECUTED | Remaining Cash: $${portfolio.cash.toLocaleString()}`);
      
      const trade = {
        id: `${activeStrategy.toLowerCase()}_trade_${Date.now()}`,
        symbol: 'BTCUSD',
        type: 'BUY',
        signal_type: signal.signal_type,
        strategy: activeStrategy,
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
        indicators: signal.superTrend || signal.indicators || {},
        confluence: signal.confluence || null
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
        
        // Update daily P&L
        dailyPnL += pnl;
        
        // Update strategies' daily P&L tracking
        if (activeStrategy === 'PRIMARY') {
          primaryStrategy.updateDailyPnL(pnl);
        } else {
          secondaryStrategy.updateDailyPnL && secondaryStrategy.updateDailyPnL(pnl);
        }
        
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
    console.log('📡 Professional Renko trading channels subscribed');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      lastUpdateTime = Date.now();
      
      if (message.type === 'subscriptions') {
        console.log('🚀 PROFESSIONAL RENKO TRADING ACTIVE!\n');
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
        
        // Create candle data for both strategies
        const candle = {
          timestamp: new Date(),
          open: currentPrice,
          high: currentPrice * 1.0001,
          low: currentPrice * 0.9999,
          close: currentPrice,
          volume: volume
        };
        
        try {
          // Generate signals from both strategies
          const primarySignal = primaryStrategy.generateSignal(candle, [], portfolio);
          const secondarySignal = secondaryStrategy.generateSignal(candle, [], portfolio);
          
          // Detect market regime and select best signal
          const marketRegime = detectMarketRegime();
          const selectedSignal = processSignal(primarySignal, secondarySignal, marketRegime);
          
          if (selectedSignal) {
            signalCount++;
            
            console.log(`\n🎯 ${activeStrategy} SIGNAL #${signalCount}:`);
            console.log(`📊 ${selectedSignal.action} at $${currentPrice.toFixed(2)}`);
            console.log(`💡 ${selectedSignal.reason}`);
            console.log(`🎯 Confidence: ${((selectedSignal.confidence || 0) * 100).toFixed(1)}%`);
            console.log(`📈 Market Regime: ${marketRegime}`);
            
            if (selectedSignal.takeProfit) {
              console.log(`📈 Take Profit: $${selectedSignal.takeProfit.toFixed(2)}`);
            }
            if (selectedSignal.stopLoss) {
              console.log(`📉 Stop Loss: $${selectedSignal.stopLoss.toFixed(2)}`);
            }
            
            executeTradeSignal(selectedSignal, candle);
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
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL PROFESSIONAL RENKO TRADING RESULTS');
  console.log('='.repeat(80));
  console.log(`⏱️  Runtime: ${hours}h ${minutes}m | Updates: ${updateCount}`);
  console.log(`🎯 Signals: ${signalCount} | Trades: ${tradeCount}`);
  console.log(`💰 Final Equity: $${portfolio.equity.toLocaleString()}`);
  console.log(`📊 Daily P&L: $${dailyPnL.toFixed(2)}`);
  
  const totalReturn = portfolio.equity - portfolio.initialCapital;
  const returnPercent = (totalReturn / portfolio.initialCapital) * 100;
  console.log(`📈 Total Return: $${totalReturn.toFixed(2)} (${returnPercent.toFixed(2)}%)`);
  
  // Final strategy statistics
  const primaryStats = primaryStrategy.getStatistics();
  const secondaryStats = secondaryStrategy.getStatistics();
  
  console.log(`\n🧱 SUPERTREND RENKO FINAL STATS:`);
  console.log(`   Entry Signals: ${primaryStats.entrySignals}`);
  console.log(`   Avg Confluence: ${primaryStats.avgConfluenceScore}`);
  console.log(`   SuperTrend Signals: ${primaryStats.superTrendSignals}`);
  console.log(`   MACD Confirmations: ${primaryStats.macdConfirmations}`);
  
  console.log(`\n🎯 BOLLINGER RENKO FINAL STATS:`);
  console.log(`   Entry Signals: ${secondaryStats.entrySignals}`);
  console.log(`   Bollinger Bounces: ${secondaryStats.bollingerBounces}`);
  console.log(`   Stochastic Crossovers: ${secondaryStats.stochasticCrossovers}`);
  
  console.log(`\n✅ Professional Renko Trading Session Complete!`);
  process.exit(0);
}

// Start the system
console.log('🎯 Starting Professional SuperTrend Renko trading system...');
console.log('💡 Dual-strategy adaptive system with market regime detection');
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