/**
 * In-place relabel of recently published, already-processed articles.
 *
 * Re-runs the LLM (current prompt/model) over articles in the keyword-cache
 * window and updates keywords/bias/category WITHOUT flipping llmProcessed,
 * so the tag cloud never goes blank — labels just improve as batches land.
 *
 * Run with: node src/scripts/relabel-recent.js [hours]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const NewsItem = require('../models/NewsItem');
const { processNewsKeywords } = require('../services/wordProcessingService');

const WINDOW_HOURS = parseInt(process.argv[2] || process.env.CACHE_WINDOW_HOURS || '72', 10);
const BATCH_SIZE = 20;

async function main() {
  await connectDB();
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);

  const articles = await NewsItem.find({
    llmProcessed: true,
    publishedAt: { $gte: cutoff }
  })
    .select('title contentSnippet url minifluxEntryId llmProcessingAttempts _id source bias publishedAt')
    .sort({ publishedAt: -1 })
    .lean();

  console.log(`[Relabel] ${articles.length} processed articles in the last ${WINDOW_HOURS}h to relabel.`);

  let done = 0;
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    try {
      const results = await processNewsKeywords(batch);
      const ops = results
        .filter(r => r && r.minifluxEntryId && r.llmProcessed)
        .map(r => ({
          updateOne: {
            filter: { minifluxEntryId: r.minifluxEntryId },
            update: {
              $set: {
                keywords: r.keywords,
                bias: r.bias,
                category: r.category || null,
                processedAt: r.processedAt || new Date()
              }
            }
          }
        }));
      if (ops.length > 0) await NewsItem.bulkWrite(ops, { ordered: false });
      done += batch.length;
      if (done % 200 < BATCH_SIZE) console.log(`[Relabel] ${done}/${articles.length} done.`);
    } catch (err) {
      console.error(`[Relabel] Batch ${i / BATCH_SIZE} failed:`, err.message);
    }
  }

  console.log(`[Relabel] Finished: ${done}/${articles.length}.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
