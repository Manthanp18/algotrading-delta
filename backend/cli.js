#!/usr/bin/env node

const { runBacktest } = require('./index');
const ResultViewer = require('./legacy-src/resultViewer');
const ResultStorage = require('./legacy-src/resultStorage');
const LiveSessionManager = require('./legacy-src/liveSessionManager');
const LiveDashboard = require('./legacy-src/liveDashboard');
const ConfluenceScalpingStrategy = require('./legacy-src/strategies/confluenceScalpingStrategy');
require('dotenv').config({ override: true });

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const viewer = new ResultViewer();
  const storage = new ResultStorage();
  
  // Initialize live session manager
  const liveSessionManager = new LiveSessionManager(
    process.env.DELTA_API_KEY,
    process.env.DELTA_API_SECRET,
    process.env.DELTA_BASE_URL
  );

  try {
    switch (command) {
      case 'run':
        await runBacktest();
        break;

      case 'list':
        await viewer.listAllResults();
        break;

      case 'view':
        if (!args[1]) {
          console.log('Usage: node cli.js view <filename>');
          return;
        }
        await viewer.showDetailedResult(args[1]);
        break;

      case 'compare':
        if (args.length < 3) {
          console.log('Usage: node cli.js compare <file1> <file2> [file3...]');
          return;
        }
        await viewer.compareResults(args.slice(1));
        break;

      case 'export':
        if (!args[1]) {
          console.log('Usage: node cli.js export <filename>');
          return;
        }
        await storage.exportToCsv(args[1]);
        break;

      case 'cleanup':
        const days = args[1] ? parseInt(args[1]) : 30;
        await storage.cleanupOldResults(days);
        break;

      case 'delete':
        if (!args[1]) {
          console.log('Usage: node cli.js delete <filename>');
          return;
        }
        await storage.deleteBacktestResult(args[1]);
        break;

      case 'live':
        const symbol = args[1] || 'BTCUSD';
        const initialCapital = args[2] ? parseFloat(args[2]) : 100000;
        console.log(`🚀 Starting live trading session for ${symbol} with $${initialCapital.toLocaleString()} capital...`);
        
        try {
          const session = await liveSessionManager.startSession(symbol, ConfluenceScalpingStrategy, {
            initialCapital,
            strategyParams: { positionSize: 0.1 }
          });
          
          console.log(`✅ Live session started: ${session.id}`);
          console.log('💡 Use "node cli.js live-stop" to stop the session');
          console.log('📊 Use "node cli.js live-status" to check status');
          
          // Keep process alive
          process.stdin.resume();
          
        } catch (error) {
          console.error(`❌ Failed to start live session: ${error.message}`);
        }
        break;

      case 'live-stop':
        try {
          const session = await liveSessionManager.stopSession();
          console.log(`✅ Live session stopped: ${session.id}`);
          console.log(`📊 Final Equity: $${session.metrics?.portfolio?.equity?.toLocaleString() || 'N/A'}`);
          console.log(`💰 Total Return: ${session.metrics?.portfolio?.totalReturn?.toFixed(2) || 'N/A'}%`);
          console.log(`📈 Total Trades: ${session.metrics?.totalTrades || 0}`);
        } catch (error) {
          console.error(`❌ Error stopping session: ${error.message}`);
        }
        break;

      case 'live-status':
        const status = liveSessionManager.getSessionStatus();
        
        if (status.isRunning) {
          console.log(`🟢 Live session active: ${status.session.id}`);
          console.log(`📊 Symbol: ${status.session.symbol}`);
          console.log(`⏰ Running since: ${new Date(status.session.startTime).toLocaleString()}`);
          console.log(`💰 Current Equity: $${status.session.portfolio?.equity?.toLocaleString() || 'N/A'}`);
          console.log(`📈 Total Return: ${status.session.portfolio?.totalReturn?.toFixed(2) || 'N/A'}%`);
          console.log(`🔄 Open Positions: ${status.tradingEngine?.openPositions || 0}`);
          console.log(`📊 Total Trades: ${status.session.metrics?.totalTrades || 0}`);
          console.log(`💵 Current Price: $${status.session.currentPrice?.toLocaleString() || 'N/A'}`);
          
          if (status.dataFetcher) {
            console.log(`📡 Data Feed: ${status.dataFetcher.isRunning ? '🟢 Connected' : '🔴 Disconnected'}`);
          }
        } else {
          console.log('🔴 No active live trading session');
        }
        break;

      case 'live-list':
        const sessions = liveSessionManager.getAllSessions();
        
        if (sessions.length === 0) {
          console.log('📭 No previous live trading sessions found');
        } else {
          console.log(`📊 Live Trading Sessions (${sessions.length}):\n`);
          
          sessions.forEach((session, index) => {
            const duration = session.endTime ? 
              new Date(session.endTime) - new Date(session.startTime) : 
              'Still running';
            
            console.log(`${index + 1}. ${session.id}`);
            console.log(`   Symbol: ${session.symbol} | Strategy: ${session.strategy}`);
            console.log(`   Started: ${new Date(session.startTime).toLocaleString()}`);
            console.log(`   Status: ${session.status}`);
            
            if (session.metrics) {
              console.log(`   Return: ${session.metrics.portfolio?.totalReturn?.toFixed(2) || 'N/A'}% | Trades: ${session.metrics.totalTrades || 0}`);
            }
            
            console.log('');
          });
        }
        break;

      case 'live-view':
        if (!args[1]) {
          console.log('Usage: node cli.js live-view <session-id>');
          return;
        }
        
        const sessionData = liveSessionManager.getSession(args[1]);
        
        if (!sessionData) {
          console.log(`❌ Session ${args[1]} not found`);
          return;
        }
        
        console.log(`📊 Live Session Details: ${sessionData.id}\n`);
        console.log(`Symbol: ${sessionData.symbol}`);
        console.log(`Strategy: ${sessionData.strategy}`);
        console.log(`Started: ${new Date(sessionData.startTime).toLocaleString()}`);
        console.log(`Status: ${sessionData.status}`);
        
        if (sessionData.endTime) {
          console.log(`Ended: ${new Date(sessionData.endTime).toLocaleString()}`);
          const duration = new Date(sessionData.endTime) - new Date(sessionData.startTime);
          console.log(`Duration: ${Math.floor(duration / 60000)} minutes`);
        }
        
        if (sessionData.metrics) {
          console.log(`\n💰 Performance:`);
          console.log(`Initial Capital: $${sessionData.initialCapital.toLocaleString()}`);
          console.log(`Final Equity: $${sessionData.metrics.portfolio?.equity?.toLocaleString() || 'N/A'}`);
          console.log(`Total Return: ${sessionData.metrics.portfolio?.totalReturn?.toFixed(2) || 'N/A'}%`);
          console.log(`Total Trades: ${sessionData.metrics.totalTrades || 0}`);
          console.log(`Win Rate: ${sessionData.metrics.winRate?.toFixed(1) || 'N/A'}%`);
        }
        
        if (sessionData.trades && sessionData.trades.length > 0) {
          console.log(`\n📈 Recent Trades (last 5):`);
          sessionData.trades.slice(-5).forEach((trade, index) => {
            console.log(`${index + 1}. ${trade.signal.action} ${trade.signal.quantity} at $${trade.price} - ${trade.signal.reason}`);
          });
        }
        break;

      case 'live-dashboard':
        try {
          const dashboard = new LiveDashboard(liveSessionManager);
          
          console.log('🚀 Starting live dashboard...');
          console.log('💡 Press Ctrl+C to exit dashboard');
          
          dashboard.start();
          
          // Handle graceful shutdown
          process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down dashboard...');
            dashboard.stop();
            process.exit(0);
          });
          
          // Keep process alive
          process.stdin.resume();
          
        } catch (error) {
          console.error(`❌ Error starting dashboard: ${error.message}`);
        }
        break;

      case 'help':
      default:
        console.log(`
📊 Backtesting Engine CLI

Backtesting Commands:
  run                           Run a new backtest
  list                          List all saved backtest results
  view <filename>               View detailed results for a specific backtest
  compare <file1> <file2>...    Compare multiple backtest results
  export <filename>             Export backtest to CSV files
  cleanup [days]                Delete results older than N days (default: 30)
  delete <filename>             Delete a specific backtest result

Live Trading Commands:
  live [symbol] [capital]       Start live trading session (default: BTCUSD, $100,000)
  live-stop                     Stop current live trading session
  live-status                   Show current live session status
  live-dashboard                Start real-time monitoring dashboard
  live-list                     List all previous live trading sessions
  live-view <session-id>        View detailed results for a specific live session

General:
  help                          Show this help message

Examples:
  # Backtesting
  node cli.js run
  node cli.js view SMA_Crossover_BTCUSDT_2024-01-15_10-30-45.json
  
  # Live Trading
  node cli.js live BTCUSD 50000
  node cli.js live-dashboard
  node cli.js live-stop
  node cli.js live-list
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();