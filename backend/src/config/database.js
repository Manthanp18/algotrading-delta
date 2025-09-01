import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '../../../.env' });

const connectDB = async () => {
  try {
    // Use MongoDB Atlas or local MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/algo-trading';
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes for better performance
    await createIndexes();
    
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Market Data indexes
    await db.collection('marketdatas').createIndex({ symbol: 1, timestamp: -1 });
    
    // Trade indexes
    await db.collection('trades').createIndex({ symbol: 1, timestamp: -1 });
    await db.collection('trades').createIndex({ strategy: 1, timestamp: -1 });
    
    // Position indexes
    await db.collection('positions').createIndex({ symbol: 1 });
    
    // Signal indexes
    await db.collection('signals').createIndex({ symbol: 1, timestamp: -1 });
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

export default connectDB;