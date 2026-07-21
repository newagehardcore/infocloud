/**
 * Source CRUD, backed by MySQL (src/db/sourceRepo.js) instead of Mongoose.
 * No Miniflux involved on this branch - sources are polled directly by
 * rssService.js, so adding/updating/deleting a source here is purely a
 * database operation with no external feed-registration step.
 */
const sourceRepo = require('../db/sourceRepo');
const newsItemRepo = require('../db/newsItemRepo');
const { NewsCategory } = require('../types');
const { BIAS_CATEGORIES, SOURCE_TYPES } = require('../utils/constants');

async function getAllSources() {
  return sourceRepo.getAllSources();
}

async function getSourceById(uuid) {
  return sourceRepo.getSourceByUuid(uuid);
}

async function addSource(newSourceData) {
  const { url, name, category, bias, alternateUrl, type } = newSourceData;
  if (!url || !name || !category || !bias) {
    throw new Error('Missing required fields for new source (url, name, category, bias).');
  }
  const existing = await sourceRepo.getSourceByUrl(url);
  if (existing) {
    throw new Error(`Source with URL ${url} already exists.`);
  }
  return sourceRepo.addSource({ url, name, category, bias, alternateUrl, type });
}

async function updateSource(uuid, updatedData) {
  const original = await sourceRepo.getSourceByUuid(uuid);
  if (!original) {
    throw new Error(`Source with UUID ${uuid} not found.`);
  }
  const updated = await sourceRepo.updateSource(uuid, updatedData);

  // bias/category are denormalized onto news_items for query performance
  // (see db/newsItemRepo.js) - propagate changes so existing articles reflect
  // the new values immediately. type isn't denormalized, so no propagation
  // needed there: every query joins sources live.
  const propagate = {};
  if (updatedData.bias !== undefined) propagate.bias = updatedData.bias.toUpperCase();
  if (updatedData.category !== undefined) propagate.category = updatedData.category.toUpperCase();
  if (Object.keys(propagate).length > 0) {
    await newsItemRepo.propagateSourceFieldChange(original._dbId, propagate);
  }

  return updated;
}

async function deleteSource(uuid) {
  const deletedCount = await sourceRepo.deleteSource(uuid);
  return { id: uuid, deletedCount };
}

async function getUniqueSourceCategories() {
  return sourceRepo.getUniqueSourceCategories();
}

async function exportAllSources() {
  return sourceRepo.exportAllSources();
}

async function _processSingleImportedSource(sourceData) {
  const { url, name, category, bias, alternateUrl, type } = sourceData;

  if (!url || !name || !category || !bias) {
    return { success: false, message: `Skipped: Missing required fields (url, name, category, bias) for source '${name || url}'.` };
  }
  if (!Object.values(NewsCategory).includes(category.toUpperCase())) {
    return { success: false, message: `Skipped: Invalid category '${category}' for source '${name}'.` };
  }
  if (!BIAS_CATEGORIES.includes(bias.toUpperCase())) {
    return { success: false, message: `Skipped: Invalid bias '${bias}' for source '${name}'.` };
  }
  if (type && !SOURCE_TYPES.includes(type.toUpperCase())) {
    return { success: false, message: `Skipped: Invalid type '${type}' for source '${name}'.` };
  }

  const existing = await sourceRepo.getSourceByUrl(url);
  if (existing) {
    return { success: false, message: `Skipped: Source with URL ${url} already exists in local DB (Name: ${existing.name}).` };
  }

  try {
    await sourceRepo.addSource({ url, name, category, bias, alternateUrl, type });
    return { success: true, message: `Imported source '${name}'.` };
  } catch (error) {
    return { success: false, message: `Error importing '${name}': ${error.message}` };
  }
}

async function importSources(sourcesToImport) {
  if (!Array.isArray(sourcesToImport)) {
    throw new Error('Invalid input: Expected an array of sources.');
  }
  const results = { added: 0, skipped: 0, errors: 0, details: [] };
  for (const sourceData of sourcesToImport) {
    const result = await _processSingleImportedSource(sourceData);
    results.details.push({ name: sourceData.name || sourceData.url, status: result.success ? 'Imported' : 'Skipped/Error', message: result.message });
    if (result.success) results.added++;
    else if (result.message.startsWith('Skipped:')) results.skipped++;
    else results.errors++;
  }
  return results;
}

async function purgeAllSources() {
  try {
    const dbDeletedCount = await sourceRepo.deleteAllSources();
    return { success: true, message: `Purge complete. ${dbDeletedCount} sources deleted.`, dbDeletedCount };
  } catch (error) {
    return { success: false, message: `Critical error during purge: ${error.message}` };
  }
}

module.exports = {
  getAllSources,
  getSourceById,
  addSource,
  updateSource,
  deleteSource,
  getUniqueSourceCategories,
  exportAllSources,
  importSources,
  purgeAllSources
};
