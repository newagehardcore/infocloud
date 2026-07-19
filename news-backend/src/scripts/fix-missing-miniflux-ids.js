require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');
const axios = require('axios');

// Miniflux API configuration
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;

async function findAndFixSourcesWithoutMinifluxIds() {
  try {
    console.log('Connecting to MongoDB...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/infocloud';
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully.');

    // Get Miniflux categories to build the category map
    console.log('Fetching Miniflux categories...');
    let categoryMap = {};
    try {
      const categoriesResponse = await axios.get(
        `${MINIFLUX_URL}/v1/categories`,
        {
          headers: {
            'X-Auth-Token': MINIFLUX_API_KEY
          }
        }
      );
      
      // Build category map
      categoriesResponse.data.forEach(category => {
        categoryMap[category.title.toLowerCase()] = category.id;
      });
      console.log(`Built category map with ${Object.keys(categoryMap).length} categories`);
    } catch (error) {
      console.error(`Error fetching Miniflux categories: ${error.message}`);
      console.log('Proceeding with empty category map. Will use default category (1).');
    }

    // Find sources with null or undefined minifluxFeedId
    const sourcesWithoutMinifluxId = await Source.find({
      $or: [
        { minifluxFeedId: null },
        { minifluxFeedId: { $exists: false } }
      ]
    });

    console.log(`Found ${sourcesWithoutMinifluxId.length} sources without Miniflux IDs.`);

    if (sourcesWithoutMinifluxId.length === 0) {
      console.log('No sources to fix. Exiting.');
      await mongoose.disconnect();
      return;
    }

    console.log('Attempting to fix sources by creating Miniflux feeds...');
    
    let fixedCount = 0;
    let errorCount = 0;

    for (const source of sourcesWithoutMinifluxId) {
      try {
        console.log(`\nProcessing source: ${source.name} (${source.url})`);
        
        // Determine miniflux category ID based on source category
        let categoryId = 1; // Default to category 1
        if (source.category && categoryMap[source.category.toLowerCase()]) {
          categoryId = categoryMap[source.category.toLowerCase()];
        }
        
        console.log(`Using category ID: ${categoryId} for source category: ${source.category}`);
        
        // Create feed in Miniflux
        console.log(`Attempting to create feed in Miniflux with category ID: ${categoryId}`);
        const createFeedResponse = await axios.post(
          `${MINIFLUX_URL}/v1/feeds`,
          {
            feed_url: source.url,
            category_id: categoryId
          },
          {
            headers: {
              'X-Auth-Token': MINIFLUX_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (createFeedResponse.status === 201) {
          const minifluxFeedId = createFeedResponse.data.feed_id;
          console.log(`Successfully created feed in Miniflux with ID: ${minifluxFeedId}`);
          
          // Update source in MongoDB with minifluxFeedId
          await Source.updateOne(
            { _id: source._id },
            { minifluxFeedId: minifluxFeedId }
          );
          console.log(`Updated source in MongoDB with minifluxFeedId: ${minifluxFeedId}`);
          fixedCount++;
        } else {
          console.error(`Unexpected response status: ${createFeedResponse.status}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing source ${source.name}:`);
        
        if (error.response && error.response.data) {
          const errorMessage = error.response.data.error_message || JSON.stringify(error.response.data);
          console.error(`Miniflux API error: ${errorMessage}`);
          
          // If the feed already exists, try to find its ID
          if (errorMessage.includes('This feed already exists') || errorMessage.includes('duplicated feed')) {
            console.log('Feed reported as already existing. Attempting to find its ID...');
            try {
              // Get all feeds from Miniflux
              const feedsResponse = await axios.get(
                `${MINIFLUX_URL}/v1/feeds`,
                {
                  headers: {
                    'X-Auth-Token': MINIFLUX_API_KEY
                  }
                }
              );
              
              // Look for a feed with a matching URL
              const matchingFeed = feedsResponse.data.find(feed => 
                feed.feed_url === source.url || 
                feed.site_url === source.url || 
                feed.feed_url.includes(source.url) || 
                source.url.includes(feed.feed_url)
              );
              
              if (matchingFeed) {
                console.log(`Found matching feed in Miniflux with ID: ${matchingFeed.id}`);
                
                // Update source in MongoDB with minifluxFeedId
                await Source.updateOne(
                  { _id: source._id },
                  { minifluxFeedId: matchingFeed.id }
                );
                console.log(`Updated source in MongoDB with minifluxFeedId: ${matchingFeed.id}`);
                fixedCount++;
              } else {
                console.log('No matching feed found in Miniflux.');
                
                // Try creating feed with a modified URL to bypass "already existing" error
                const timestamp = Date.now();
                const modifiedUrl = source.url.includes('?') 
                  ? `${source.url}&_t=${timestamp}` 
                  : `${source.url}?_t=${timestamp}`;
                  
                console.log(`Attempting to create feed with modified URL: ${modifiedUrl}`);
                
                try {
                  // Use the same categoryId that was determined earlier in the main try block
                  const categoryId = source.category && categoryMap[source.category.toLowerCase()] 
                    ? categoryMap[source.category.toLowerCase()] 
                    : 1;
                    
                  const modifiedCreateResponse = await axios.post(
                    `${MINIFLUX_URL}/v1/feeds`,
                    {
                      feed_url: modifiedUrl,
                      category_id: categoryId
                    },
                    {
                      headers: {
                        'X-Auth-Token': MINIFLUX_API_KEY,
                        'Content-Type': 'application/json'
                      }
                    }
                  );
                  
                  if (modifiedCreateResponse.status === 201) {
                    const minifluxFeedId = modifiedCreateResponse.data.feed_id;
                    console.log(`Successfully created feed with modified URL in Miniflux with ID: ${minifluxFeedId}`);
                    
                    // Update source in MongoDB with minifluxFeedId
                    await Source.updateOne(
                      { _id: source._id },
                      { minifluxFeedId: minifluxFeedId }
                    );
                    console.log(`Updated source in MongoDB with minifluxFeedId: ${minifluxFeedId}`);
                    fixedCount++;
                  } else {
                    console.error(`Unexpected response status for modified URL: ${modifiedCreateResponse.status}`);
                    errorCount++;
                  }
                } catch (modifiedError) {
                  console.error(`Error creating feed with modified URL: ${modifiedError.message}`);
                  errorCount++;
                }
              }
            } catch (findError) {
              console.error(`Error finding existing feed: ${findError.message}`);
              errorCount++;
            }
          } else {
            errorCount++;
          }
        } else {
          console.error(`Error: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\nSummary:');
    console.log(`Total sources processed: ${sourcesWithoutMinifluxId.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Failed to fix: ${errorCount}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    
  } catch (error) {
    console.error(`Global error: ${error.message}`);
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
findAndFixSourcesWithoutMinifluxIds(); 