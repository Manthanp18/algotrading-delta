const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logFile = path.join(__dirname, '../../logs/trading.log');
    this.maxLines = 1000;
    this.logs = [];
    
    // Ensure logs directory exists
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Clear log file on startup
    fs.writeFileSync(this.logFile, '');
  }
  
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    
    // Add to memory
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLines) {
      this.logs.shift();
    }
    
    // Write to file
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.logFile, logLine);
    
    // Terminal-friendly console output
    this.logToConsole(level, message, data, timestamp);
    
    return logEntry;
  }
  
  logToConsole(level, message, data, timestamp) {
    // Format timestamp for terminal (HH:MM:SS)
    const time = new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Level formatting with fixed width
    const levelMap = {
      'info': 'INFO   ',
      'warn': 'WARN   ',
      'error': 'ERROR  ',
      'success': 'SUCCESS',
      'trade': 'TRADE  ',
      'market': 'MARKET '
    };
    
    const levelStr = levelMap[level] || level.toUpperCase().padEnd(7);
    
    // Format the console output
    let output = `[${time}] ${levelStr} | ${message}`;
    
    // Add data if present
    if (data && Object.keys(data).length > 0) {
      // Format specific data types for better readability
      if (data.price !== undefined) {
        output += ` | $${data.price.toFixed(2)}`;
      }
      if (data.candle !== undefined) {
        output += ` | Candle #${data.candle}`;
      }
      if (data.activeStrategy !== undefined) {
        output += ` | Strategy: ${data.activeStrategy}`;
      }
      if (data.marketRegime !== undefined) {
        output += ` | Regime: ${data.marketRegime}`;
      }
      if (data.ohlcv !== undefined) {
        const c = data.ohlcv;
        output += ` | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume}`;
      }
      
      // Add any remaining data not explicitly handled
      const handled = ['price', 'candle', 'activeStrategy', 'marketRegime', 'ohlcv', 'time'];
      const remaining = Object.keys(data).filter(k => !handled.includes(k));
      if (remaining.length > 0) {
        const extraData = remaining.map(k => `${k}:${JSON.stringify(data[k])}`).join(' ');
        output += ` | ${extraData}`;
      }
    }
    
    console.log(output);
  }
  
  info(message, data) {
    return this.log('info', message, data);
  }
  
  warn(message, data) {
    return this.log('warn', message, data);
  }
  
  error(message, data) {
    return this.log('error', message, data);
  }
  
  success(message, data) {
    return this.log('success', message, data);
  }
  
  trade(message, data) {
    return this.log('trade', message, data);
  }
  
  market(message, data) {
    return this.log('market', message, data);
  }
  
  getLogs(level = 'all', limit = 100) {
    let filteredLogs = this.logs;
    
    if (level !== 'all') {
      filteredLogs = this.logs.filter(log => log.level === level);
    }
    
    // The logs array is already in chronological order (oldest first) as they're pushed in sequence
    // Get the last 'limit' logs and return them in chronological order for terminal-like display
    const recentLogs = filteredLogs.slice(-limit);
    
    return recentLogs; // Return in chronological order: oldest first, newest last
  }
}

module.exports = new Logger();