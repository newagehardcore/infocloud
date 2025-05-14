/*
Defines the intended structure for documents in the 'newsitems' collection.
This is not a Mongoose schema, but a reference for the data structure.
Validation should be handled in the service layer before database operations.

{
  id: String,         // Unique identifier for the news item (e.g., from source API or generated hash)
  title: String,        // Required: Headline of the news item
  description: String,  // Optional: A short summary or description
  url: String,          // Required: Direct URL to the original news article
  source: {
    name: String,     // Required: Name of the news source (e.g., "New York Times", "NewsAPI")
    bias: String      // Required: Political bias rating (e.g., "Left", "Center", "Right")
  },
  publishedAt: Date,    // Required: Original publication date/time
  category: String,     // Required: News category (e.g., "Politics", "Technology", "World")
  keywords: [String],   // Array of keywords extracted from the title/description
  topic: String,        // Optional: Main topic determined by LLM analysis
  sentiment: String,    // Optional: Sentiment score/label determined by LLM analysis
  createdAt: Date       // Timestamp when the item was added to our database (defaults to now)
}
*/

const mongoose = require('mongoose');
// Corrected import path for shared types
const { PoliticalBias, NewsCategory } = require('../types/index.js'); // Use shared enums
const { SOURCE_TYPES } = require('../utils/constants'); // Add this import

const SourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Source name is required.'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Source category is required.'],
    enum: Object.values(NewsCategory) // Use enum values for validation
  },
  bias: {
    type: String,
    required: [true, 'Source bias is required.'],
    enum: Object.values(PoliticalBias) // Use enum values for validation
  },
  type: {
    type: String,
    required: [true, 'Source type is required.'],
    enum: SOURCE_TYPES,
    default: 'UNKNOWN'
  },
  minifluxFeedId: {
    type: Number,
    required: false
  }
}, { _id: false }); // Prevent creation of an automatic _id for the subdocument

const NewsItemSchema = new mongoose.Schema({
  // Using minifluxEntryId as the primary unique identifier for upserts
  minifluxEntryId: {
    type: String,
    required: true,
    unique: true, // Ensure uniqueness based on miniflux entry ID
    index: true
  },
  minifluxFeedId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Article title is required.'],
    trim: true
  },
  url: {
    type: String,
    required: [true, 'Article URL is required.'],
    trim: true
  },
  // Storing a snippet, not the full description
  contentSnippet: {
    type: String,
    default: ''
  },
  publishedAt: {
    type: Date,
    required: [true, 'Publication date is required.'],
    index: true // Index for sorting/filtering
  },
  source: {
    type: SourceSchema, // Embed the source sub-schema
    required: true
  },
  // Keywords added by LLM
  keywords: {
    type: [String],
    default: []
  },
  // Bias determined by LLM
  bias: {
    type: String,
    enum: Object.values(PoliticalBias), // Validate against enum
    default: PoliticalBias.Unknown
  },
  // LLM Processing Status
  llmProcessed: {
    type: Boolean,
    default: false,
    index: true
  },
  llmProcessingError: {
    type: String,
    default: null
  },
  llmProcessingAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Automatically add createdAt and updatedAt timestamps
});

// Add TTL index to automatically delete old documents after, e.g., 14 days
NewsItemSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 }); 

// Add compound index for common queries (e.g., filtering by bias and category)
NewsItemSchema.index({ 'source.bias': 1, 'source.category': 1, publishedAt: -1 });

// Compile and export the model
// Mongoose will automatically look for the plural, lowercased version of your model name: "newsitems"
const NewsItem = mongoose.model('NewsItem', NewsItemSchema);

module.exports = NewsItem;
