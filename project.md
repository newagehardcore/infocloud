# Project: News Aggregation App

## 1. Project Overview

This project is a full-stack news aggregation application designed to collect, analyze, and display news exclusively from various RSS feeds. The frontend, built with React, features a dynamic 3D tag cloud for exploring topics. The backend, using Node.js and Express, manages RSS feed retrieval, storage, keyword extraction/processing, and serves this processed data to the frontend via RESTful APIs.

**Technologies:**

*   **Frontend:** React, CSS
*   **Backend:** Node.js, Express
*   **Data:** JSON (from RSS feeds)
*   **APIs:** RSS Feeds

**Core Design:**

*   **Modular Backend:** Backend services handle specific tasks (e.g., `rssService`, `wordProcessingService`).
*   **Data-driven:** News data is the central element.
*   **Client-Server:** Clear separation between frontend and backend.

## 2. Directory Structure
```
├── CORS_SOLUTION.md          # Documentation for CORS handling
├── DEPLOYMENT.md            # Deployment instructions
├── README.md                # General project information
├── config-overrides.js      # Configuration overrides
├── debug.log                # Log file for debugging
├── package-lock.json        # Dependency lock file
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── news-backend/            # Backend application
│   ├── package-lock.json   # Backend dependency lock file
│   ├── package.json        # Backend dependencies and scripts
│   └── src/                # Backend source code
├── public/                  # Frontend static assets
│   └── fonts/              # Custom font files
└── src/                     # Frontend source code
    ├── components/          # Reusable UI components
    ├── contexts/            # React contexts for state management
    ├── services/            # Data fetching and processing services
    ├── types/               # TypeScript type definitions
    └── utils/               # Utility functions
```
**Conventions:**

*   `src/` holds all source code for each project component.
*   Component-specific styles are located next to component code files.

## 3. Key Components

### Frontend (`src/`)

*   **`components/`:**
    *   **`EditMenu.tsx`:** Provides UI controls to edit the state.
        *   **Purpose:** Manages UI controls for various app settings.
        *   **Location:** `src/components/EditMenu.tsx`
        *   **Key Functions:** Renders the configuration options.
        *   **Dependencies:** `FilterContext`
    *   **`Header.tsx`:** Top-level navigation and title bar.
        *   **Purpose:** Displays the main header section of the app.
        *   **Location:** `src/components/Header.tsx`
        *   **Key Functions:** Display title and navigation elements.
        *   **Dependencies:** None.
    *   **`NewsDetail.tsx`:** Detailed view of a news article.
        *   **Purpose:** Shows the content of a single news item.
        *   **Location:** `src/components/NewsDetail.tsx`
        *   **Key Functions:** `fetchNewsItem()`.
        *   **Dependencies:** `rssService`
    *   **`RelatedNewsPanel.tsx`:** Displays articles related to the main news item.
        *   **Purpose:** Lists related news.
        *   **Location:** `src/components/RelatedNewsPanel.tsx`
        *   **Key Functions:** `fetchRelatedNews()`.
        *   **Dependencies:** `rssService`
    *   **`TagCloud3DOptimized.tsx`:** 3D interactive tag cloud.
        *   **Purpose:** Visualizes news keywords as an interactive 3D tag cloud using pre-processed data from the backend.
        *   **Location:** `src/components/TagCloud3DOptimized.tsx`
        *   **Key Functions:** Renders words based on input props.
        *   **Dependencies:** Receives processed words via props.
    *   **`TimeControls.tsx`:** UI controls for time-based filtering.
        *   **Purpose:** Handles selection of time frames for news.
        *   **Location:** `src/components/TimeControls.tsx`
        *   **Key Functions:** `handleTimeChange()`
        *   **Dependencies:** `FilterContext`
*   **`contexts/FilterContext.tsx`:**
    *   **Purpose:** Manages application-wide filtering state.
    *   **Location:** `src/contexts/FilterContext.tsx`
    *   **Key Functions:** `setFilters()`, `getFilters()`.
    *   **Dependencies:** React Context API.
