const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

const logsFile = path.join(__dirname, '../../logs/trading.log');

// Endpoint to get logs
app.get('/api/logs', (req, res) => {
  const level = req.query.level || 'all';
  const limit = parseInt(req.query.limit) || 100;
  
  try {
    // Use in-memory logs from logger instance with the requested limit
    const recentLogs = logger.getLogs(level, limit);
    
    res.json({
      logs: recentLogs, // Chronological order (oldest first, newest last)
      totalLogs: recentLogs.length,
      logLevel: level,
      lastUpdate: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
function startLogsServer() {
  app.listen(PORT, () => {
    console.log(`📝 Logs server running on http://localhost:${PORT}`);
  });
}

module.exports = { startLogsServer };

// Start if run directly
if (require.main === module) {
  startLogsServer();
}