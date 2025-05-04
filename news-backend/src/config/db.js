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

    // ---> Ensure TTL index exists on newsitems collection <--- 
    try {
      const newsCollection = db.collection('newsitems');
      const indexName = 'createdAt_ttl'; // Give the index a specific name
      const result = await newsCollection.createIndex(
        { "createdAt": 1 }, 
        { expireAfterSeconds: 604800, name: indexName } // 7 days = 604800 seconds
      );
      console.log(`Ensured TTL index '${indexName}' on newsitems.createdAt: ${result}`);
    } catch (indexError) {
      console.error(`Error ensuring TTL index on newsitems: ${indexError.message}`);
      // Decide if this should be fatal - potentially continue if index already exists
      // but log error prominently.
    }
    // ---> End index creation <--- 

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