*   **`services/`:**
    *   **`rssService.js`:**
        *   **Purpose:** Fetches processed news and keyword data from the backend API. _(No longer directly handles RSS parsing on the frontend.)_
        *   **Location:** `src/services/rssService.js`
        *   **Key Functions:** `fetchNews()` (or similar function fetching from backend).
        *   **Dependencies:** Backend API endpoint (`/api/news`).
*   **`utils/`:** Holds general utility functions for the frontend.
    *   **(Example files: `performance.ts`, `fonts.ts`)**

### Backend (`news-backend/src/`)

*   **`app.js`:**
    *   **Purpose:** Main Express application setup, middleware, route mounting.
    *   **Location:** `news-backend/src/app.js`
    *   **Key Functions:** Route setup, server initialization, DB connection.
    *   **Dependencies:** `express`, `routes/news.js`, `routes/statusRoutes.js`, `routes/sourceRoutes.js`, `cron.js`
*   **`cron.js`:**
    *   **Purpose:** Schedules periodic tasks: 1) Fetching new entries from Miniflux via `rssService`, processing, and saving to DB. 2) Queueing unprocessed articles for LLM analysis.
    *   **Location:** `news-backend/src/cron.js`
    *   **Key Functions:** `scheduleCronJobs()`, `fetchAllSources()`, `processQueuedArticles()`.
    *   **Dependencies:** `node-cron`, `services/rssService`, `services/llmService`, `config/db.js`
*   **`config/db.js`:**
    *   **Purpose:** MongoDB connection configuration and logic.
    *   **Location:** `news-backend/src/config/db.js`
    *   **Key Functions:** `connectDB()`, `getDB()`.
    *   **Dependencies:** `mongodb`
*   **`models/NewsItem.js`:**
    *   **Purpose:** MongoDB model schema for news items.
    *   **Location:** `news-backend/src/models/NewsItem.js`
    *   **Key Functions:** `NewsItemSchema`.
    *   **Dependencies:** `mongoose`
*   **`routes/news.js`:**
    *   **Purpose:** API routes for serving processed news and keyword data to the frontend.
    *   **Location:** `news-backend/src/routes/news.js`
    *   **Key Functions:** `GET /api/news`.
    *   **Dependencies:** `config/db.js`
*   **`routes/sourceRoutes.js`:**
    *   **Purpose:** API routes for managing RSS sources (CRUD operations, configuration).
    *   **Location:** `news-backend/src/routes/sourceRoutes.js`
    *   **Key Functions:** `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /config`.
    *   **Dependencies:** `services/sourceManagementService`, `utils/constants.js`
*   **`routes/statusRoutes.js`:**
    *   **Purpose:** API route for providing system status (e.g., last fetch time).
    *   **Location:** `news-backend/src/routes/statusRoutes.js`
    *   **Key Functions:** `GET /status`.
    *   **Dependencies:** `config/db.js`
*   **`services/`:**
    *   **`sourceManagementService.js`:** _(New)_
        *   **Purpose:** Manages the master list of RSS sources (`data/master_sources.json`). Provides CRUD operations on this list and synchronizes additions/updates/deletions with the configured Miniflux instance via its API. Also provides source metadata (name, category, bias) to other services.
        *   **Location:** `news-backend/src/services/sourceManagementService.js`
        *   **Key Functions:** `loadSources()`, `saveSources()`, `getAllSources()`, `addSource()`, `updateSource()`, `deleteSource()`, `syncWithMinifluxFeeds()`.
        *   **Dependencies:** `axios` (for Miniflux API), `fs`, `path`, `dotenv`.
    *   **`rssService.js`:**
        *   **Purpose:** Fetches new/unread entries directly from the Miniflux API. Enriches these entries with metadata (bias, category, name) from `sourceManagementService`. Performs bulk upsert into MongoDB and marks entries as read in Miniflux. _(No longer parses RSS feeds directly or manages feed lists.)_
        *   **Location:** `news-backend/src/services/rssService.js`
        *   **Key Functions:** `fetchAndProcessMinifluxEntries()`.
        *   **Dependencies:** `axios` (for Miniflux API), `services/sourceManagementService`, `config/db.js`, `models/NewsItem.js`.
    *   **`wordProcessingService.js`:**
        *   **Purpose:** Processes text from fetched news items (provided by `cron.js` from DB) to extract and rank keywords/tags, potentially enhanced with LLM analysis.
        *   **Location:** `news-backend/src/services/wordProcessingService.js`
        *   **Key Functions:** `processNewsKeywords()`, `aggregateKeywordsForCloud()`.
        *   **Dependencies:** Input text data, `services/llmService`.
    *   **`llmService.js`:**
        *   **Purpose:** Provides LLM capabilities for NLP tasks (keyword extraction, summarization, bias detection) on articles queued by `cron.js`.
        *   **Location:** `news-backend/src/services/llmService.js`
        *   **Key Functions:** `processArticle()`, `processArticleWithRetry()`.
        *   **Dependencies:** `axios`, `lru-cache`, Ollama LLM.
