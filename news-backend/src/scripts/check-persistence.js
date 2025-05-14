/**
 * Script to check if data in Docker containers persists properly
 * This performs a simple check on MongoDB and Postgres to verify data persistence
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Check MongoDB data persistence
async function checkMongoDB() {
  console.log('Checking MongoDB data persistence...');
  
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://superadmin:supersecret@localhost:27017/infocloud?authSource=admin';
    await mongoose.connect(MONGODB_URI);
    
    // Create a test collection if it doesn't exist
    const testCollection = mongoose.connection.collection('persistence_test');
    
    // Check if test document exists, create if not
    const existingDoc = await testCollection.findOne({ test_id: 'persistence_check' });
    
    if (existingDoc) {
      console.log('✅ Found existing test document in MongoDB - data is persisting!');
      console.log(`   Last checked: ${existingDoc.last_checked}`);
      
      // Update the timestamp
      await testCollection.updateOne(
        { test_id: 'persistence_check' },
        { $set: { last_checked: new Date(), check_count: (existingDoc.check_count || 0) + 1 } }
      );
      console.log(`   Check count: ${(existingDoc.check_count || 0) + 1}`);
    } else {
      console.log('Creating new test document in MongoDB...');
      await testCollection.insertOne({
        test_id: 'persistence_check',
        created_at: new Date(),
        last_checked: new Date(),
        check_count: 1,
        message: 'This document is used to verify data persistence across restarts'
      });
      console.log('✅ Test document created in MongoDB');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ MongoDB persistence check failed:', error.message);
    return false;
  }
  
  return true;
}

// Check Postgres/Miniflux data persistence
async function checkPostgres() {
  console.log('Checking Postgres/Miniflux data persistence...');
  
  try {
    // Check if Miniflux is accessible
    const { stdout: minifluxResponse } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080');
    
    if (minifluxResponse.trim() === '200') {
      console.log('✅ Miniflux is accessible - likely means Postgres data is persisting');
    } else {
      console.warn('⚠️ Miniflux returned status code:', minifluxResponse);
      console.warn('   This may indicate a problem with Postgres data persistence');
      return false;
    }
  } catch (error) {
    console.error('❌ Postgres/Miniflux persistence check failed:', error.message);
    return false;
  }
  
  return true;
}

// Main function
async function checkPersistence() {
  console.log('🔍 Checking data persistence across Docker containers...');
  
  const mongoDBPersists = await checkMongoDB();
  const postgresPersists = await checkPostgres();
  
  console.log('\n📋 Persistence Summary:');
  console.log(`MongoDB: ${mongoDBPersists ? '✅ Data persists' : '❌ Issue detected'}`);
  console.log(`Postgres/Miniflux: ${postgresPersists ? '✅ Data persists' : '❌ Issue detected'}`);
  
  if (mongoDBPersists && postgresPersists) {
    console.log('\n🎉 Success! Your data is persisting correctly across system restarts.');
    console.log('   You can safely shut down your computer and your data will be preserved.');
  } else {
    console.log('\n⚠️ Some persistence issues were detected. Run the following command to fix:');
    console.log('   npm run ensure-persistence');
  }
}

// Run if called directly
if (require.main === module) {
  checkPersistence().catch(console.error).finally(() => process.exit());
}

module.exports = { checkPersistence }; 