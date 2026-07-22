# INFOCLOUD Miniflux Integration

This document explains how the INFOCLOUD RSS feed handling has been refactored to use Miniflux for improved reliability and performance. 

## Overview

The integration offloads RSS fetching to Miniflux while maintaining INFOCLOUD's dual classification system:
- **Topic/Category**: Stored in Miniflux as categories (one category per feed)
- **Bias**: Managed in the backend via a JSON mapping file

## Architecture

1. **Miniflux**: Self-hosted RSS aggregator running in Docker
   - Handles feed polling and parsing
   - Stores entries in PostgreSQL
   - Groups feeds by category/topic

2. **INFOCLOUD Backend**:
   - Fetches processed entries from Miniflux API
   - Enriches entries with bias information
   - Performs keyword extraction and content analysis
   - Serves data to the frontend

3. **Bias Mapping**:
   - Stored in `news-backend/data/feeds.json`
   - Maps feed URLs to their bias classification

## Setup and Configuration

### Running Miniflux

The Miniflux service runs in Docker containers. Make sure Docker is installed and then:

```bash
cd /Users/adr/Desktop/whatsgoingon/infocloud
docker-compose up -d
```

This will start:
- PostgreSQL database container
- Miniflux application container (accessible at http://localhost:8080)

Default credentials:
- Username: `admin`
- Password: `adminpass`

### Environment Configuration

The backend needs to know how to connect to Miniflux. Copy the sample environment file:

```bash
cd news-backend
cp .env.sample .env
```

Edit the `.env` file to include:
```
MINIFLUX_URL=http://localhost:8080
MINIFLUX_USERNAME=admin
MINIFLUX_PASSWORD=adminpass
```

## Managing Feeds

### Adding Feeds

There are multiple ways to add feeds:

1. **Via Scripted Import**:
   ```bash
   cd news-backend
   node src/miniflux/importAllFeeds.js
   ```
   This imports all feeds from the existing `rssService.js` file and maintains bias information.

2. **Via Miniflux Web Interface**:
   - Login to http://localhost:8080
   - Navigate to "Feeds" → "Add Feed"
   - Make sure to update `feeds.json` with bias information (see below)

3. **Via CLI Tool** (for adding individual feeds):
   ```bash
   cd news-backend
   node src/miniflux/simpleSetup.js
   ```

### Maintaining Bias Information

After adding feeds directly in Miniflux, you need to update the bias mapping:

1. Get the feed URL and ID from Miniflux (via the web interface)
2. Edit `news-backend/data/feeds.json` to add:
   ```json
   {
     "https://example.com/feed-url": {
       "bias": "Left|Liberal|Centrist|Conservative|Right|Unknown",
       "id": "feed-id-from-miniflux",
       "name": "Feed Name"
     }
   }
   ```

## Manual Operations

### Refreshing Feeds

To trigger a manual feed refresh:

```bash
cd news-backend
node src/miniflux/refreshFeeds.js
```

### Fetching Entries

To manually fetch and process new entries:

```bash
cd news-backend
node src/miniflux/fetchEntries.js
```

## Troubleshooting

### Feed Errors

If Miniflux can't fetch a feed, try:
1. Verify the feed URL works in a browser
2. Check if the feed requires authentication or has restrictions
3. Enable feed crawling in Miniflux settings (helps with some broken feeds)

### Connection Issues

If the backend can't connect to Miniflux:
1. Ensure the Docker containers are running: `docker ps`
2. Check Miniflux logs: `docker logs infocloud-miniflux-1`
3. Verify credentials in `.env` match the Miniflux configuration

## Technical Details

### Key Files

- `docker-compose.yml`: Configuration for Miniflux and PostgreSQL containers
- `news-backend/data/feeds.json`: Maps feed URLs to bias information
- `news-backend/src/miniflux/`:
  - `importAllFeeds.js`: Imports all feeds into Miniflux
  - `refreshFeeds.js`: Triggers feed refresh in Miniflux
  - `fetchEntries.js`: Gets entries from Miniflux and enriches with bias
- `news-backend/src/cron.js`: Schedule for automatic feed refreshing

### Miniflux API Documentation

For more advanced operations, refer to the [Miniflux API Documentation](https://miniflux.app/docs/api.html).
