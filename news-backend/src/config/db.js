const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Correctly load .env from project root

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/news_aggregator'; // Default URI including DB name

const connectDB = async () => {
  // Check if already connected
  if (mongoose.connection.readyState >= 1) {
    console.log('Using existing Mongoose database connection.');
    return;
  }

  try {
    // Mongoose connection options
    const options = {
      useNewUrlParser: true,        // Added for avoiding deprecation warnings
      useUnifiedTopology: true,   // Added for unified topology
      // useCreateIndex: true,      // For Mongoose versions < 6, ensure indexes. For v6+, it's default or no-op.
      // useFindAndModify: false,   // To use native findOneAndUpdate() instead of findAndModify(). Consider if needed.
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 45000, // Increase socket timeout
      bufferCommands: true, // Mongoose default, keep buffering enabled
      // bufferTimeoutMS: 30000 // Mongoose >= 6 default is no timeout, explicitly setting it might override internal logic, rely on serverSelectionTimeoutMS for now.
      dbName: process.env.DB_NAME || 'news_aggregator' // Ensure DB name is specified if not in URI
    };

    console.log(`Connecting to MongoDB with Mongoose at ${MONGODB_URI} with options:`, options);
    await mongoose.connect(MONGODB_URI, options);
    
    console.log('Mongoose MongoDB Connected...');

    // Mongoose handles index creation automatically based on schema definitions
    // The TTL index in NewsItem.js will be ensured on model compilation/app start.
    // We can add listeners for connection events if needed.
    mongoose.connection.on('error', err => {
      console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected.');
    });

  } catch (err) {
    console.error('Mongoose connection error:', err.message);
    console.error('Full error:', err); // Log full error
    // Exit process with failure
    process.exit(1);
  }
};

// No need for getDB with Mongoose, it manages the default connection.

module.exports = { connectDB };
