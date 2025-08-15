const ResultStorage = require('./resultStorage');

class ResultViewer {
  constructor() {
    this.storage = new ResultStorage();
  }

  async listAllResults() {
    const results = await this.storage.listBacktestResults();
    
    if (results.length === 0) {
      console.log('📂 No backtest results found.');
      return;
    }

    console.log('\n📊 BACKTEST RESULTS HISTORY\n');
    console.log('ID | Strategy | Symbol | Date | Return | Trades | File');
    console.log('---|----------|--------|------|--------|--------|----');
    
    results.forEach((result, index) => {
      const date = new Date(result.timestamp).toLocaleDateString();
      console.log(`${index + 1}  | ${result.strategy} | ${result.symbol} | ${date} | ${result.totalReturn}% | ${result.totalTrades} | ${result.fileName}`);
    });
    
    console.log('\n');
    return results;
  }

  async compareResults(fileNames) {
    if (!Array.isArray(fileNames) || fileNames.length < 2) {
      throw new Error('Need at least 2 results to compare');
    }

    const results = [];
    for (const fileName of fileNames) {
      const data = await this.storage.loadBacktestResult(fileName);
      results.push({
        fileName,
        strategy: data.metadata.strategy,
        symbol: data.metadata.symbol,
        metrics: data.results.metrics
      });
    }

    console.log('\n📈 BACKTEST COMPARISON\n');
    console.log('Strategy | Symbol | Total Return | Max Drawdown | Win Rate | Total Trades');
    console.log('---------|--------|--------------|--------------|----------|-------------');
    
    results.forEach(result => {
      const m = result.metrics;
      console.log(`${result.strategy} | ${result.symbol} | ${m.totalReturn || '0.00'}% | ${m.maxDrawdown || '0.00'}% | ${m.winRate || '0.00'}% | ${m.totalTrades || 0}`);
    });
    
    console.log('\n');
    return results;
  }

  async showDetailedResult(fileName) {
    const data = await this.storage.loadBacktestResult(fileName);
    
    console.log(`\n📊 DETAILED BACKTEST RESULT: ${fileName}\n`);
    
    console.log('METADATA:');
    console.log(`Strategy: ${data.metadata.strategy}`);
    console.log(`Symbol: ${data.metadata.symbol}`);
    console.log(`Timeframe: ${data.metadata.timeframe}`);
    console.log(`Date: ${new Date(data.metadata.timestamp).toLocaleString()}`);
    console.log(`Initial Capital: $${data.metadata.initialCapital}`);
    
    if (data.metadata.dataRange) {
      console.log(`Data Range: ${data.metadata.dataRange.start} to ${data.metadata.dataRange.end}`);
      console.log(`Total Candles: ${data.metadata.dataRange.totalCandles}`);
    }

    console.log('\nPERFORMANCE:');
    const metrics = data.results.metrics;
    if (metrics) {
      Object.entries(metrics).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
    }

    console.log('\nCOMPLETED TRADES (PAIRED):');
    const completedTrades = data.results.completedTrades || [];
    if (completedTrades.length > 0) {
      console.log('ID | Entry | Exit | Entry Time | Exit Time | Entry Price | Exit Price | Qty | P&L | P&L% | Hold Time');
      console.log('---|-------|------|------------|-----------|-------------|------------|-----|-----|------|----------');
      
      completedTrades.forEach((trade, index) => {
        const entryTime = new Date(trade.entryTime).toLocaleString();
        const exitTime = new Date(trade.exitTime).toLocaleString();
        const pnlSign = trade.pnl >= 0 ? '+' : '';
        const pnlPercentSign = trade.pnlPercent >= 0 ? '+' : '';
        
        console.log(`${index + 1} | ${trade.entrySignal} | ${trade.exitSignal} | ${entryTime} | ${exitTime} | $${trade.entryPrice.toFixed(2)} | $${trade.exitPrice.toFixed(2)} | ${trade.quantity.toFixed(6)} | ${pnlSign}$${trade.pnl.toFixed(2)} | ${pnlPercentSign}${trade.pnlPercent.toFixed(2)}% | ${trade.holdingPeriod}m`);
      });
    } else {
      console.log('No completed trades');
    }
    
    console.log('\n');
    return data;
  }
}

module.exports = ResultViewer;