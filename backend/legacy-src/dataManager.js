const fs = require('fs-extra');
const path = require('path');

class DataManager {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      maxTradesInMemory: config.maxTradesInMemory || 1000,
      maxCandleHistory: config.maxCandleHistory || 500,  // ~40 hours of 5-min candles
      logRetentionDays: config.logRetentionDays || 7,
      tradeRetentionDays: config.tradeRetentionDays || 30,
      cleanupInterval: config.cleanupInterval || 24 * 60 * 60 * 1000, // Daily
      dataDir: config.dataDir || path.join(__dirname, '..', 'data'),
      enableArchiving: config.enableArchiving || true
    };

    // Ensure directories exist
    this.logsDir = path.join(this.config.dataDir, 'logs');
    this.tradesDir = path.join(this.config.dataDir, 'trades');
    this.archiveDir = path.join(this.config.dataDir, 'archive');
    
    fs.ensureDirSync(this.logsDir);
    fs.ensureDirSync(this.tradesDir);
    if (this.config.enableArchiving) {
      fs.ensureDirSync(this.archiveDir);
    }

    // Start cleanup scheduler
    this.startCleanupScheduler();
  }

  // Circular buffer for trades - keeps only recent trades in memory
  createTradesBuffer() {
    const trades = [];
    const maxSize = this.config.maxTradesInMemory;
    
    return {
      push(trade) {
        trades.push(trade);
        if (trades.length > maxSize) {
          trades.shift(); // Remove oldest
        }
        return trades.length;
      },
      getAll() {
        return [...trades];
      },
      getRecent(count) {
        return trades.slice(-count);
      },
      size() {
        return trades.length;
      },
      clear() {
        trades.length = 0;
      }
    };
  }

  // Circular buffer for candle history
  createCandleBuffer() {
    const candles = [];
    const maxSize = this.config.maxCandleHistory;
    
    return {
      update(newCandles) {
        // Replace entire buffer with new data
        candles.length = 0;
        candles.push(...newCandles.slice(-maxSize));
        return candles.length;
      },
      push(candle) {
        candles.push(candle);
        if (candles.length > maxSize) {
          candles.shift();
        }
        return candles.length;
      },
      getAll() {
        return [...candles];
      },
      size() {
        return candles.length;
      }
    };
  }

  // Log rotation with automatic cleanup
  async rotateLog(logPath) {
    try {
      const stats = await fs.stat(logPath);
      const maxSize = 10 * 1024 * 1024; // 10MB max per log file
      
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = logPath.replace('.log', `-${timestamp}.log`);
        
        await fs.move(logPath, rotatedPath);
        console.log(`📝 Rotated log: ${path.basename(rotatedPath)}`);
        
        // Create new empty log
        await fs.writeFile(logPath, '');
      }
    } catch (error) {
      // Log doesn't exist yet, that's ok
    }
  }

  // Archive old trade files
  async archiveTrades() {
    try {
      const files = await fs.readdir(this.tradesDir);
      const now = Date.now();
      const retentionMs = this.config.tradeRetentionDays * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (!file.startsWith('trades_') || file === 'current_session.json') continue;
        
        const filePath = path.join(this.tradesDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > retentionMs) {
          if (this.config.enableArchiving) {
            // Compress and archive
            const archivePath = path.join(this.archiveDir, file + '.gz');
            const content = await fs.readFile(filePath, 'utf8');
            const zlib = require('zlib');
            const compressed = zlib.gzipSync(content);
            await fs.writeFile(archivePath, compressed);
            console.log(`📦 Archived: ${file}`);
          }
          
          await fs.remove(filePath);
          console.log(`🗑️ Removed old trade file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error archiving trades:', error.message);
    }
  }

  // Clean up old logs
  async cleanupLogs() {
    try {
      const files = await fs.readdir(this.logsDir);
      const now = Date.now();
      const retentionMs = this.config.logRetentionDays * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filePath = path.join(this.logsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > retentionMs) {
          await fs.remove(filePath);
          console.log(`🗑️ Removed old log: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning logs:', error.message);
    }
  }

  // Perform all cleanup tasks
  async performCleanup() {
    console.log('🧹 Starting data cleanup...');
    await this.cleanupLogs();
    await this.archiveTrades();
    console.log('✅ Data cleanup completed');
  }

  // Schedule regular cleanup
  startCleanupScheduler() {
    // Run cleanup on startup
    setTimeout(() => this.performCleanup(), 5000);
    
    // Schedule regular cleanup
    this.cleanupInterval = setInterval(
      () => this.performCleanup(),
      this.config.cleanupInterval
    );
    
    console.log(`⏰ Cleanup scheduled every ${this.config.cleanupInterval / 3600000} hours`);
  }

  stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Get memory usage stats
  getMemoryStats() {
    const used = process.memoryUsage();
    return {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024)
    };
  }

  // Monitor memory and warn if too high
  checkMemoryUsage(threshold = 500) {
    const stats = this.getMemoryStats();
    if (stats.heapUsed > threshold) {
      console.warn(`⚠️ High memory usage: ${stats.heapUsed}MB (threshold: ${threshold}MB)`);
      return true;
    }
    return false;
  }
}

module.exports = DataManager;