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
const logger = require('./src/logger');
const { startLogsServer } = require('./src/logsServer');

console.log('🚀 PROFESSIONAL SUPERTREND RENKO TRADING SYSTEM');
console.log('=' .repeat(80));
logger.info('PROFESSIONAL SUPERTREND RENKO TRADING SYSTEM STARTED', { timestamp: new Date().toISOString() });

// Initialize DUAL strategy system (Primary + Secondary)
const primaryStrategy = new SuperTrendRenkoStrategy({
  atrMultiplier: 0.326,             // Target brick size: $75
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
  atrMultiplier: 0.217,             // Target brick size: $50
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

logger.info('System initialized', {
  initialCapital: portfolio.initialCapital,
  primaryStrategy: primaryStrategy.name,
  secondaryStrategy: secondaryStrategy.name
});

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
let candleCount = 0;
let lastCandleData = null;
let currentCandle = null;
let candleStartTime = null;
let priceUpdateCount = 0;

const startTime = Date.now();
const CANDLE_INTERVAL_MS = 60000; // 1 minute in milliseconds

// Trade storage setup
const tradesDir = path.join(__dirname, 'dashboard', 'trades');
if (!fs.existsSync(tradesDir)) {
  fs.mkdirSync(tradesDir, { recursive: true });
}

// Enhanced event monitoring for both strategies
function setupStrategyMonitoring(strategy, strategyName) {
  strategy.getRenkoEngine().on('newBrick', (brick) => {
    logger.info(`${strategyName} Brick formed`, {
      brickNumber: brick.brickNumber,
      direction: brick.direction,
      open: brick.open,
      close: brick.close,
      consecutive: brick.consecutiveCount,
      activeStrategy: activeStrategy
    });
  });

  strategy.getRenkoEngine().on('trendChange', (data) => {
    logger.warn(`${strategyName} Trend Change`, {
      oldDirection: data.oldDirection,
      newDirection: data.newDirection,
      activeStrategy: activeStrategy
    });
  });

  strategy.getRenkoEngine().on('brickSizeCalculated', (data) => {
    logger.info(`${strategyName} Brick Size calculated`, {
      brickSize: data.optimalBrickSize,
      atr: data.atr,
      activeStrategy: activeStrategy
    });
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
  let selectedSignal = null;
  let selectionReason = '';
  
  // In trending markets, prefer SuperTrend strategy
  if (marketRegime === 'TRENDING') {
    if (primarySignal && primarySignal.confluence && primarySignal.confluence.score >= 8) {
      activeStrategy = 'PRIMARY';
      selectedSignal = primarySignal;
      selectionReason = `Trending market - SuperTrend selected (confluence: ${primarySignal.confluence.score}/10)`;
    }
    // Fallback to secondary if primary has low confidence
    else if (secondarySignal && !primarySignal) {
      activeStrategy = 'SECONDARY';
      selectedSignal = secondarySignal;
      selectionReason = 'Trending market - Bollinger fallback (no primary signal)';
    }
  }
  
  // In ranging markets, prefer Bollinger strategy
  else if (marketRegime === 'RANGING') {
    if (secondarySignal && secondarySignal.confidence >= 0.7) {
      activeStrategy = 'SECONDARY';
      selectedSignal = secondarySignal;
      selectionReason = `Ranging market - Bollinger selected (confidence: ${(secondarySignal.confidence * 100).toFixed(1)}%)`;
    }
    // Fallback to primary if secondary has no signal
    else if (primarySignal && !secondarySignal) {
      activeStrategy = 'PRIMARY';
      selectedSignal = primarySignal;
      selectionReason = 'Ranging market - SuperTrend fallback (no secondary signal)';
    }
  }
  
  // Default to highest confidence signal
  if (!selectedSignal && primarySignal && secondarySignal) {
    const primaryConf = primarySignal.confidence || 0;
    const secondaryConf = secondarySignal.confidence || 0;
    
    if (primaryConf > secondaryConf) {
      activeStrategy = 'PRIMARY';
      selectedSignal = primarySignal;
      selectionReason = `Higher confidence - SuperTrend (${(primaryConf * 100).toFixed(1)}% vs ${(secondaryConf * 100).toFixed(1)}%)`;
    } else {
      activeStrategy = 'SECONDARY';
      selectedSignal = secondarySignal;
      selectionReason = `Higher confidence - Bollinger (${(secondaryConf * 100).toFixed(1)}% vs ${(primaryConf * 100).toFixed(1)}%)`;
    }
  }
  
  // Return whichever signal exists
  else if (!selectedSignal) {
    if (primarySignal) {
      activeStrategy = 'PRIMARY';
      selectedSignal = primarySignal;
      selectionReason = 'Only SuperTrend signal available';
    } else if (secondarySignal) {
      activeStrategy = 'SECONDARY';
      selectedSignal = secondarySignal;
      selectionReason = 'Only Bollinger signal available';
    }
  }
  
  // Log strategy selection reasoning
  if (selectedSignal && selectionReason) {
    logger.info('Strategy Selection', {
      selected: activeStrategy,
      reason: selectionReason,
      marketRegime: marketRegime,
      candle: candleCount
    });
  }
  
  return selectedSignal;
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
  
  logger.info('========== TRADING STATUS UPDATE ==========', {
    runtime: `${hours}h ${minutes}m`,
    candle: candleCount,
    updates: updateCount,
    updateRate: rate,
    signals: signalCount,
    trades: tradeCount,
    equity: portfolio.equity,
    dailyPnL: dailyPnL,
    marketRegime,
    activeStrategy,
    connectionStatus: getConnectionStatus()
  });
  
  // Primary strategy status
  const primaryStats = primaryStrategy.getStatistics();
  const primaryRenko = primaryStats.renkoEngine;
  const primaryConsecutive = primaryStrategy.getRenkoEngine().getConsecutiveBricks();
  
  logger.info('SUPERTREND RENKO STATUS', {
    bricks: primaryRenko.totalBricks,
    brickSize: primaryRenko.brickSize || 0,
    trend: `${primaryConsecutive.count} ${primaryConsecutive.direction || 'INIT'}`,
    trendStrength: (primaryRenko.trendStrength * 100).toFixed(1),
    signals: primaryStats.entrySignals,
    avgConfluence: primaryStats.avgConfluenceScore,
    activeStrategy: activeStrategy === 'PRIMARY' ? 'ACTIVE' : 'STANDBY'
  });
  
  // Secondary strategy status
  const secondaryStats = secondaryStrategy.getStatistics();
  const secondaryRenko = secondaryStats.renkoEngine;
  const secondaryConsecutive = secondaryStrategy.getRenkoEngine().getConsecutiveBricks();
  
  logger.info('BOLLINGER RENKO STATUS', {
    bricks: secondaryRenko.totalBricks,
    brickSize: secondaryRenko.brickSize || 0,
    trend: `${secondaryConsecutive.count} ${secondaryConsecutive.direction || 'INIT'}`,
    trendStrength: (secondaryRenko.trendStrength * 100).toFixed(1),
    signals: secondaryStats.entrySignals,
    bbBounces: secondaryStats.bollingerBounces,
    activeStrategy: activeStrategy === 'SECONDARY' ? 'ACTIVE' : 'STANDBY'
  });
  
  // Position status
  const btcPosition = portfolio.positions.get('BTCUSD');
  if (btcPosition && btcPosition.quantity > 0) {
    const currentValue = btcPosition.quantity * (lastPrice || 0);
    const pnl = currentValue - (btcPosition.quantity * btcPosition.averagePrice);
    const pnlPercent = (pnl / (btcPosition.quantity * btcPosition.averagePrice)) * 100;
    
    logger.info('POSITION STATUS', {
      quantity: btcPosition.quantity,
      avgPrice: btcPosition.averagePrice,
      currentValue: currentValue,
      pnl: pnl,
      pnlPercent: pnlPercent,
      candle: candleCount
    });
  } else {
    logger.info('POSITION STATUS', {
      status: 'NO POSITION',
      cash: portfolio.cash,
      candle: candleCount
    });
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
  logger.trade(`EXECUTING TRADE #${tradeCount}`, {
    strategy: activeStrategy,
    candle: candleCount
  });
  
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
        logger.success('Professional Renko Trading Active', { subscriptions: message.subscriptions });
        return;
      }
      
      let currentPrice = null;
      let volume = 1000;
      
      if (message.type === 'v2/ticker') {
        currentPrice = parseFloat(message.close || message.mark_price);
        volume = parseFloat(message.volume || 1000);
        
        // Log price tick (not candle)
        if (message.mark_price) {
          const price = parseFloat(message.mark_price);
          priceUpdateCount++;
          logger.market('Price Tick', { 
            price: price,
            tick: priceUpdateCount,
            currentCandle: candleCount,
            activeStrategy: activeStrategy
          });
        }
      }
      
      if (currentPrice && currentPrice > 0) {
        updateCount++;
        lastPrice = currentPrice;
        
        // Handle candle aggregation logic
        const now = Date.now();
        
        // Initialize first candle
        if (!currentCandle) {
          candleStartTime = now;
          currentCandle = {
            timestamp: new Date(candleStartTime),
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: volume
          };
          logger.info('First Candle Started', {
            candle: candleCount + 1,
            price: currentPrice,
            activeStrategy: activeStrategy
          });
        } else {
          // Update current candle with new price
          currentCandle.high = Math.max(currentCandle.high, currentPrice);
          currentCandle.low = Math.min(currentCandle.low, currentPrice);
          currentCandle.close = currentPrice;
          currentCandle.volume += volume;
        }
        
        // Check if 1 minute has passed - complete the candle
        if (now - candleStartTime >= CANDLE_INTERVAL_MS) {
          // Complete current candle
          candleCount++;
          lastCandleData = { ...currentCandle };
          
          logger.info('Candle Completed', {
            candle: candleCount,
            ohlcv: lastCandleData,
            activeStrategy: activeStrategy,
            marketRegime: detectMarketRegime(),
            duration: `${(now - candleStartTime) / 1000}s`
          });
          
          // Start new candle
          candleStartTime = now;
          currentCandle = {
            timestamp: new Date(candleStartTime),
            open: currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: volume
          };
        }
        
        // Only run strategy analysis when a candle is completed
        if (lastCandleData && (now - candleStartTime < 1000)) { // Just completed a candle
          try {
            // Generate signals from both strategies using completed candle
            const primarySignal = primaryStrategy.generateSignal(lastCandleData, [], portfolio);
            const secondarySignal = secondaryStrategy.generateSignal(lastCandleData, [], portfolio);
            
            // Detect market regime and select best signal
            const marketRegime = detectMarketRegime();
            const selectedSignal = processSignal(primarySignal, secondarySignal, marketRegime);
            
            if (selectedSignal) {
              signalCount++;
              
              logger.trade(`SIGNAL GENERATED #${signalCount}`, {
                candle: candleCount,
                action: selectedSignal.action,
                price: currentPrice,
                reason: selectedSignal.reason,
                confidence: ((selectedSignal.confidence || 0) * 100).toFixed(1),
                marketRegime,
                activeStrategy: activeStrategy,
                primaryAnalyzed: primarySignal ? true : false,
                secondaryAnalyzed: secondarySignal ? true : false
              });
              
              if (selectedSignal.takeProfit) {
                console.log(`📈 Take Profit: $${selectedSignal.takeProfit.toFixed(2)}`);
              }
              if (selectedSignal.stopLoss) {
                console.log(`📉 Stop Loss: $${selectedSignal.stopLoss.toFixed(2)}`);
              }
              
              executeTradeSignal(selectedSignal, lastCandleData);
            }
          } catch (error) {
            console.error(`❌ Strategy error: ${error.message}`);
          }
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
    logger.warn('WebSocket disconnected', { code, reason });
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectWebSocket();
    }
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error: ${error.message}`);
    logger.error('WebSocket error', { error: error.message });
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

// Start the logs server
startLogsServer();
console.log('📝 Logs server started on port 8080');
logger.info('Logs server started', { port: 8080 });

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