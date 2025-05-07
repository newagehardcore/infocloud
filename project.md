# Project: INFOCLOUD - Real-time Interactive News Tag Cloud

## 1. Project Overview

INFOCLOUD is a full-stack application designed to visualize real-time news topics as an interactive 3D tag cloud. It aggregates news from various RSS feeds, processes the content using NLP and LLM techniques to extract keywords and determine characteristics like political leaning, and displays this information dynamically.

**Goal:** Provide a visually engaging and interactive way to explore the current news landscape, highlighting topic frequency and source bias.

**Core Technologies:**

*   **Frontend:** React, TypeScript, Three.js (via `@react-three/fiber`, `@react-three/drei`), CSS
*   **Backend:** Node.js, Express, MongoDB
*   **Data Aggregation:** Self-hosted Miniflux (managed via API)
*   **NLP/Analysis:** Local LLM (via Ollama), `compromise` (for lemmatization, phrase extraction)
*   **Build/Dev:** Craco (for overrides), `react-scripts`, `concurrently`

## 2. Core Features

*   **3D Tag Cloud Visualization:** Uses Three.js to render news keywords. Word size often corresponds to frequency/importance, and color may indicate source bias or other metadata.
*   **Real-time Updates:** (Potentially via WebSocket or frequent polling) The tag cloud should update dynamically as new news data is processed.
*   **Interactive Exploration:** Clicking on words/tags likely triggers actions like showing related articles or details (functionality might be evolving).
*   **Backend Data Processing:** Handles RSS feed aggregation (via Miniflux API), data enrichment (keywords, bias analysis via LLM), and storage (MongoDB).
*   **Source Management:** System for managing RSS source URLs, categories, and metadata (stored in MongoDB), synchronizing feeds with Miniflux.
*   **LLM Integration:** Leverages a local Ollama instance for advanced text analysis (keyword extraction, bias detection, etc.).
*   **Responsive Design:** Aims to work on both desktop and mobile (potentially with different views).

## 3. Architecture & Data Flow

**High-Level:** Client-Server Architecture

1.  **Source Management (`/admin` page):**
    *   User interacts with the unified Backend Manager UI (`admin.html`) served statically.
    *   Frontend JavaScript sends API requests to `news-backend` (`sourceRoutes.js`):
        *   `GET /api/sources`: Retrieve the current list of sources from the MongoDB `Source` collection.
        *   `POST /api/sources`: Add a new source to the MongoDB `Source` collection and create the feed in Miniflux.
        *   `PUT /api/sources/:id`: Update a source's details (name, category, bias) in the MongoDB `Source` collection (and update category in Miniflux if changed).
        *   `DELETE /api/sources/:id`: Remove a source from the MongoDB `Source` collection and delete the corresponding feed from Miniflux.
        *   `GET /api/sources/config`: Retrieves configuration like bias categories and dynamically gets existing categories from the `Source` collection.
    *   Backend service (`sourceManagementService.js`) handles the database interactions (using the `Source` model) and syncs feed creation/deletion/updates with the configured Miniflux instance via its API.
2.  **Backend Data Fetching & Processing (Automated - `news-backend/src/cron.js`):**
    *   Scheduled job (`rssService.fetchAndProcessMinifluxEntries`) fetches *unread* entries from the Miniflux API. The `minifluxEntryId` from these entries is treated as a string throughout the backend processing pipeline, including storage in the `NewsItem` model and when querying `NewsItem` documents.
    *   Entries are enriched with source metadata (name, category, bias) by looking up the `minifluxFeedId` in the MongoDB `Source` collection. The `NewsItem.source.category` field is critical here and is validated against the `NewsCategory` enum defined in `news-backend/src/types/index.js`.
    *   **Validation Check:** Before saving, entries are validated to ensure essential fields (including the string `minifluxEntryId`, title, and content from Miniflux) are present; incomplete entries are skipped to maintain data quality for subsequent LLM processing.
    *   Enriched data is bulk upserted into the MongoDB `newsitems` collection.
    *   Processed entries are marked as read in Miniflux using the `markEntriesAsRead` function in `rssService.js`, which correctly converts the string `minifluxEntryId` values to numbers for this specific API interaction.
    *   A separate scheduled job (`processQueuedArticles`) identifies unprocessed articles in MongoDB (querying by their string `minifluxEntryId`).
    *   These articles are sent to `llmService.js` (via `better-queue`) for analysis.
    *   `llmService.js` interacts with Ollama for analysis (keywords, bias, etc.).
    *   Results from the LLM, along with incremented processing attempt counts, are updated back into the MongoDB `newsitems` documents using efficient bulk write operations that correctly structure `$set` and `$inc` operators.
    *   **Keyword Cache Generation (`wordProcessingService.js`):**
        *   Keywords from processed articles are aggregated into a global cache (`keywordCache`).
        *   Crucially, the `categories` associated with each keyword in this cache are derived from the `NewsItem.source.category` field of the articles the keyword appears in. If `source.category` is not available, it defaults to `NewsCategory.UNKNOWN`. This ensures that the cache reflects the specific categories of the news items.
        *   The `NewsCategory` enum in `news-backend/src/types/index.js` serves as the reference for valid categories and includes values like "NEWS", "POLITICS", "TECH", "ENTERTAINMENT", etc.
