const { MongoClient } = require('mongodb');
require('dotenv').config(); // Load environment variables from .env file

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017'; // Default URI if not set in .env
const DB_NAME = process.env.DB_NAME || 'news_aggregator'; // Default DB name if not set

let db = null;

const connectDB = async () => {
  if (db) {
    console.log('Using existing database connection');
    return db;
  }
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('MongoDB Connected...');
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

module.exports = { connectDB, getDB };
