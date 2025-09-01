import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export const deltaConfig = {
  apiKey: process.env.DELTA_API_KEY,
  apiSecret: process.env.DELTA_API_SECRET,
  baseUrl: process.env.DELTA_BASE_URL || 'https://api.delta.exchange',
  websocketUrl: 'wss://socket.india.delta.exchange',

  // API endpoints
  endpoints: {
    products: '/v2/products',
    tickers: '/v2/tickers',
    orderbook: '/v2/l2orderbook',
    trades: '/v2/trades',
    candles: '/v2/history/candles',
    account: '/v2/profile',
    positions: '/v2/positions',
    orders: '/v2/orders',
    wallet: '/v2/wallet/balances'
  },

  // WebSocket channels
  wsChannels: {
    ticker: 'ticker',
    orderbook: 'l2_orderbook',
    trades: 'all_trades',
    candlestick: 'candlestick_1m'
  },

  // Rate limiting
  rateLimit: {
    maxRequestsPer5Min: 10000,
    maxProductOps: 500
  },

  // Default trading parameters  
  defaultSymbol: 'BTCUSD',
  defaultQuantity: 0.001,

  // Strategy parameters
  strategy: {
    brickSize: 10.0,
    emaLength: 21,
    atrPeriod: 14,  // ATR period for Renko brick sizing
    supertrendAtrPeriod: 10,  // ATR period for SuperTrend (matches TradingView SuperTrend 10)
    supertrendMultipliers: [2.1, 3.1, 4.1]
  }
};

// Validate required configuration
if (!deltaConfig.apiKey || !deltaConfig.apiSecret) {
  console.error('Missing Delta Exchange API credentials in environment variables');
  console.error('Required: DELTA_API_KEY, DELTA_API_SECRET');
  process.exit(1);
}

export default deltaConfig;