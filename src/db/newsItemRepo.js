const { getPool } = require('./mysql');

// Reshapes a joined news_items+sources row into the same shape the rest of
// the codebase already expects from Mongoose .lean() docs: an embedded
// `source` object, and `_id`/`minifluxEntryId` aliased to the numeric MySQL
// id so wordProcessingService.js's existing Mongo-doc-shaped logic (which
// checks item._id, item.source.category, etc.) needs no changes.
function rowToItem(row) {
  if (!row) return null;
  let keywords = row.keywords;
  if (typeof keywords === 'string') {
    try { keywords = JSON.parse(keywords); } catch (e) { keywords = []; }
  }
  return {
    _id: row.id,
    minifluxEntryId: String(row.id), // legacy alias, no real Miniflux involved
    id: row.id,
    title: row.title,
    url: row.url,
    contentSnippet: row.content_snippet,
    publishedAt: row.published_at,
    source: {
      name: row.source_name,
      category: row.source_category,
      bias: row.source_bias,
      type: row.source_type
    },
    source_id: row.source_id,
    keywords: Array.isArray(keywords) ? keywords : [],
    bias: row.bias,
    llmBias: row.llm_bias,
    category: row.category,
    llmProcessed: !!row.llm_processed,
    llmProcessingError: row.llm_processing_error,
    llmProcessingAttempts: row.llm_processing_attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const SELECT_WITH_SOURCE = `
  SELECT n.*, s.name AS source_name, s.category AS source_category,
         s.bias AS source_bias, s.type AS source_type
  FROM news_items n
  JOIN sources s ON s.id = n.source_id
`;

async function findRecentProcessedItems(cutoffDate) {
  const [rows] = await getPool().query(
    `${SELECT_WITH_SOURCE} WHERE n.llm_processed = 1 AND n.published_at >= ?`,
    [cutoffDate]
  );
  return rows.map(rowToItem);
}

// Main GET /api/news query: recent, processed, optional category (with
// source-category fallback when the article has no per-article category),
// filtered to one bias, newest first, capped.
async function findByBiasAndCategory(bias, category, cutoffDate, limit) {
  const params = [cutoffDate, bias];
  let categoryClause = '';
  if (category) {
    categoryClause = 'AND (n.category = ? OR (n.category IS NULL AND s.category = ?))';
    params.push(category, category);
  }
  const [rows] = await getPool().query(
    `${SELECT_WITH_SOURCE}
     WHERE n.llm_processed = 1 AND n.published_at >= ? AND n.bias = ? ${categoryClause}
     ORDER BY n.published_at DESC
     LIMIT ?`,
    [...params, limit]
  );
  return rows.map(rowToItem);
}

async function findByTag({ tag, category, requireProcessed, limit = 100 }) {
  const params = [];
  let categoryClause = '';
  if (category) {
    categoryClause = 'AND (n.category = ? OR (n.category IS NULL AND s.category = ?))';
  }
  const processedClause = requireProcessed ? 'AND n.llm_processed = 1' : '';

  // 1. exact keyword match within category
  let sql = `${SELECT_WITH_SOURCE} WHERE JSON_CONTAINS(n.keywords, JSON_QUOTE(?)) ${processedClause} ${categoryClause}
             ORDER BY n.published_at DESC LIMIT ?`;
  params.push(tag);
  if (category) params.push(category, category);
  params.push(limit);
  let [rows] = await getPool().query(sql, params);
  if (rows.length > 0) return rows.map(rowToItem);

  // 2. case-insensitive keyword match within category (JSON_CONTAINS is
  // case-sensitive on typical utf8mb4 collations, so scan + filter in JS
  // for the rare-case mismatch rather than a fragile per-element LOWER() query)
  params.length = 0;
  sql = `${SELECT_WITH_SOURCE} WHERE ${processedClause ? '1=1 ' + processedClause : '1=1'} ${categoryClause} ORDER BY n.published_at DESC LIMIT 500`;
  if (category) params.push(category, category);
  [rows] = await getPool().query(sql, params);
  const lowerTag = tag.toLowerCase();
  let matched = rows.filter(r => {
    const kws = (typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords) || [];
    return kws.some(k => String(k).toLowerCase() === lowerTag);
  });
  if (matched.length > 0) return matched.slice(0, limit).map(rowToItem);

  // 3. tag text appearing in the title, within category
  params.length = 0;
  sql = `${SELECT_WITH_SOURCE} WHERE n.title LIKE ? ${categoryClause}
         ORDER BY n.published_at DESC LIMIT ?`;
  params.push(`%${tag}%`);
  if (category) params.push(category, category);
  params.push(limit);
  [rows] = await getPool().query(sql, params);
  if (rows.length > 0) return rows.map(rowToItem);

  // 4. last resort: same lookups without the category restriction
  if (category) {
    params.length = 0;
    sql = `${SELECT_WITH_SOURCE} WHERE JSON_CONTAINS(n.keywords, JSON_QUOTE(?)) ${processedClause}
           ORDER BY n.published_at DESC LIMIT ?`;
    [rows] = await getPool().query(sql, [tag, limit]);
    if (rows.length > 0) return rows.map(rowToItem);

    params.length = 0;
    sql = `${SELECT_WITH_SOURCE} WHERE n.title LIKE ? ORDER BY n.published_at DESC LIMIT ?`;
    [rows] = await getPool().query(sql, [`%${tag}%`, limit]);
    if (rows.length > 0) return rows.map(rowToItem);
  }

  return [];
}

async function findById(id) {
  const [rows] = await getPool().query(`${SELECT_WITH_SOURCE} WHERE n.id = ? LIMIT 1`, [id]);
  return rowToItem(rows[0]);
}

async function findExistingUrls(urls) {
  if (urls.length === 0) return new Set();
  const [rows] = await getPool().query(
    `SELECT url FROM news_items WHERE url IN (${urls.map(() => '?').join(',')})`,
    urls
  );
  return new Set(rows.map(r => r.url));
}

// Bulk insert new (not-yet-seen) items from an RSS poll. Ignores rows whose
// url already exists (INSERT IGNORE + unique key on url) - the ingestion
// layer should still pre-filter via findExistingUrls to avoid wasted rows,
// but this stays idempotent regardless.
async function insertNewItems(items) {
  if (items.length === 0) return 0;
  const pool = getPool();
  let inserted = 0;
  for (const item of items) {
    const [result] = await pool.query(
      `INSERT IGNORE INTO news_items
        (url, title, content_snippet, published_at, source_id, keywords, bias)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.url, item.title, item.contentSnippet || '', item.publishedAt, item.sourceDbId, JSON.stringify(item.keywords || []), item.bias || 'Unknown']
    );
    inserted += result.affectedRows;
  }
  return inserted;
}

// How many candidate unprocessed rows to pull before round-robining, per
// findUnprocessed call below. Generous relative to a typical `limit`
// (ARTICLES_PER_TICK) so every bias/source bucket has real material to
// round-robin over, not just whatever a single high-frequency source
// dumped in the last few minutes.
const UNPROCESSED_CANDIDATE_MULTIPLIER = 50;
const UNPROCESSED_CANDIDATE_MIN = 2000;

async function findUnprocessed(limit) {
  // With 278+ sources feeding ingestion far faster than the Groq-rate-limited
  // labeling throughput can drain, a plain "newest published first" query
  // (the previous approach) always hands the whole batch to whichever bias
  // happens to have the most high-frequency publishers - a handful of
  // wire-service-style Corporate/Centrist feeds constantly have something
  // newer than a low-volume outlet like Democracy Now, so the low-volume
  // outlet's articles get bumped every single tick and eventually age out of
  // news_items entirely (via cleanupOldItems) without ever being labeled.
  //
  // Fix: round-robin the labeling budget two levels deep - across bias
  // buckets first (so every bias gets a fair turn regardless of how many
  // sources or articles it has backlogged), then across sources within that
  // bias (so one prolific source can't eat its own bias's whole share).
  // Recency is still what's picked at the leaf (each source's newest
  // unprocessed item), so freshness is preserved for whatever gets chosen -
  // it's no longer the only axis that decides who gets chosen at all.
  // Entirely stateless: recomputed from the current backlog snapshot every
  // call, no new columns/schema needed.
  const candidatePoolSize = Math.max(limit * UNPROCESSED_CANDIDATE_MULTIPLIER, UNPROCESSED_CANDIDATE_MIN);
  const [rows] = await getPool().query(
    `${SELECT_WITH_SOURCE} WHERE n.llm_processed = 0 ORDER BY n.published_at DESC LIMIT ?`,
    [candidatePoolSize]
  );
  const items = rows.map(rowToItem);

  // bias -> source_id -> queue of items, newest-first (already ordered by
  // the query above, so no re-sort needed within a queue).
  const byBias = new Map();
  for (const item of items) {
    const bias = item.bias || 'Unknown';
    if (!byBias.has(bias)) byBias.set(bias, new Map());
    const bySource = byBias.get(bias);
    if (!bySource.has(item.source_id)) bySource.set(item.source_id, []);
    bySource.get(item.source_id).push(item);
  }

  // Fixed cycle order so no bias is structurally favored just by insertion
  // order into the Map; a bias with nothing backlogged is simply absent.
  const BIAS_CYCLE_ORDER = ['Left', 'Liberal', 'Centrist', 'Conservative', 'Right', 'Unknown'];
  const activeBiases = BIAS_CYCLE_ORDER.filter(b => byBias.has(b));
  // Per bias, a rotating list of its source ids - shift the front off, pick
  // one item from it, push it back to the end if it still has items left.
  const sourceRotation = new Map(activeBiases.map(bias => [bias, Array.from(byBias.get(bias).keys())]));

  const selected = [];
  let madeProgressThisPass = true;
  while (selected.length < limit && madeProgressThisPass) {
    madeProgressThisPass = false;
    for (const bias of activeBiases) {
      if (selected.length >= limit) break;
      const sources = sourceRotation.get(bias);
      if (sources.length === 0) continue;
      const sourceId = sources.shift();
      const queue = byBias.get(bias).get(sourceId);
      const next = queue.shift();
      if (next) {
        selected.push(next);
        madeProgressThisPass = true;
      }
      if (queue.length > 0) sources.push(sourceId);
    }
  }

  return selected;
}

// Applies LLM results back onto a batch of items (keywords, blended bias, category, llmProcessed=true)
async function markProcessedBatch(results) {
  const pool = getPool();
  for (const r of results) {
    await pool.query(
      `UPDATE news_items
       SET keywords = ?, bias = ?, llm_bias = ?, category = ?, llm_processed = 1,
           llm_processing_attempts = llm_processing_attempts + 1
       WHERE id = ?`,
      [JSON.stringify(r.keywords || []), r.bias, r.llmBias || null, r.category || null, r._id]
    );
  }
}

async function countAll() {
  const [rows] = await getPool().query('SELECT COUNT(*) AS c FROM news_items');
  return rows[0].c;
}

async function countProcessed() {
  const [rows] = await getPool().query('SELECT COUNT(*) AS c FROM news_items WHERE llm_processed = 1');
  return rows[0].c;
}

async function deleteAllNewsItems() {
  const [result] = await getPool().query('DELETE FROM news_items');
  return result.affectedRows;
}

// TTL-index replacement: MySQL has no native document expiry.
async function cleanupOldItems(maxAgeDays) {
  const [result] = await getPool().query(
    'DELETE FROM news_items WHERE created_at < (NOW() - INTERVAL ? DAY)',
    [maxAgeDays]
  );
  return result.affectedRows;
}

// Puts already-labeled items back in the queue without touching anything
// else (source bias/category, keywords already extracted, etc.) - for
// re-running them through processing after a labeling-logic fix. Cheap in
// practice: llmService's per-article cache is keyed by content hash, so
// anything processed within its 24h TTL is relabeled from cache, not a
// fresh LLM call.
async function resetProcessedFlags() {
  const [result] = await getPool().query(
    'UPDATE news_items SET llm_processed = 0 WHERE llm_processed = 1'
  );
  return result.affectedRows;
}

// Raw rows for the admin stats endpoints, which tally in JS (data volume is
// modest - a few thousand rows - so this is simpler and safer than trying to
// replicate Mongo's $unwind/$facet aggregation pipeline in SQL).
async function findAllProcessedWithKeywords() {
  const [rows] = await getPool().query(
    `SELECT n.keywords, n.bias, n.category, s.category AS source_category
     FROM news_items n JOIN sources s ON s.id = n.source_id
     WHERE n.llm_processed = 1 AND JSON_LENGTH(n.keywords) > 0`
  );
  return rows.map(r => ({
    keywords: typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords,
    bias: r.bias,
    category: r.category || r.source_category || 'Unknown Category'
  }));
}

async function biasStats() {
  const [rows] = await getPool().query('SELECT bias, COUNT(*) AS count FROM news_items GROUP BY bias');
  return rows;
}

async function categoryStats() {
  const [rows] = await getPool().query('SELECT category, COUNT(*) AS count FROM news_items WHERE category IS NOT NULL GROUP BY category');
  return rows;
}

async function propagateSourceFieldChange(sourceDbId, fields) {
  const sets = [];
  const values = [];
  if (fields.bias !== undefined) { sets.push('bias = ?'); values.push(fields.bias); }
  if (fields.category !== undefined) { sets.push('category = ?'); values.push(fields.category); }
  if (sets.length === 0) return 0;
  values.push(sourceDbId);
  const [result] = await getPool().query(
    `UPDATE news_items SET ${sets.join(', ')} WHERE source_id = ?`,
    values
  );
  return result.affectedRows;
}

module.exports = {
  findRecentProcessedItems,
  findByBiasAndCategory,
  findByTag,
  findById,
  findAllProcessedWithKeywords,
  findExistingUrls,
  insertNewItems,
  findUnprocessed,
  markProcessedBatch,
  countAll,
  countProcessed,
  deleteAllNewsItems,
  cleanupOldItems,
  resetProcessedFlags,
  biasStats,
  categoryStats,
  propagateSourceFieldChange
};
