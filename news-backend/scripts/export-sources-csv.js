/**
 * Script to export all sources with their categorization to a CSV file
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Fetch all sources
 * 3. Generate a CSV file with source information
 * 
 * Run with: node scripts/export-sources-csv.js
 */

const mongoose = require('mongoose');
require('../src/models/Source');
const { connectDB } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function exportSourcesCsv() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    const Source = mongoose.model('Source');
    
    console.log('Fetching all sources from database...');
    const sources = await Source.find().sort({ name: 1 });
    console.log(`Fetched ${sources.length} sources from database.`);
    
    // Generate CSV content
    const csvHeader = 'Name,Category,Bias,Type,URL\n';
    const csvRows = sources.map(source => 
      `"${source.name}","${source.category}","${source.bias}","${source.type}","${source.url}"`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Write CSV file
    const csvPath = path.join(__dirname, '../sources_categorization.csv');
    fs.writeFileSync(csvPath, csvContent);
    
    console.log(`\nExported ${sources.length} sources to: ${csvPath}`);
    
    // Generate a summary report
    console.log('\nSOURCE CATEGORIZATION SUMMARY:\n');
    
    // Distribution by Type
    const typeDistribution = {};
    sources.forEach(source => {
      typeDistribution[source.type] = (typeDistribution[source.type] || 0) + 1;
    });
    
    console.log('Distribution by Type:');
    Object.entries(typeDistribution).sort().forEach(([type, count]) => {
      console.log(`${type}: ${count} (${(count/sources.length*100).toFixed(1)}%)`);
    });
    
    // Distribution by Bias
    const biasDistribution = {};
    sources.forEach(source => {
      biasDistribution[source.bias] = (biasDistribution[source.bias] || 0) + 1;
    });
    
    console.log('\nDistribution by Bias:');
    Object.entries(biasDistribution).sort().forEach(([bias, count]) => {
      console.log(`${bias}: ${count} (${(count/sources.length*100).toFixed(1)}%)`);
    });
    
    // Distribution by Category
    const categoryDistribution = {};
    sources.forEach(source => {
      categoryDistribution[source.category] = (categoryDistribution[source.category] || 0) + 1;
    });
    
    console.log('\nDistribution by Category:');
    Object.entries(categoryDistribution).sort().forEach(([category, count]) => {
      console.log(`${category}: ${count} (${(count/sources.length*100).toFixed(1)}%)`);
    });
    
    // Distribution by Bias and Type
    const biasTypeDistribution = {};
    sources.forEach(source => {
      const key = `${source.bias}-${source.type}`;
      biasTypeDistribution[key] = (biasTypeDistribution[key] || 0) + 1;
    });
    
    console.log('\nDistribution by Bias and Type:');
    Object.entries(biasTypeDistribution).sort().forEach(([key, count]) => {
      const [bias, type] = key.split('-');
      console.log(`${bias} + ${type}: ${count} (${(count/sources.length*100).toFixed(1)}%)`);
    });
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
exportSourcesCsv(); 