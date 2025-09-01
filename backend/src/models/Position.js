import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  side: {
    type: String,
    enum: ['long', 'short', 'none'],
    default: 'none'
  },
  entryPrice: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    default: 0
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  unrealizedPnL: {
    type: Number,
    default: 0
  },
  realizedPnL: {
    type: Number,
    default: 0
  },
  entryTime: {
    type: Date
  },
  strategy: {
    type: String,
    default: 'RenkoEMA'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Methods to calculate PnL
positionSchema.methods.calculateUnrealizedPnL = function() {
  if (!this.isActive || this.quantity === 0) return 0;
  
  if (this.side === 'long') {
    return (this.currentPrice - this.entryPrice) * this.quantity;
  } else if (this.side === 'short') {
    return (this.entryPrice - this.currentPrice) * this.quantity;
  }
  return 0;
};

positionSchema.methods.updateCurrentPrice = function(price) {
  this.currentPrice = price;
  this.unrealizedPnL = this.calculateUnrealizedPnL();
  this.lastUpdate = new Date();
};

export default mongoose.model('Position', positionSchema);