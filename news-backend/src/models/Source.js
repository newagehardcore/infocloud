const mongoose = require('mongoose'); const { BIAS_CATEGORIES, NEWS_CATEGORIES } = require('../utils/constants'); // Assuming categories might also be defined
const sourceSchema = new mongoose.Schema({
    // We can use MongoDB's default _id, but keep our own uuid if it's used elsewhere
    // If not crucial, we could remove this uuid field later.
    uuid: { 
        type: String,
        required: true,
        unique: true,
        // default: () => require('uuid').v4() // Or generate here if not provided
    },
    url: { 
        type: String, 
        required: true, 
        trim: true,
        unique: true // Feed URLs should be unique
    },
    alternateUrl: { 
        type: String, 
        trim: true 
    },
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    category: { 
        type: String, 
        required: true, 
        uppercase: true, 
        trim: true,
        // Consider using enum if NEWS_CATEGORIES is comprehensive and stable
        // enum: NEWS_CATEGORIES 
    },
    bias: { 
        type: String, 
        required: true, 
        uppercase: true,
        enum: BIAS_CATEGORIES // Use enum for controlled vocabulary
    },
    minifluxFeedId: { 
        type: Number, // Miniflux IDs are numbers
        // No unique constraint here
    },
    // Add timestamps for tracking when sources are added/updated
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware to update the updatedAt field on save
sourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware to update the updatedAt field on findByIdAndUpdate (and similar)
// Needed because 'save' middleware doesn't run on updates
sourceSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Define indexes
sourceSchema.index({ name: 1 }); // Added index for name to improve query performance
// sourceSchema.index({ url: 1 }); // Removed, as unique:true on field handles it
sourceSchema.index({ category: 1 });
sourceSchema.index({ bias: 1 });
// Remove unique constraint on minifluxFeedId to allow multiple null values
sourceSchema.index({ minifluxFeedId: 1 }, { sparse: true }); // Only index documents where minifluxFeedId exists

const Source = mongoose.model('Source', sourceSchema);

module.exports = Source; 