/**
 * Consolidated ingestion tick, replacing node-cron's in-process scheduling.
 *
 * GoDaddy Node hosting doesn't document background-job/cron support, so
 * instead of trusting an in-process timer to keep firing across process
 * restarts/recycles, an external service (e.g. cron-job.org, free) hits
 * POST /api/internal/tick every ~2 minutes. One tick does one bounded round
 * of: poll a rotation of due RSS sources, LLM-label a batch of unprocessed
 * articles, rebuild the keyword cache, and sweep old rows.
 *
 * Kept intentionally simple (sequential, no queue library) since a single
 * tick must stay well inside whatever request-timeout the platform imposes.
 */
const rssService = require('./services/rssService');
const newsItemRepo = require('./db/newsItemRepo');
const { processArticleWithRetry } = require('./services/llmService');
const { processNewsKeywords, aggregateKeywordsForCloud } = require('./services/wordProcessingService');

const SOURCES_PER_TICK = parseInt(process.env.SOURCES_PER_TICK || '30', 10);
const ARTICLES_PER_TICK = parseInt(process.env.ARTICLES_PER_TICK || '40', 10);
const MAX_AGE_DAYS = parseInt(process.env.NEWS_ITEM_MAX_AGE_DAYS || '14', 10);

let suspended = false;
let running = false;

function suspendTicks() { suspended = true; }
function resumeTicks() { suspended = false; }

async function runTick() {
  if (suspended) {
    return { skipped: true, reason: 'suspended' };
  }
  if (running) {
    return { skipped: true, reason: 'already running' };
  }
  running = true;
  const startedAt = Date.now();
  const summary = {};

  try {
    try {
      summary.rss = await rssService.pollDueSources(SOURCES_PER_TICK);
    } catch (error) {
      console.error('[Tick] RSS poll step failed:', error.message);
      summary.rss = { error: error.message };
    }

    try {
      const unprocessed = await newsItemRepo.findUnprocessed(ARTICLES_PER_TICK);
      const processed = await processNewsKeywords(unprocessed);
      const successful = processed.filter(item => item && item.llmProcessed);
      if (successful.length > 0) {
        await newsItemRepo.markProcessedBatch(successful);
      }
      summary.llm = { queued: unprocessed.length, labeled: successful.length };
    } catch (error) {
      console.error('[Tick] LLM labeling step failed:', error.message);
      summary.llm = { error: error.message };
    }

    try {
      await aggregateKeywordsForCloud();
      summary.cacheRebuilt = true;
    } catch (error) {
      console.error('[Tick] Cache rebuild step failed:', error.message);
      summary.cacheRebuilt = false;
    }

    try {
      summary.cleanedUp = await newsItemRepo.cleanupOldItems(MAX_AGE_DAYS);
    } catch (error) {
      console.error('[Tick] Cleanup step failed:', error.message);
    }

    summary.durationMs = Date.now() - startedAt;
    console.log(`[Tick] Completed in ${summary.durationMs}ms:`, JSON.stringify(summary));
    return summary;
  } finally {
    running = false;
  }
}

module.exports = { runTick, suspendTicks, resumeTicks };
