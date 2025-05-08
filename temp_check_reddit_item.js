const mongoose = require('mongoose');
const NewsItem = require('./news-backend/src/models/NewsItem');
const Source = require('./news-backend/src/models/Source');

// Connect to the correct database: news_aggregator
const MONGODB_URI = 'mongodb://localhost:27017/news_aggregator';
const REDDIT_FEED_ID_AS_STRING = "612"; // Use string based on NewsItem schema definition

async function checkRedditNewsItemStructure() {
  console.log(`Attempting to connect to MongoDB at ${MONGODB_URI}`);
  // Add connection listeners (optional, but good for debugging)
  mongoose.connection.on('connecting', () => console.log('Mongoose: connecting...'));
  mongoose.connection.on('connected', () => console.log('Mongoose: connected.'));
  mongoose.connection.on('open', () => console.log('Mongoose: connection open.'));
  mongoose.connection.on('reconnected', () => console.log('Mongoose: reconnected.'));
  mongoose.connection.on('error', err => console.error('Mongoose: connection error:', err));
  mongoose.connection.on('disconnected', () => console.log('Mongoose: disconnected.'));

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      connectTimeoutMS: 10000
    });

    console.log('\n--- Finding Reddit NewsItem using top-level minifluxFeedId (direct driver) ---');
    // Use the top-level minifluxFeedId (defined as String in schema) to find the item
    const redditNewsItemDirect = await mongoose.connection.db.collection('newsitems').findOne({
      minifluxFeedId: REDDIT_FEED_ID_AS_STRING 
    });

    if (redditNewsItemDirect) {
      console.log('SUCCESS: Found a NewsItem likely from Reddit using top-level minifluxFeedId.');
      console.log('--- Full NewsItem Document ---');
      console.log(JSON.stringify(redditNewsItemDirect, null, 2));
      console.log('-----------------------------');
      console.log('\nPlease examine the 'source' field within the document above.');
      console.log('Does it contain 'minifluxFeedId'? If so, what is its value and type?');
      console.log(`Compare it to the top-level minifluxFeedId: ${redditNewsItemDirect.minifluxFeedId} (Type: ${typeof redditNewsItemDirect.minifluxFeedId})`);
      if (redditNewsItemDirect.source && redditNewsItemDirect.source.minifluxFeedId !== undefined) {
          console.log(`Value in source.minifluxFeedId: ${redditNewsItemDirect.source.minifluxFeedId}, Type: ${typeof redditNewsItemDirect.source.minifluxFeedId}`);
          if(redditNewsItemDirect.source.minifluxFeedId === parseInt(REDDIT_FEED_ID_AS_STRING)) {
              console.log('source.minifluxFeedId seems to be present and is a number matching the expected ID.');
          } else {
              console.warn('source.minifluxFeedId is present but is NOT a number or does not match the expected ID.');
          }
      } else {
          console.warn('source.minifluxFeedId is MISSING from the source object within the NewsItem.');
      }
    } else {
      console.log(`Failed to find any NewsItem with top-level minifluxFeedId: "${REDDIT_FEED_ID_AS_STRING}".`);
      console.log('This suggests no items from feed 612 exist, or the top-level minifluxFeedId is stored differently.');
    }

  } catch (error) {
    console.error('Error during script execution:', error);
    if (error.name === 'MongooseServerSelectionError') {
        console.error('This typically means MongoDB is not running or not accessible.');
    } else if (error instanceof mongoose.Error && error.message.includes('buffering timed out')) {
        console.error('Mongoose buffering timeout occurred - investigate Mongoose model interactions.');
    }
  } finally {
    if (mongoose.connection.readyState >= 1) {
        await mongoose.disconnect();
    }
  }
}

checkRedditNewsItemStructure(); 