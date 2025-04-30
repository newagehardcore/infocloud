const cron = require('node-cron');
const { fetchAllRssNews } = require('./services/rssService');

// Define the main fetching task
const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting feed fetch task...');
  const startTime = Date.now();

  try {
    // Fetch RSS feeds
    await fetchAllRssNews();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nCron Job: Finished feed fetch task in ${duration.toFixed(2)} seconds.`);

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`Cron Job: Error during feed fetch task after ${duration.toFixed(2)} seconds:`, error);
  }
  console.log('--------------------\n');
};

// Schedule the task to run every 30 minutes
// Syntax: second minute hour day-of-month month day-of-week
// '*/30 * * * *' means "at every 30th minute"
const scheduleFeedFetching = () => {
  console.log('Scheduling feed fetching cron job (every 30 minutes).');
  cron.schedule('*/30 * * * *', () => {
    fetchAllSources();
  }, {
    scheduled: true,
    timezone: "America/New_York" // Optional: Set timezone
  });

  // Optional: Run once immediately on startup
  console.log('Running initial feed fetch on startup...');
  fetchAllSources();
};

module.exports = { scheduleFeedFetching };
