/**
 * Direct RSS/Atom polling, replacing Miniflux entirely (GoDaddy Node hosting
 * can't run a separate Go service + Postgres, and Miniflux itself was only
 * ever a middleman between the feeds and this service anyway).
 *
 * Sources are polled in rotation - least-recently-polled first, capped per
 * call - so a single tick can't run long even with ~280 feeds, since the
 * hosting platform's request-timeout behavior isn't documented.
 */
const Parser = require('rss-parser');
const he = require('he');
const sourceRepo = require('../db/sourceRepo');
const newsItemRepo = require('../db/newsItemRepo');
const { getPool } = require('../db/mysql');
const { PoliticalBias } = require('../types');
const { stripHtml } = require('../utils/textUtils');

const MAX_DESC_LENGTH = 500;
const FEED_TIMEOUT_MS = 10000;

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: { 'User-Agent': 'InfocloudBot/1.0 (+https://github.com/newagehardcore/infocloud)' }
});

function cleanContent(html) {
  if (!html) return '';
  let text = html.replace(/<[^>]*>?/gm, '');
  text = he.decode(text);
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > MAX_DESC_LENGTH ? text.slice(0, MAX_DESC_LENGTH) : text;
}

function getTitleCaseBias(uppercaseBias) {
  if (!uppercaseBias) return PoliticalBias.Unknown;
  const foundKey = Object.keys(PoliticalBias).find(key => key.toUpperCase() === uppercaseBias.toUpperCase());
  return foundKey ? PoliticalBias[foundKey] : PoliticalBias.Unknown;
}

function normalizeEntry(entry, source) {
  // Some Atom feeds (e.g. Jacobin) only carry <id>, no per-entry <link> -
  // when the id itself is a URL it's the article link in practice.
  const url = entry.link || (/^https?:\/\//.test(entry.id || '') ? entry.id : null);
  if (!url || !entry.title) return null;
  const publishedAt = entry.isoDate ? new Date(entry.isoDate) : (entry.pubDate ? new Date(entry.pubDate) : new Date());
  return {
    url,
    title: stripHtml(entry.title).trim(),
    contentSnippet: cleanContent(entry.contentSnippet || entry.content || entry.summary || ''),
    publishedAt,
    sourceDbId: source._dbId,
    bias: getTitleCaseBias(source.bias)
  };
}

async function pollSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || [])
      .map(entry => normalizeEntry(entry, source))
      .filter(Boolean);
    return items;
  } catch (error) {
    console.error(`[RSS Service] Failed to poll ${source.name} (${source.url}): ${error.message}`);
    return [];
  }
}

async function insertDedupedItems(items) {
  if (items.length === 0) return 0;
  const urls = items.map(i => i.url);
  const existingUrls = await newsItemRepo.findExistingUrls(urls);
  const seenInBatch = new Set();
  const toInsert = items.filter(item => {
    if (existingUrls.has(item.url) || seenInBatch.has(item.url)) return false;
    seenInBatch.add(item.url);
    return true;
  });
  return newsItemRepo.insertNewItems(toInsert);
}

/**
 * One rotation of the regular ingestion tick: poll the `batchSize`
 * least-recently-polled enabled sources, insert new items, mark them polled.
 */
async function pollDueSources(batchSize = 30) {
  const [rows] = await getPool().query(
    `SELECT id FROM sources WHERE enabled = 1 ORDER BY last_polled_at IS NOT NULL, last_polled_at ASC LIMIT ?`,
    [batchSize]
  );
  if (rows.length === 0) return { sourcesPolled: 0, itemsInserted: 0 };

  const sources = [];
  for (const row of rows) {
    sources.push(await sourceRepo.getSourceById(row.id));
  }

  let allItems = [];
  for (const source of sources) {
    const items = await pollSource(source);
    allItems = allItems.concat(items);
  }

  const inserted = await insertDedupedItems(allItems);

  const ids = sources.map(s => s._dbId);
  if (ids.length > 0) {
    await getPool().query(
      `UPDATE sources SET last_polled_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
  }

  console.log(`[RSS Service] Polled ${sources.length} sources, inserted ${inserted} new items.`);
  return { sourcesPolled: sources.length, itemsInserted: inserted };
}

/**
 * Full poll of every enabled source, ignoring rotation - used by the admin
 * panel's manual "force refresh" button, not the automated tick.
 */
async function forceRefreshAllFeeds() {
  const sources = await sourceRepo.getEnabledSources();
  let allItems = [];
  for (const source of sources) {
    const items = await pollSource(source);
    allItems = allItems.concat(items);
  }
  const inserted = await insertDedupedItems(allItems);
  console.log(`[RSS Service] Force-refreshed ${sources.length} sources, inserted ${inserted} new items.`);
  return { sourcesPolled: sources.length, itemsInserted: inserted };
}

module.exports = {
  pollDueSources,
  forceRefreshAllFeeds
};
