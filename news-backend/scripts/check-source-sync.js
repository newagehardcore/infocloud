const path = require('path');
// Adjust dotenv path to load from the backend root
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { loadSources, getMinifluxFeeds } = require('../src/services/sourceManagementService');

// Simple URL normalization (lowercase, remove http/https, www, trailing slash)
const normalizeUrl = (url) => {
  if (!url) return '';
  return url.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '');
};

async function checkSync() {
  console.log('Checking synchronization between Miniflux feeds and backend sources...');

  let backendSources = [];
  let minifluxFeeds = [];

  try {
    backendSources = await loadSources();
    console.log(`Loaded ${backendSources.length} sources from backend.`);
  } catch (error) {
    console.error('Error loading backend sources:', error.message);
    return; // Cannot proceed without backend sources
  }

  try {
    minifluxFeeds = await getMinifluxFeeds();
    console.log(`Fetched ${minifluxFeeds.length} feeds from Miniflux.`);
  } catch (error) {
    console.error('Error fetching Miniflux feeds:', error.message);
    // Proceed with comparison even if Miniflux fetch failed, will show all backend sources as extra
  }

  const backendUrls = new Set(backendSources.map(s => normalizeUrl(s.url)));
  const minifluxUrls = new Set(minifluxFeeds.map(f => normalizeUrl(f.url)));

  const onlyInMiniflux = minifluxFeeds.filter(f => !backendUrls.has(normalizeUrl(f.url)));
  const onlyInBackend = backendSources.filter(s => !minifluxUrls.has(normalizeUrl(s.url)));

  console.log('\n--- Synchronization Report ---');

  if (onlyInMiniflux.length > 0) {
    console.log(`\n🔴 Feeds found in Miniflux but MISSING from Backend (${onlyInMiniflux.length}):`);
    console.log('   (These need to be added using the Admin Page with correct Category/Bias)');
    onlyInMiniflux.forEach(f => console.log(`   - ${f.url} (Miniflux ID: ${f.id})`));
  } else {
    console.log('\n✅ All feeds in Miniflux are present in the backend configuration.');
  }

  if (onlyInBackend.length > 0) {
    console.log(`\n🟡 Sources found in Backend but MISSING from Miniflux (${onlyInBackend.length}):`);
    console.log('   (These should likely be DELETED using the Admin Page)');
    onlyInBackend.forEach(s => console.log(`   - ${s.url} (Backend Name: ${s.name}, ID: ${s.id})`));
  } else {
    console.log('\n✅ All sources in the backend configuration exist in Miniflux.');
  }

  console.log('\n--- End Report ---');
}

checkSync().catch(err => {
  console.error('Script failed:', err);
}); 