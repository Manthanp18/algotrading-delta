import express from 'express';
import cors from 'cors';
import DeltaAPIService from './services/DeltaAPIService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AlgoTrading Backend',
    version: '1.0.0'
  });
});

// Test Delta API
app.get('/api/test-delta', async (req, res) => {
  try {
    const deltaAPI = new DeltaAPIService();
    const isConnected = await deltaAPI.testConnection();
    
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Delta Exchange API connection successful' : 'Connection failed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Test Server Started
📡 Port: ${PORT}
📈 Testing Delta Exchange API connection
⏰ Started at: ${new Date().toISOString()}
  `);
});

export default app;