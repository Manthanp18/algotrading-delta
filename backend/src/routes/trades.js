import express from 'express';
import DeltaAPIService from '../services/DeltaAPIService.js';

const router = express.Router();
const deltaAPI = new DeltaAPIService();

// Test connection to Delta Exchange
router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await deltaAPI.testConnection();
    
    if (isConnected) {
      // Get some basic market data to verify
      const ticker = await deltaAPI.getTicker();
      
      res.json({
        success: true,
        message: 'Delta Exchange API connection successful',
        data: {
          connected: true,
          timestamp: new Date(),
          sampleData: ticker?.result?.[0] || null
        }
      });
    } else {
      res.status(503).json({
        success: false,
        message: 'Delta Exchange API connection failed'
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
});

// Get products
router.get('/products', async (req, res) => {
  try {
    const products = await deltaAPI.getProducts();
    
    res.json({
      success: true,
      data: products?.result || [],
      count: products?.result?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

export default router;