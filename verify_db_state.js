const mongoose = require('mongoose');
const NewsItem = require('./src/models/NewsItem');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://superadmin:supersecret@localhost:27017/infocloud?authSource=admin';

async function checkDb() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected.');

        const count = await NewsItem.countDocuments({});
        console.log(`Total NewsItems in DB: ${count}`);

        if (count > 0) {
            const sample = await NewsItem.findOne({}).sort({ _id: -1 });
            console.log('Latest Item:', sample.title, 'Created:', sample.publishedAt);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDb();