*   **`utils/constants.js`:** _(New)_
    *   **Purpose:** Stores shared constant values, such as bias categories.
    *   **Location:** `news-backend/src/utils/constants.js`
*   **`data/master_sources.json`:** _(New)_
    *   **Purpose:** Central JSON file storing the master list of all RSS sources with their URL, name, category, bias, internal ID, and Miniflux feed ID. Managed by `sourceManagementService`.
    *   **Location:** `news-backend/data/master_sources.json`
*   **`public/manage-sources.html`:** _(New)_
    *   **Purpose:** Simple backend-hosted HTML interface for viewing, adding, editing (name, URL, category, bias), and deleting sources from `master_sources.json` via the `/api/sources` endpoints.
    *   **Location:** `news-backend/public/manage-sources.html`
*   **`scripts/`:**
    *   **`run-sync.js`:** _(New - Utility Script)_
        *   **Purpose:** One-time script to synchronize `master_sources.json` with the feeds currently in the Miniflux instance, updating `minifluxFeedId` fields in the JSON file. Not intended for regular use.
        *   **Location:** `news-backend/src/scripts/run-sync.js`
        *   **Dependencies:** `services/sourceManagementService`.

*   **`utils/`:**
    *   **(Directory no longer exists. Constants moved to `utils/constants.js`. Other utilities integrated.)**

## 4. Data Flow

1.  **Source Management (Manual/UI):**
    *   User interacts with `manage-sources.html` (`/manage-sources.html`).
    *   UI calls CRUD API endpoints in `sourceRoutes.js` (`/api/sources`).
    *   `sourceManagementService.js` updates `data/master_sources.json` and makes corresponding API calls to add/update/delete feeds and categories in the Miniflux instance.
2.  **Backend Data Fetching & Processing (Automated):**
    *   `cron.js` schedules `rssService.fetchAndProcessMinifluxEntries()`.
    *   `rssService.js` fetches *unread* entries from the Miniflux API (`/v1/entries`).
    *   `rssService.js` calls `sourceManagementService.js` to get the current source list (name, category, bias) based on the Miniflux `feed_id` or URL found in the entry.
    *   `rssService.js` combines Miniflux entry data with source metadata and performs a bulk upsert into the `newsitems` collection in MongoDB.
    *   `rssService.js` marks the processed entries as read in Miniflux via the API (`/v1/entries`).
    *   Separately, `cron.js` schedules `processQueuedArticles()`.
    *   This task finds articles in MongoDB that haven't been processed by the LLM (`keywords` field doesn't exist).
    *   It passes these articles (content, title etc.) to `llmService.js` via a queue (`better-queue`).
    *   `llmService.js` interacts with the Ollama LLM to extract keywords, determine bias, etc.
    *   The results are updated back into the corresponding MongoDB `newsitems` documents.
3.  **Frontend Data Request:**
    *   Frontend `rssService.js` sends requests to the backend API (`/api/news`).
    *   `routes/news.js` queries MongoDB for processed `newsitems` (potentially filtered).
    *   Data (including keywords and bias from LLM processing) is returned to the frontend.
4.  **Data Display:**
    *   Fetched data is used to render frontend components (`TagCloud3DOptimized`, lists, details).

## 5. External Dependencies

