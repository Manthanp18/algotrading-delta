const fs = require('fs').promises;
const path = require('path');

class ResultStorage {
  constructor(resultsDir = './backtest-results') {
    this.resultsDir = path.resolve(resultsDir);
  }

  async ensureResultsDir() {
    try {
      await fs.access(this.resultsDir);
    } catch {
      await fs.mkdir(this.resultsDir, { recursive: true });
    }
  }

  generateFileName(strategy, symbol, timestamp = new Date()) {
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `${strategy}_${symbol}_${dateStr}_${timeStr}.json`;
  }

  async saveBacktestResult(results, metadata = {}) {
    await this.ensureResultsDir();
    
    const timestamp = new Date();
    const fileName = this.generateFileName(
      metadata.strategy || 'unknown',
      metadata.symbol || 'unknown',
      timestamp
    );
    
    const filePath = path.join(this.resultsDir, fileName);
    
    const dataToSave = {
      metadata: {
        timestamp: timestamp.toISOString(),
        strategy: metadata.strategy,
        symbol: metadata.symbol,
        timeframe: metadata.timeframe || '5m',
        initialCapital: metadata.initialCapital || 100000,
        dataRange: metadata.dataRange,
        ...metadata
      },
      results: results,
      summary: this.generateSummary(results)
    };

    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2));
    
    console.log(`💾 Backtest results saved to: ${fileName}`);
    return filePath;
  }

  async loadBacktestResult(fileName) {
    const filePath = path.join(this.resultsDir, fileName);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load backtest result: ${error.message}`);
    }
  }

  async listBacktestResults() {
    await this.ensureResultsDir();
    
    try {
      const files = await fs.readdir(this.resultsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const results = [];
      for (const file of jsonFiles) {
        try {
          const data = await this.loadBacktestResult(file);
          results.push({
            fileName: file,
            strategy: data.metadata.strategy,
            symbol: data.metadata.symbol,
            timestamp: data.metadata.timestamp,
            totalReturn: data.summary.totalReturn,
            totalTrades: data.summary.totalTrades
          });
        } catch (error) {
          console.warn(`Skipping invalid file ${file}: ${error.message}`);
        }
      }
      
      return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      throw new Error(`Failed to list backtest results: ${error.message}`);
    }
  }

  async deleteBacktestResult(fileName) {
    const filePath = path.join(this.resultsDir, fileName);
    
    try {
      await fs.unlink(filePath);
      console.log(`🗑️  Deleted backtest result: ${fileName}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete backtest result: ${error.message}`);
    }
  }

  async exportToCsv(fileName, outputPath = null) {
    const data = await this.loadBacktestResult(fileName);
    const completedTrades = data.results.completedTrades || [];
    
    if (!outputPath) {
      outputPath = path.join(this.resultsDir, fileName.replace('.json', '_trades.csv'));
    }

    const csvHeaders = 'trade_id,entry_signal,exit_signal,entry_time,exit_time,entry_price,exit_price,quantity,pnl,pnl_percent,holding_period_minutes\n';
    const csvRows = completedTrades.map(trade => 
      `${trade.id},"${trade.entrySignal}","${trade.exitSignal}","${new Date(trade.entryTime).toISOString()}","${new Date(trade.exitTime).toISOString()}",${trade.entryPrice},${trade.exitPrice},${trade.quantity},${trade.pnl},${trade.pnlPercent},${trade.holdingPeriod}`
    ).join('\n');

    await fs.writeFile(outputPath, csvHeaders + csvRows);
    console.log(`📈 Completed trades exported to CSV: ${path.basename(outputPath)}`);

    return { tradesFile: outputPath };
  }

  generateSummary(results) {
    const completedTrades = results.completedTrades || [];
    const metrics = results.metrics || {};

    return {
      totalTrades: completedTrades.length,
      totalReturn: metrics.totalReturn || '0.00',
      winRate: metrics.winRate || '0.00',
      finalEquity: metrics.finalEquity || '100000.00'
    };
  }

  async cleanupOldResults(daysToKeep = 30) {
    await this.ensureResultsDir();
    
    const files = await fs.readdir(this.resultsDir);
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    let deletedCount = 0;
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(this.resultsDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${deletedCount} old backtest results`);
    return deletedCount;
  }
}

module.exports = ResultStorage;