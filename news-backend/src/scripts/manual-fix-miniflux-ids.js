require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');

// Mapping of source URLs to Miniflux feed IDs based on investigation
const SOURCE_TO_MINIFLUX_MAP = {
  'https://www.huffpost.com/section/politics/feed': 286, // huffpost politics
  'https://www.washingtonexaminer.com/tag/politics.rss': 299, // washington examiner politics
  'https://www.theguardian.com/technology/rss': 58, // guardian technology
  'https://www.ft.com/?format=rss': 331, // ft.com
  'https://www.investopedia.com/feedbuilder/feed/getfeed/?feedname=rss_articles': 334, // investopedia found feed
  'https://gizmodo.com/rss': 160, // gizmodo
  'http://www.realclimate.org/index.php/feed/': 165, // realclimate
  'https://www.outkick.com/feed/': 179, // outkick
  'https://www.breitbart.com/entertainment/feed/': 183, // breitbart entertainment
  'https://www.greencarreports.com/rss': 197, // greencar reports
  'https://deepmind.com/blog/rss.xml': 226, // deepmind blog
  'https://www.nasa.gov/rss/dyn/breaking_news.rss': 235, // nasa
  'https://www.businessoffashion.com/feed.xml': 247, // business of fashion
  'https://www.whowhatwear.com/rss': 250 // whowhatwear
};

async function fixSourcesWithMissingIds() {
  try {
    console.log('Connecting to MongoDB...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/infocloud';
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully.');

    let fixedCount = 0;
    let skippedCount = 0;

    // Process each source URL in our map
    for (const [sourceUrl, minifluxId] of Object.entries(SOURCE_TO_MINIFLUX_MAP)) {
      console.log(`\nProcessing source with URL: ${sourceUrl}`);
      
      // Skip if no matching ID was found
      if (minifluxId === null) {
        console.log(`No matching Miniflux ID found for ${sourceUrl}. Skipping.`);
        skippedCount++;
        continue;
      }
      
      // Find the source in MongoDB
      const source = await Source.findOne({ url: sourceUrl });
      if (!source) {
        console.log(`Source with URL ${sourceUrl} not found in MongoDB. Skipping.`);
        skippedCount++;
        continue;
      }
      
      // Check if source already has a Miniflux ID
      if (source.minifluxFeedId) {
        console.log(`Source ${source.name} already has Miniflux ID: ${source.minifluxFeedId}. Skipping.`);
        skippedCount++;
        continue;
      }
      
      // Update the source with the Miniflux ID
      console.log(`Updating source ${source.name} with Miniflux ID: ${minifluxId}`);
      await Source.updateOne(
        { _id: source._id },
        { minifluxFeedId: minifluxId }
      );
      console.log(`Updated ${source.name} with Miniflux ID: ${minifluxId}`);
      fixedCount++;
    }

    console.log('\nSummary:');
    console.log(`Total sources processed: ${Object.keys(SOURCE_TO_MINIFLUX_MAP).length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    
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
fixSourcesWithMissingIds(); 