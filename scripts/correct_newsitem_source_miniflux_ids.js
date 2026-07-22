const mongoose = require('mongoose');
const path = require('path');
// Configure dotenv to load variables from the root .env file
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { connectDB } = require('../src/config/db');
const NewsItem = require('../src/models/NewsItem');
const Source = require('../src/models/Source'); // Assuming Source model is accessible

async function correctNewsItemSourceMinifluxIds() {
  let updatedCount = 0;
  let notFoundSourceCount = 0;
  let alreadyCorrectCount = 0;
  let missingTopLevelIdCount = 0;
  let errorCount = 0;
  let processedCount = 0;

  try {
    console.log('Attempting to connect to MongoDB...');
    await connectDB();
    console.log('Successfully connected to MongoDB.');

    const batchSize = 100; // Process 100 items at a time
    let skip = 0;
    let hasMore = true;

    console.log('Starting to process NewsItem documents...');

    while (hasMore) {
      console.log(`Fetching batch of NewsItems: skip=${skip}, limit=${batchSize}`);
      const newsItems = await NewsItem.find({})
        .skip(skip)
        .limit(batchSize)
        .lean(); // Use .lean() for performance as we don't need Mongoose full documents for reading

      if (newsItems.length === 0) {
        hasMore = false;
        console.log('No more NewsItems to process.');
        break;
      }

      console.log(`Processing ${newsItems.length} NewsItems in this batch...`);

      for (const item of newsItems) {
        processedCount++;
        if (processedCount % 50 === 0) {
          console.log(`Processed ${processedCount} items so far...`);
        }

        // Check if NewsItem.source.minifluxFeedId already exists and is a number
        if (item.source && typeof item.source.minifluxFeedId === 'number') {
          // console.log(`NewsItem ID ${item._id} (MinifluxEntryId: ${item.minifluxEntryId}) already has source.minifluxFeedId: ${item.source.minifluxFeedId}. Skipping.`);
          alreadyCorrectCount++;
          continue;
        }

        const topLevelMinifluxFeedIdStr = item.minifluxFeedId;

        if (!topLevelMinifluxFeedIdStr) {
          console.warn(`NewsItem ID ${item._id} (MinifluxEntryId: ${item.minifluxEntryId}) is missing the top-level minifluxFeedId. Cannot correct. Source Name: ${item.source?.name}`);
          missingTopLevelIdCount++;
          continue;
        }

        const topLevelMinifluxFeedIdNum = parseInt(topLevelMinifluxFeedIdStr, 10);
        if (isNaN(topLevelMinifluxFeedIdNum)) {
          console.warn(`NewsItem ID ${item._id} (MinifluxEntryId: ${item.minifluxEntryId}) has an invalid top-level minifluxFeedId: '${topLevelMinifluxFeedIdStr}'. Cannot parse to number. Source Name: ${item.source?.name}`);
          missingTopLevelIdCount++; // Count as missing/unusable ID
          continue;
        }

        try {
          const sourceDoc = await Source.findOne({ minifluxFeedId: topLevelMinifluxFeedIdNum }).lean();

          if (sourceDoc && typeof sourceDoc.minifluxFeedId === 'number') {
            // We found the source and it has the numeric minifluxFeedId
            // Now update the original NewsItem document (not the .lean() one)
            const updateResult = await NewsItem.updateOne(
              { _id: item._id }, // Use the actual _id of the NewsItem
              { $set: { 'source.minifluxFeedId': sourceDoc.minifluxFeedId } }
            );

            if (updateResult.modifiedCount > 0) {
              // console.log(`NewsItem ID ${item._id} (MinifluxEntryId: ${item.minifluxEntryId}) updated. Set source.minifluxFeedId to ${sourceDoc.minifluxFeedId}.`);
              updatedCount++;
            } else if (updateResult.matchedCount > 0 && updateResult.modifiedCount === 0) {
              // This case might occur if the value was somehow already set correctly between the .find() and .updateOne()
              // or if there was no actual change needed (e.g., if source.minifluxFeedId was null and we set it to null, though our initial check should prevent this)
              // console.log(`NewsItem ID ${item._id} was matched but not modified. Value might have been already correct: ${sourceDoc.minifluxFeedId}`);
              alreadyCorrectCount++;
            } else {
               console.warn(`NewsItem ID ${item._id} was not found for update, or not modified. Match count: ${updateResult.matchedCount}`);
               // This shouldn't happen if we just fetched it, but good to log.
            }
          } else {
            console.warn(`No Source document found (or Source missing numeric minifluxFeedId) for topLevelMinifluxFeedIdNum: ${topLevelMinifluxFeedIdNum} (from NewsItem ${item._id}, MinifluxEntryId: ${item.minifluxEntryId}, Source Name: ${item.source?.name}).`);
            notFoundSourceCount++;
          }
        } catch (e) {
          console.error(`Error processing NewsItem ID ${item._id} (MinifluxEntryId: ${item.minifluxEntryId}): ${e.message}`, e);
          errorCount++;
        }
      }
      skip += newsItems.length;
    }

  } catch (err) {
    console.error('A critical error occurred during the script:', err);
    errorCount++; // Count critical errors as well
  } finally {
    console.log('\n--- Script Execution Summary ---');
    console.log(`Total NewsItems Processed (attempted): ${processedCount}`);
    console.log(`Successfully Updated: ${updatedCount}`);
    console.log(`Already Correct / No Change Needed: ${alreadyCorrectCount}`);
    console.log(`Sources Not Found (or source missing numeric ID): ${notFoundSourceCount}`);
    console.log(`NewsItems Missing Top-Level minifluxFeedId (or unparsable): ${missingTopLevelIdCount}`);
    console.log(`Errors during processing individual items: ${errorCount}`);
    
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    } catch (disconnectErr) {
      console.error('Error disconnecting from MongoDB:', disconnectErr);
    }
  }
}

correctNewsItemSourceMinifluxIds()
  .then(() => console.log('Script finished.'))
  .catch(err => console.error('Script finished with error:', err)); 