3.  **Frontend Data Request:**
    *   Frontend (`src/services/api.ts` or similar) requests data from the backend API (`/api/news` or WebSocket), potentially including a category filter.
    *   Backend route (`news-backend/src/routes/news.js`) queries MongoDB for processed `newsitems` and retrieves keywords from the `keywordCache` in `wordProcessingService.js`.
    *   If a category filter is applied, keywords are filtered based on their `categories` array (which now contains the specific `source.category` values).
    *   Data (including filtered keywords, bias) is returned to the frontend.
4.  **Frontend Rendering:**
    *   React components (`src/components/`) use the fetched data.
    *   `TagCloud.tsx` (or similar, potentially `TagCloud3DOptimized.tsx` though name might differ) uses the processed keyword data to render the interactive 3D visualization.
5.  **Backend Status & Actions (`/admin` page):**
    *   User interacts with the unified Backend Manager UI (`admin.html`).
    *   Frontend JavaScript periodically fetches status from `GET /status/api`.
    *   User can trigger database purge via `POST /status/api/admin/purge-db`.
    *   User can trigger a full data refresh via `POST /status/api/admin/force-refresh`.
    *   User can trigger category fixing via `POST /api/sources/fix-unknown-categories` (This uses the `Source` collection to map minifluxFeedId to correct category).
    *   These requests are handled by `statusRoutes.js` and `sourceRoutes.js`.

## 4. Directory Structure

```
├── .git/
├── build/                   # Frontend production build output
├── news-backend/            # Backend application
│   ├── data/                # Data files (e.g., initial seeds, potentially master_sources.json as backup/seed)
│   │   └── master_sources.json # (No longer primary source store for running app)
│   ├── models/              # MongoDB Models (e.g., NewsItem.js, Source.js)
│   ├── public/              # Static assets served by backend (e.g., admin.html)
│   ├── routes/              # API route handlers (e.g., news.js, sourceRoutes.js, statusRoutes.js)
│   ├── services/            # Business logic (e.g., rssService.js, llmService.js, sourceManagementService.js)
│   ├── config/              # Configuration (e.g., db.js)
│   ├── scripts/             # Utility scripts (e.g., run-sync.js, migrate-sources-to-db.js)
│   ├── utils/               # Utility functions (e.g., constants.js)
│   ├── .env                 # Backend environment variables (GITIGNORED)
│   ├── app.js               # Express app setup
│   ├── cron.js              # Scheduled tasks setup
│   └── package.json         # Backend dependencies
├── node_modules/            # Project dependencies (Frontend & Backend)
├── public/                  # Frontend static assets (index.html, fonts/, etc.)
│   └── fonts/               # Custom font files
├── scripts/                 # Root-level utility scripts (if any)
├── src/                     # Frontend source code (React App)
│   ├── components/          # Reusable UI components (TagCloud, Header, etc.)
│   ├── contexts/            # React contexts for state management
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Frontend data fetching (e.g., api.ts)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Frontend utility functions
│   ├── App.css              # Main app styles
│   ├── App.tsx              # Main application component
│   ├── index.css            # Global styles
│   └── index.tsx            # Application entry point
├── .env                     # Frontend environment variables (GITIGNORED, if used)
├── .eslint.rc.js            # ESLint configuration
├── .gitignore               # Git ignore rules
├── config-overrides.js      # CRACO configuration overrides
├── CORS_SOLUTION.md         # Documentation for CORS handling
├── docker-compose.yml       # Docker config for Miniflux/Postgres/MongoDB
├── DEPLOYMENT.md            # Deployment instructions
├── infocloud_feeds.opml     # Example OPML file for Miniflux import
├── miniflux_bridge.py       # Python bridge for Miniflux API (may or may not be currently used)
├── package-lock.json        # Dependency lock file
├── package.json             # Project dependencies and scripts (Frontend)
├── project.md               # THIS FILE - Project overview & technical details
└── tsconfig.json            # TypeScript configuration
```

## 5. Key Components & Services

