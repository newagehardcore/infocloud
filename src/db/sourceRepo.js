const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./mysql');

function rowToSource(row) {
  if (!row) return null;
  return {
    id: row.uuid, // frontend uses uuid as 'id'
    _dbId: row.id, // internal numeric PK, used for FK joins - not sent to frontend
    uuid: row.uuid,
    url: row.url,
    alternateUrl: row.alternate_url,
    name: row.name,
    category: row.category,
    bias: row.bias,
    type: row.type,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getAllSources() {
  const [rows] = await getPool().query('SELECT * FROM sources ORDER BY name ASC');
  return rows.map(rowToSource);
}

async function getEnabledSources() {
  const [rows] = await getPool().query('SELECT * FROM sources WHERE enabled = 1 ORDER BY name ASC');
  return rows.map(rowToSource);
}

async function getSourceByUuid(uuid) {
  const [rows] = await getPool().query('SELECT * FROM sources WHERE uuid = ? LIMIT 1', [uuid]);
  return rowToSource(rows[0]);
}

async function getSourceById(dbId) {
  const [rows] = await getPool().query('SELECT * FROM sources WHERE id = ? LIMIT 1', [dbId]);
  return rowToSource(rows[0]);
}

async function getSourceByUrl(url) {
  const [rows] = await getPool().query('SELECT * FROM sources WHERE url = ? LIMIT 1', [url]);
  return rowToSource(rows[0]);
}

async function addSource({ url, name, category, bias, alternateUrl, type }) {
  const uuid = uuidv4();
  await getPool().query(
    `INSERT INTO sources (uuid, url, alternate_url, name, category, bias, type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid, url, alternateUrl || null, name, category.toUpperCase(), bias.toUpperCase(), (type || 'UNKNOWN').toUpperCase()]
  );
  return getSourceByUuid(uuid);
}

async function updateSource(uuid, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category.toUpperCase()); }
  if (updates.bias !== undefined) { fields.push('bias = ?'); values.push(updates.bias.toUpperCase()); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type.toUpperCase()); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (fields.length === 0) return getSourceByUuid(uuid);

  values.push(uuid);
  const [result] = await getPool().query(
    `UPDATE sources SET ${fields.join(', ')} WHERE uuid = ?`,
    values
  );
  if (result.affectedRows === 0) return null;
  return getSourceByUuid(uuid);
}

async function deleteSource(uuid) {
  const [result] = await getPool().query('DELETE FROM sources WHERE uuid = ?', [uuid]);
  return result.affectedRows;
}

async function deleteAllSources() {
  const [result] = await getPool().query('DELETE FROM sources');
  return result.affectedRows;
}

async function getUniqueSourceCategories() {
  const [rows] = await getPool().query('SELECT DISTINCT category FROM sources WHERE category IS NOT NULL AND category != "" ORDER BY category ASC');
  return rows.map(r => r.category);
}

async function exportAllSources() {
  const [rows] = await getPool().query('SELECT name, url, alternate_url AS alternateUrl, category, bias, type FROM sources ORDER BY name ASC');
  return rows;
}

module.exports = {
  getAllSources,
  getEnabledSources,
  getSourceByUuid,
  getSourceById,
  getSourceByUrl,
  addSource,
  updateSource,
  deleteSource,
  deleteAllSources,
  getUniqueSourceCategories,
  exportAllSources
};
