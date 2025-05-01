// Script to check the tag cloud status
require('dotenv').config(); // Load environment variables from .env file
const mongoose = require('mongoose');
const { processNewsKeywords, aggregateKeywordsForCloud } = require('../services/wordProcessingService');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'news_aggregator';

mongoose.connect(`${MONGODB_URI}/${DB_NAME}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkTagCloud() {
  try {
    console.log('Connecting to database...');
    
    // Wait for connection
    await new Promise(resolve => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('connected', () => {
          console.log('MongoDB Connected...');
          resolve();
        });
      }
    });
    
    console.log('Checking news items...');
    
    // Get the database and collection directly
    const db = mongoose.connection.db;
    const collection = db.collection('newsitems');
    
    // Get all news items
    const newsItems = await collection.find({}).toArray();
    
    // Count total news items
    const count = newsItems.length;
    console.log(`Total news items: ${count}`);
    
    if (count === 0) {
      console.log('No news items found in database.');
      return;
    }
    
    // Count keywords
    let totalKeywords = 0;
    let itemsWithKeywords = 0;
    
    newsItems.forEach(item => {
      if (item.keywords && Array.isArray(item.keywords)) {
        totalKeywords += item.keywords.length;
        if (item.keywords.length > 0) {
          itemsWithKeywords++;
        }
      }
    });
    
    console.log(`Items with keywords: ${itemsWithKeywords}/${count} (${Math.round(itemsWithKeywords/count*100)}%)`);
    console.log(`Total keywords across all items: ${totalKeywords}`);
    console.log(`Average keywords per item: ${Math.round(totalKeywords/count * 10) / 10}`);
    
    // Generate tag cloud data
    console.log('\nGenerating tag cloud...');
    const tagCloud = aggregateKeywordsForCloud(newsItems);
    
    console.log(`\nTag cloud statistics:`);
    console.log(`Total unique keywords in cloud: ${tagCloud.length}`);
    
    // Count by bias
    const biasCounts = {};
    tagCloud.forEach(item => {
      if (!biasCounts[item.bias]) {
        biasCounts[item.bias] = 0;
      }
      biasCounts[item.bias]++;
    });
    
    console.log('\nKeywords by bias:');
    Object.entries(biasCounts).forEach(([bias, count]) => {
      console.log(`- ${bias}: ${count} (${Math.round(count/tagCloud.length*100)}%)`);
    });
    
    // Show sample of keywords
    console.log('\nSample of keywords (first 20):');
    tagCloud.slice(0, 20).forEach(item => {
      console.log(`- "${item.text}" (value: ${item.value}, bias: ${item.bias})`);
    });
    
  } catch (error) {
    console.error('Error checking tag cloud:', error);
  } finally {
    // Close connection
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkTagCloud();
