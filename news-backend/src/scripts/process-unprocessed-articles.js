/**
 * Script to manually process unprocessed articles
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { processNewsKeywords } = require('../services/wordProcessingService');
const NewsItem = require('../models/NewsItem');
const { aggregateKeywordsForCloud } = require('../services/wordProcessingService');

async function processUnprocessedArticles() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    console.log('Fetching unprocessed articles...');
    const unprocessedArticles = await NewsItem.find(
      { llmProcessed: false },
      'title contentSnippet url minifluxEntryId llmProcessingAttempts _id source bias'
    )
    .limit(50) // Process 50 at a time
    .lean()
    .exec();
    
    console.log(`Found ${unprocessedArticles.length} unprocessed articles.`);
    
    if (unprocessedArticles.length === 0) {
      console.log('No unprocessed articles found.');
      await mongoose.connection.close();
      return;
    }
    
    console.log('Processing articles with LLM...');
    const processedArticles = await processNewsKeywords(unprocessedArticles);
    console.log(`Processed ${processedArticles.length} articles.`);
    
    console.log('Saving processed articles to database...');
    const bulkOps = [];
    
    for (const article of processedArticles) {
      bulkOps.push({
        updateOne: {
          filter: { minifluxEntryId: article.minifluxEntryId },
          update: {
            $set: {
              keywords: article.keywords,
              bias: article.bias,
              llmProcessed: true,
              processedAt: article.processedAt || new Date()
            },
            $inc: { llmProcessingAttempts: 1 }
          }
        }
      });
    }
    
    if (bulkOps.length > 0) {
      const result = await NewsItem.bulkWrite(bulkOps);
      console.log(`Updated ${result.modifiedCount} articles in the database.`);
    }
    
    console.log('Rebuilding keyword cache...');
    await aggregateKeywordsForCloud();
    console.log('Keyword cache rebuilt successfully!');
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('Error processing articles:', error);
    process.exit(1);
  }
}

// Run the function
processUnprocessedArticles(); 