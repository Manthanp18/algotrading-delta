require('dotenv').config();
const DeltaExchangeDataFetcher = require('./src/dataFetcher');
const { BacktestEngine } = require('./src/backtestEngine');
const ConfluenceScalpingStrategy = require('./src/strategies/confluenceScalpingStrategy');
const ResultStorage = require('./src/resultStorage');

async function runBacktest() {
  try {
    console.log('🚀 Starting Backtesting Engine...\n');

    const dataFetcher = new DeltaExchangeDataFetcher(
      process.env.DELTA_API_KEY,
      process.env.DELTA_API_SECRET,
      process.env.DELTA_BASE_URL
    );

    console.log('📊 Fetching historical data...');
    
    // Set date range: August 1-13, 2025 (same as V5 strategy for comparison)
    const startTime = Math.floor(new Date('2025-08-01T00:00:00Z').getTime() / 1000);
    const endTime = Math.floor(new Date('2025-08-13T13:30:00Z').getTime() / 1000);
    
    console.log(`📅 Requesting data from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
    
    const candles = await dataFetcher.getHistoricalCandles(
      'BTCUSD',
      '1m',
      startTime,
      endTime
    );

    if (!candles || candles.length === 0) {
      throw new Error('❌ No historical data received from Delta Exchange API');
    }

    console.log(`✅ Loaded ${candles.length} candles`);
    console.log(`📈 Data range: ${candles[0].timestamp.toISOString()} to ${candles[candles.length - 1].timestamp.toISOString()}\n`);

    const engine = new BacktestEngine(100000);
    engine.loadData(candles);

    const strategy = new ConfluenceScalpingStrategy(0.1); // 10% position size
    
    console.log('🔄 Running backtest...');
    const results = engine.run(strategy, 'BTCUSD');

    console.log(`\n📊 Backtest completed with ${results.completedTrades.length} completed trades`);
    console.log(`💰 Final Portfolio Value: $${results.metrics.finalEquity}`);
    console.log(`📈 Total Return: ${results.metrics.totalReturn}%`);
    console.log(`🎯 Win Rate: ${results.metrics.winRate}%`);

    const storage = new ResultStorage();
    await storage.saveBacktestResult(results, {
      strategy: 'Confluence_Scalping',
      symbol: 'BTCUSD',
      timeframe: '1m',
      initialCapital: 100000,
      dataRange: {
        start: candles[0].timestamp,
        end: candles[candles.length - 1].timestamp,
        totalCandles: candles.length
      }
    });

  } catch (error) {
    console.error('❌ Backtest failed:', error.message);
    console.error('💡 Please check your Delta Exchange API credentials in .env file');
    process.exit(1);
  }
}


if (require.main === module) {
  runBacktest();
}

module.exports = { runBacktest };