*(Refer to Section 3: Architecture & Data Flow and Section 4: Directory Structure for key file locations and purposes)*

*   **Backend Core:** `news-backend/src/cron.js`, `news-backend/src/services/sourceManagementService.js`, `news-backend/src/services/rssService.js`, `news-backend/src/services/llmService.js`, `news-backend/src/models/Source.js`, `news-backend/src/models/NewsItem.js`.
*   **Backend API:** `news-backend/src/routes/news.js`, `news-backend/src/routes/sourceRoutes.js`, `news-backend/src/routes/statusRoutes.js`.
*   **Backend Management UI:** `news-backend/public/admin.html`.
*   **Frontend Core:** `src/App.tsx`, `src/components/TagCloud.tsx` (or similar), `src/services/api.ts` (or similar data fetching logic).

## 6. Setup & Running

### Prerequisites

*   Node.js (v16+ recommended)
*   npm (v7+ recommended)
*   Docker & Docker Compose
*   Ollama installed and running (`ollama serve`)
    *   A model pulled (e.g., `ollama pull gemma:2b`)
*   MongoDB running locally or accessible via Docker Compose.

### Environment Setup

1.  **Miniflux & Database:**
    *   Start Miniflux, its PostgreSQL database, and MongoDB using Docker:
        ```bash
        docker-compose up -d
        ```
    *   Access Miniflux UI: `http://localhost:8080` (Default user: `admin`, pass: `adminpass` - check `docker-compose.yml`)
    *   Import feeds: You might need to import feeds into Miniflux initially. The backend relies on feeds existing in Miniflux.
2.  **Backend (`news-backend/.env`):**
    *   Create or update `.env` file in `news-backend`. Key variables:
        ```dotenv
        MONGODB_URI=mongodb://localhost:27017/infocloud # Or mongodb://mongodb:27017/infocloud if running backend outside docker but DB inside
        MINIFLUX_URL=http://localhost:8080
        MINIFLUX_API_KEY=YOUR_MINIFLUX_API_KEY # Generate this in Miniflux UI (Settings > API Keys)
        OLLAMA_BASE_URL=http://localhost:11434 # Default Ollama URL
        # Other potential variables (LLM model name, ports, etc.)
        ```
3.  **Frontend (`.env` - Optional):**
    *   If needed, create `.env` in the root directory.

### Installation

1.  Clone the repository.
2.  Install root dependencies (includes frontend): `npm install`
3.  Install backend dependencies: `cd news-backend && npm install && cd ..`

### Initial Data Migration (First time setup)

1.  Ensure Docker services are running (`docker-compose up -d`).
2.  Run the one-time source migration script (if `master_sources.json` exists and you want to import from it):
    ```bash
    cd news-backend
    npm run migrate:sources
    cd ..
    ```

### Running the Application

Use the concurrent script (if available) or start backend and frontend separately.

*   **Backend:** `cd news-backend && npm run dev`
*   **Frontend:** `npm start` (from root)

This typically runs:
*   Frontend (React App): `http://localhost:3000`
*   Backend (Node/Express API): `http://localhost:5001` (or configured port)
*   Admin UI: `http://localhost:5001/admin`

## 7. Development Workflow

*   **Linting/Formatting:** Follow ESLint rules (`.eslintrc.js`).
*   **Branching:** Use feature branches.
*   **Backend Changes:** Restart backend server (`npm run dev` in `news-backend` handles this).
*   **Dependencies:** Add frontend deps via `npm install <package>` in root. Add backend deps via `npm install <package>` in `news-backend`.

## 8. LLM Integration Details

*   **Engine:** Ollama (local inference).
*   **Tasks:** Keyword extraction, bias detection, potentially summarization.
*   **Mechanism:** Articles are queued (`better-queue`) by `cron.js` for asynchronous processing. The `llmService.js` dequeues these articles, using their string `minifluxEntryId` to fetch the full `NewsItem` data from MongoDB if necessary, and then interacts with the Ollama API.
*   **Caching:** `lru-cache` is used in `llmService.js` to avoid re-processing identical content.
*   **Dependencies:** Requires Ollama server running and accessible.
*   **Data Integrity:** The system ensures that `minifluxEntryId` is consistently handled as a string when interfacing between Miniflux, the `NewsItem` database model, and the LLM processing queue. Updates to `NewsItem` documents post-LLM processing are performed using MongoDB bulk operations that correctly combine metadata updates (`$set`) and counter increments (`$inc`).

## 9. Important Notes for AI Assistant

