import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  side: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  type: {
    type: String,
    enum: ['entry', 'exit'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  pnl: {
    type: Number,
    default: 0
  },
  strategy: {
    type: String,
    default: 'RenkoEMA'
  },
  signalData: {
    ema21: Number,
    supertrend_2_1: Number,
    supertrend_3_1: Number,
    supertrend_4_1: Number,
    renkoBrick: {
      direction: Number,
      close: Number,
      open: Number
    }
  },
  isSimulated: {
    type: Boolean,
    default: true
  },
  executionTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
tradeSchema.index({ symbol: 1, timestamp: -1 });
tradeSchema.index({ strategy: 1, timestamp: -1 });

export default mongoose.model('Trade', tradeSchema);