#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

class ServerManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.restartDelay = 5000; // 5 seconds
    this.logDir = path.join(__dirname, 'logs');
    
    // Ensure logs directory exists
    fs.ensureDirSync(this.logDir);
  }

  async start(symbol = 'BTCUSD', capital = 50000, port = 3000) {
    if (this.isRunning) {
      console.log('⚠️  Server already running');
      return;
    }

    console.log(`🚀 Starting managed live trading server`);
    console.log(`📊 Symbol: ${symbol} | Capital: $${capital.toLocaleString()} | Port: ${port}`);
    console.log(`🔄 Auto-restart enabled (max ${this.maxRestarts} attempts)`);
    console.log('');

    this.symbol = symbol;
    this.capital = capital;
    this.port = port;
    this.startTime = new Date();

    this.spawnProcess();
  }

  spawnProcess() {
    const logFile = path.join(this.logDir, `trading_${new Date().toISOString().split('T')[0]}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    console.log(`📝 Logging to: ${logFile}`);
    
    this.process = spawn('node', ['server-live.js', this.symbol, this.capital.toString(), this.port.toString()], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    this.isRunning = true;
    this.restartCount++;

    // Log startup
    const startMessage = `\n=== PROCESS STARTED ===\nTime: ${new Date().toISOString()}\nRestart #${this.restartCount}\nPID: ${this.process.pid}\n\n`;
    logStream.write(startMessage);
    console.log(`✅ Process started (PID: ${this.process.pid})`);

    // Pipe output to both console and log file
    this.process.stdout.on('data', (data) => {
      process.stdout.write(data);
      logStream.write(data);
    });

    this.process.stderr.on('data', (data) => {
      process.stderr.write(data);
      logStream.write(data);
    });

    this.process.on('close', (code) => {
      this.isRunning = false;
      const closeMessage = `\n=== PROCESS CLOSED ===\nTime: ${new Date().toISOString()}\nExit Code: ${code}\n\n`;
      logStream.write(closeMessage);
      logStream.end();

      console.log(`\n🛑 Process exited with code ${code}`);

      if (code !== 0 && this.restartCount < this.maxRestarts) {
        console.log(`🔄 Restarting in ${this.restartDelay/1000} seconds... (attempt ${this.restartCount + 1}/${this.maxRestarts})`);
        
        setTimeout(() => {
          if (!this.isRunning) { // Only restart if not manually stopped
            this.spawnProcess();
          }
        }, this.restartDelay);
      } else if (this.restartCount >= this.maxRestarts) {
        console.log(`❌ Max restart attempts (${this.maxRestarts}) reached. Stopping.`);
        this.stop();
      }
    });

    this.process.on('error', (error) => {
      console.error(`💥 Process error: ${error.message}`);
      logStream.write(`ERROR: ${error.message}\n`);
    });
  }

  stop() {
    if (!this.isRunning || !this.process) {
      console.log('⚠️  No running process to stop');
      return;
    }

    console.log('🛑 Stopping server...');
    this.isRunning = false;
    
    // Send SIGINT (Ctrl+C) for graceful shutdown
    this.process.kill('SIGINT');
    
    // Force kill after 10 seconds if not stopped
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        console.log('⚡ Force killing process...');
        this.process.kill('SIGKILL');
      }
    }, 10000);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      pid: this.process?.pid,
      restartCount: this.restartCount,
      startTime: this.startTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      symbol: this.symbol,
      capital: this.capital,
      port: this.port
    };
  }

  async getLogs(lines = 50) {
    try {
      const logFile = path.join(this.logDir, `trading_${new Date().toISOString().split('T')[0]}.log`);
      
      if (await fs.pathExists(logFile)) {
        const content = await fs.readFile(logFile, 'utf8');
        const allLines = content.split('\n');
        return allLines.slice(-lines).join('\n');
      }
      
      return 'No log file found for today';
    } catch (error) {
      return `Error reading logs: ${error.message}`;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new ServerManager();

  switch (command) {
    case 'start':
      const symbol = args[1] || 'BTCUSD';
      const capital = parseFloat(args[2]) || 50000;
      const port = parseInt(args[3]) || 3000;
      
      await manager.start(symbol, capital, port);
      
      // Keep process alive
      process.stdin.resume();
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down server manager...');
        manager.stop();
        setTimeout(() => process.exit(0), 2000);
      });
      
      process.on('SIGTERM', () => {
        manager.stop();
        process.exit(0);
      });
      
      break;

    case 'stop':
      manager.stop();
      break;

    case 'status':
      const status = manager.getStatus();
      console.log('📊 Server Status:');
      console.log(`   Running: ${status.isRunning ? '🟢 Yes' : '🔴 No'}`);
      if (status.isRunning) {
        console.log(`   PID: ${status.pid}`);
        console.log(`   Uptime: ${Math.floor(status.uptime / 60000)} minutes`);
        console.log(`   Restarts: ${status.restartCount}`);
        console.log(`   Symbol: ${status.symbol}`);
        console.log(`   Capital: $${status.capital?.toLocaleString()}`);
        console.log(`   Dashboard: http://localhost:${status.port}`);
      }
      break;

    case 'logs':
      const lines = parseInt(args[1]) || 50;
      const logs = await manager.getLogs(lines);
      console.log(`📝 Last ${lines} log lines:`);
      console.log('─'.repeat(50));
      console.log(logs);
      break;

    default:
      console.log(`
🔧 Live Trading Server Manager

Commands:
  start [symbol] [capital] [port]   Start managed server (default: BTCUSD 50000 3000)
  stop                              Stop the server
  status                            Show server status
  logs [lines]                      Show recent logs (default: 50 lines)

Examples:
  node server-manager.js start BTCUSD 25000 3000
  node server-manager.js status
  node server-manager.js logs 100
  node server-manager.js stop
      `);
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = ServerManager;