*   **Primary Source of Truth:** This `project.md` file. Refer to it for architecture, data flow, and key components.
*   **Verify Assumptions:** The codebase evolves. If instructed changes conflict with this document, verify against the current code (`src/` and `news-backend/src/`) before proceeding. Ask for clarification if discrepancies arise.
*   **Focus on Backend/Frontend Separation:** Maintain the client-server boundary.
*   **LLM Usage:** Changes related to text analysis likely involve `news-backend/src/services/llmService.js` and potentially `news-backend/src/services/wordProcessingService.js`. The `wordProcessingService.js` is also responsible for building the global keyword cache, associating keywords with categories derived from `NewsItem.source.category`.
*   **Data Source:** News originates from RSS feeds managed via Miniflux API, processed, and stored in MongoDB (`NewsItem` collection). **Sources themselves are managed in the MongoDB `Source` collection, which defines `source.category` validated against the `NewsCategory` enum (in `news-backend/src/types/index.js`).** The frontend consumes data *from the backend API*, not directly from Miniflux or RSS.
*   **State Management (Frontend):** Check `src/contexts/` or `src/hooks/` for primary state management patterns.
*   **Visualization:** The core 3D cloud is likely rendered by a component in `src/components/` using data passed as props.

## Project Structure

*   `/news-backend`: Node.js/Express backend application.
    *   `/src`:
        *   `/config`: Database (Mongoose), Miniflux client setup.
        *   `/models`: Mongoose schemas (`NewsItem.js`, `Source.js`).
        *   `/routes`: Express route definitions (`news.js`, `sources.js`, `statusRoutes.js`).
        *   `/services`: Core logic (`rssService.js`, `llmService.js`, `wordProcessingService.js`, `cron.js`, `sourceManagementService.js`).
        *   `/scripts`: Utility/startup/migration scripts (`startup.js`, `start-dev.js`, `migrate-sources-to-db.js`, etc.).
        *   `/types`: Shared type definitions, including Enums for `PoliticalBias` and an expanded `NewsCategory` (e.g., `index.js`).
        *   `app.js`: Express application entry point.
    *   `/public`: Static files (`admin.html`).
    *   `.env`: Environment variables.
    *   `package.json`: Dependencies and scripts.
    *   `Dockerfile`: Container definition.
*   `/news-frontend`: React frontend application (details TBD).
*   `docker-compose.yml`: Docker Compose configuration.
*   `project.md`: This file.
*   `docs/architecture.md`: System architecture details.

## Getting Started

1.  **Prerequisites:** Docker, Node.js, npm.
2.  **Environment Setup:**
    *   Copy `.env.example` to `.env` in `news-backend`.
    *   Fill in Miniflux API key/URL, adjust MongoDB URI if needed.
    *   (Optional) Configure Ollama endpoint.
3.  **Build & Run (Docker Compose):**
    ```bash
    docker-compose up --build -d
    ```
4.  **Running Locally (Development):**
    *   `cd news-backend && npm install && cd ..`
    *   `npm install` (in root)
    *   Ensure dependencies running (e.g., `docker-compose up -d miniflux mongodb ollama`)
    *   Run migration (first time): `cd news-backend && npm run migrate:sources && cd ..`
    *   Run backend dev server: `cd news-backend && npm run dev`
    *   Run frontend dev server (if separate): `npm start` (from root)
    *   Access admin UI: `http://localhost:5001/admin`

## Key Technologies & Patterns

*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB with Mongoose ODM (`NewsItem` and `Source` collections).
*   **RSS Aggregation:** Miniflux (via `axios` API client).
*   **LLM Integration:** Ollama (via `axios`). `llm-utils/llmService.js` abstracts interaction.
*   **Keyword/Bias Extraction:** Local LLM prompted for JSON output. Fallback NLP via `compromise`, `natural`.
*   **Background Tasks:** `node-cron` for scheduling, `better-queue` for LLM queue.
*   **Configuration:** `dotenv`.
*   **Source Management:** Sources (feeds) are stored in the MongoDB `Source` collection and synced with Miniflux using its API. Includes category and bias metadata.
*   **Admin Interface:** Static HTML page (`news-backend/public/admin.html`) served by Express for status, DB actions, and source management (CRUD via API calls to backend).
*   **Error Handling:** Basic.
*   **Logging:** Basic `console.log`/`console.error`.

## Development Workflow

1.  Run `npm run dev` in `news-backend` (and `npm start` in root if frontend is separate).
2.  Make code changes. `nodemon` restarts backend.
3.  Access backend API at `http://localhost:5001`.
4.  Access admin page at `http://localhost:5001/admin`.
5.  Access Miniflux at `http://localhost:8080`.

## Deployment

(Details TBD - likely involves building Docker images and deploying via Docker Compose or orchestrator).