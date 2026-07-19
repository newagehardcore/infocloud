require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');

async function checkSourceStats() {
  try {
    console.log('Connecting to MongoDB...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/infocloud';
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully.');

    // Count all sources
    const totalCount = await Source.countDocuments({});
    console.log(`Total sources: ${totalCount}`);

    // Count sources with Miniflux IDs
    const minifluxCount = await Source.countDocuments({ minifluxFeedId: { $exists: true, $ne: null } });
    console.log(`Sources with Miniflux IDs: ${minifluxCount} (${((minifluxCount / totalCount) * 100).toFixed(2)}%)`);

    // Count by category
    const categories = await Source.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\nSources by category:');
    categories.forEach(cat => {
      console.log(`${cat._id}: ${cat.count} (${((cat.count / totalCount) * 100).toFixed(2)}%)`);
    });

    // Count by bias
    const biases = await Source.aggregate([
      { $group: { _id: "$bias", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\nSources by bias:');
    biases.forEach(bias => {
      console.log(`${bias._id}: ${bias.count} (${((bias.count / totalCount) * 100).toFixed(2)}%)`);
    });

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Ensure we disconnect even if there's an error
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB due to error.');
    } catch (disconnectError) {
      console.error(`Error disconnecting from MongoDB: ${disconnectError.message}`);
    }
  }
}

// Run the function
checkSourceStats(); 