*   **`axios`:** HTTP client for API requests (Miniflux, Ollama).
*   **`mongodb`:** MongoDB driver (replacing `mongoose`).
*   **`node-cron`:** Scheduling jobs (Backend).
*   **`lru-cache`:** Caching mechanism for LLM responses.
*   **`better-queue`:** Batch processing for LLM operations.
*   **`he`:** HTML entities library (used in `manage-sources.html`).
*   **Miniflux:** Self-hosted RSS aggregator (required dependency).
*   **Ollama:** Local LLM inference engine (required dependency).
*   **External APIs:** None (direct interaction only with self-hosted Miniflux/Ollama).

## 6. Critical Functions and Files

*   **Backend:**
    *   `news-backend/src/cron.js`: Scheduling for `fetchAndProcessMinifluxEntries` and LLM processing queue.
    *   `news-backend/src/services/sourceManagementService.js`: Core logic for managing `master_sources.json` and syncing with Miniflux.
    *   `news-backend/src/services/rssService.js`: `fetchAndProcessMinifluxEntries()` - Core logic for getting entries from Miniflux, enriching, saving to DB, marking read.
    *   `news-backend/src/services/llmService.js`: `processArticleWithRetry()` - LLM-based analysis.
    *   `news-backend/data/master_sources.json`: The central source list.
    *   `news-backend/public/manage-sources.html`: UI for managing sources.
    *   `news-backend/src/routes/sourceRoutes.js`: API for managing sources.
    *   `news-backend/src/routes/news.js`: API endpoint for serving processed data to frontend.
*   **Frontend:**
    *   `src/services/rssService.js`: `fetchNews()` - Fetches data from `/api/news`.
    *   `src/components/TagCloud3DOptimized.tsx`: Renders the 3D tag cloud.

## 7. LLM Integration

*   **Architecture:**
    *   **Local LLM:** Uses Ollama to run open-source language models locally (Gemma 2B recommended).
    *   **Processing Flow:** All news articles are analyzed by the LLM for keywords and bias detection.
    *   **Caching:** LRU cache improves performance by storing results for identical content.
    *   **Queue System:** Articles are processed in batches to optimize throughput.
    *   **Fallback Mechanisms:** Traditional NLP is used alongside LLM for redundancy.

*   **Key Components:**
    *   **`llmService.js`:** Central service for all LLM operations with caching and retry capability.
    *   **Enhanced `wordProcessingService.js`:** Combines traditional NLP with LLM analysis.
    *   **Processing Queue:** Implemented in `cron.js` to handle article processing efficiently.
    *   **Documentation:** Detailed in `LLM_INTEGRATION.md`.

*   **Setup Requirements:**
    *   Ollama must be installed and running (`ollama serve`).
    *   At least one language model must be pulled (e.g., `ollama pull gemma:2b`).
    *   MongoDB for storing processed data.
    *   Miniflux for RSS feed management.

*   **Development Workflow:**
    *   The `npm run dev` command automatically starts all required services.
    *   Ollama runs locally with increased concurrency for better performance.
    *   The backend connects to Miniflux via API key for RSS feed management.

## 8. Development Workflow

*   **Frontend:**
  * `npm start` - Start the frontend application

*   **Backend:**
  * `npm run dev` - Start all services (Miniflux, Ollama, MongoDB) and backend with auto-reload
  * `npm run services:start` - Start just the required services without the backend
  * `npm run dev:simple` - Start backend with minimal setup (legacy mode)

*   **Root Project:**
  * `npm run dev` - Start both frontend and backend concurrently

## 9. Configuration and Environment

*   **Environment Variables:**
    *   Backend requires database connection strings. API keys for external news services are no longer needed.
*   **Configuration Files:**
    *   `news-backend/src/config/db.js`: Handles database connection details.
    *   `package.json`: Defines environment variables via scripts.
*   **Environments:** No clear differentiation between dev/prod in the current setup.

## 10. Common Patterns

*   **Service Layer:** Clear separation of concerns with backend `services/` and frontend `services/`.
*   **Component-Based:** React components are modular and reusable.
*   **Utility Functions:** `utils/` directories for shared functionality.
*   **RESTful APIs:** Backend exposes data via REST.
* **Data Caching:** The backend database stores fetched and processed news data.
* **Naming Conventions:** Files and functions are generally named descriptively.
* **Error Handling:** No explicit pattern, but try-catch blocks are present in API interaction code.
* **Testing:** There are `test.tsx` files, but no clear testing strategy in place.