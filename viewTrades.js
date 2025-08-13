const fs = require('fs');
const path = require('path');

// Get the latest result file
const resultsDir = path.join(__dirname, 'backtest-results');
const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json'))
  .sort((a, b) => b.localeCompare(a));

if (files.length === 0) {
  console.log('No backtest results found');
  process.exit(1);
}

const latestFile = files[0];
const data = JSON.parse(fs.readFileSync(path.join(resultsDir, latestFile), 'utf8'));

console.log('\n=== PAIRED TRADES WITH ENTRY AND EXIT TIMES ===\n');
console.log(`File: ${latestFile}`);
console.log(`Total Completed Trades: ${data.results.completedTrades.length}`);
console.log(`Win Rate: ${data.results.metrics.winRate}%`);
console.log('\n' + '='.repeat(100) + '\n');

const trades = data.results.completedTrades || [];

if (trades.length === 0) {
  console.log('No completed trades found');
  process.exit(0);
}

// Show first 10 trades
trades.slice(0, 10).forEach((trade, index) => {
  console.log(`TRADE ${index + 1}:`);
  console.log(`  Entry Signal: ${trade.entrySignal}`);
  console.log(`  Entry Time:   ${new Date(trade.entryTime).toLocaleString()}`);
  console.log(`  Entry Price:  $${trade.entryPrice.toFixed(2)}`);
  console.log(`  `);
  console.log(`  Exit Signal:  ${trade.exitSignal}`);
  console.log(`  Exit Time:    ${new Date(trade.exitTime).toLocaleString()}`);
  console.log(`  Exit Price:   $${trade.exitPrice.toFixed(2)}`);
  console.log(`  `);
  console.log(`  Quantity:     ${trade.quantity.toFixed(6)} BTC`);
  console.log(`  Hold Time:    ${trade.holdingPeriod} minutes`);
  console.log(`  P&L:          ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%)`);
  console.log('-'.repeat(100));
});

console.log('\nSUMMARY:');
console.log(`Total P&L: $${data.results.metrics.totalPnl}`);
console.log(`Final Equity: $${data.results.metrics.finalEquity}`);
console.log(`Winning Trades: ${data.results.metrics.winningTrades}`);
console.log(`Losing Trades: ${data.results.metrics.losingTrades}`);