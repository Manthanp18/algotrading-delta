import mongoose from 'mongoose';

const marketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  open: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    default: 0
  },
  source: {
    type: String,
    enum: ['delta', 'websocket', 'rest'],
    default: 'delta'
  }
}, {
  timestamps: true
});

// Compound index for efficient time-series queries
marketDataSchema.index({ symbol: 1, timestamp: -1 });

// Signal schema for strategy signals
const signalSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  signalType: {
    type: String,
    enum: ['buy_entry', 'sell_entry', 'buy_exit', 'sell_exit'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  indicators: {
    ema21: Number,
    supertrend_2_1: Number,
    supertrend_3_1: Number,
    supertrend_4_1: Number,
    atr: Number
  },
  strategy: {
    type: String,
    default: 'RenkoEMA'
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 1
  }
}, {
  timestamps: true
});

signalSchema.index({ symbol: 1, timestamp: -1 });
signalSchema.index({ signalType: 1, timestamp: -1 });

export const MarketData = mongoose.model('MarketData', marketDataSchema);
export const Signal = mongoose.model('Signal', signalSchema);