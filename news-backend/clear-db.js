require('dotenv').config({ path: require('path').resolve(__dirname, '.env') }); // Ensure .env is loaded
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;
const COLLECTION_NAME = 'newsitems'; // Hardcoded collection name

async function clearDatabase() {
  if (!MONGODB_URI || !DB_NAME) {
    console.error('Error: MONGODB_URI and DB_NAME must be set in the .env file.');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB...');
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Check if collection exists before trying to drop
    const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray();
    if (collections.length > 0) {
      console.log(`Dropping collection: ${COLLECTION_NAME}...`);
      await collection.drop();
      console.log(`Collection ${COLLECTION_NAME} dropped successfully.`);
    } else {
      console.log(`Collection ${COLLECTION_NAME} does not exist, skipping drop.`);
    }

  } catch (err) {
    console.error('Error clearing database:', err);
    process.exit(1); // Exit with error if drop fails
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

clearDatabase(); 