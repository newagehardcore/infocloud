require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');

async function fixSourceIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/infocloud';
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully.');

    // 1. Drop the problematic minifluxFeedId unique index
    console.log('Dropping existing minifluxFeedId index...');
    try {
      await mongoose.connection.db.collection('sources').dropIndex('minifluxFeedId_1');
      console.log('Successfully dropped minifluxFeedId_1 index.');
    } catch (err) {
      // If the index doesn't exist, that's okay
      console.log('Unable to drop index, it may not exist:', err.message);
    }

    // 2. Create a new non-unique sparse index
    console.log('Creating new sparse index on minifluxFeedId...');
    await mongoose.connection.db.collection('sources').createIndex(
      { minifluxFeedId: 1 },
      { sparse: true }
    );
    console.log('Successfully created new sparse index on minifluxFeedId.');

    // 3. List all indexes to confirm changes
    console.log('Current indexes on sources collection:');
    const indexes = await mongoose.connection.db.collection('sources').indexes();
    console.log(JSON.stringify(indexes, null, 2));

    console.log('Index fix completed successfully!');
  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

fixSourceIndexes().catch(console.error); 