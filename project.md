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
*   **Containerization:** Docker, Docker Compose

## 2. Core Features

*   **3D Tag Cloud Visualization:** Uses Three.js to render news keywords. Word size often corresponds to frequency/importance, and color may indicate source bias or other metadata.
*   **Real-time Updates:** (Potentially via WebSocket or frequent polling) The tag cloud should update dynamically as new news data is processed.
*   **Interactive Exploration:** Clicking on words/tags likely triggers actions like showing related articles or details (functionality might be evolving).
*   **Backend Data Processing:** Handles RSS feed aggregation (via Miniflux API), data enrichment (keywords via LLM), and storage (MongoDB). Article bias is determined solely by the manually set bias of its parent Source.
*   **Source Management:** System for managing RSS source URLs, categories, and metadata (including definitive political bias, stored in MongoDB), synchronizing feeds with Miniflux.
*   **LLM Integration:** Leverages a local Ollama instance for advanced text analysis (primarily keyword extraction).
*   **Responsive Design:** Aims to work on both desktop and mobile (potentially with different views).

## 3. Architecture & Data Flow

**High-Level:** Containerized Microservices Architecture

1.  **Source Management (`/admin` page):**
    *   User interacts with the unified Backend Manager UI (`admin.html`) served statically.
    *   Frontend JavaScript sends API requests to `news-backend` (`sourceRoutes.js`):
        *   `GET /api/sources`: Retrieve the current list of sources from the MongoDB `Source` collection.
        *   `POST /api/sources`: Add a new source to the MongoDB `Source` collection and create the feed in Miniflux.
        *   `PUT /api/sources/:id`: Update a source's details (name, category, bias) in the MongoDB `Source` collection. Changes to bias or category trigger updates to associated `NewsItem` documents and a keyword cache refresh.
        *   `DELETE /api/sources/:id`: Remove a source from the MongoDB `Source` collection and delete the corresponding feed from Miniflux.
        *   `GET /api/sources/config`: Retrieves configuration like bias categories and dynamically gets existing categories from the `Source` collection.
        *   `GET /api/sources/export`: Export all sources as a JSON file.
        *   `POST /api/sources/import`: Import sources from a JSON file (expects `multipart/form-data` with a field named `sourcesFile`).
        *   `POST /api/sources/purge-all`: Delete all sources from the database and attempt to delete corresponding feeds from Miniflux.
    *   Backend service (`sourceManagementService.js`) handles the database interactions (using the `Source` model) and syncs feed creation/deletion/updates with the configured Miniflux instance via its API.
    *   **Source Data Format (for Import/Export):** The JSON format for importing/exporting sources is an array of objects, where each object represents a source and should include fields like `name`, `url`, `category`, `bias`, and optionally `alternateUrl`. The `_id`, `uuid`, `minifluxFeedId`, `createdAt`, and `updatedAt` fields are generally excluded from exports and handled by the backend during import.
2.  **Backend Data Fetching & Processing (Automated - `news-backend/src/cron.js`):**
    *   Scheduled job (`rssService.fetchAndProcessMinifluxEntries`) fetches *unread* entries from the Miniflux API. The `minifluxEntryId` from these entries is treated as a string throughout the backend processing pipeline, including storage in the `NewsItem` model and when querying `NewsItem` documents.
    *   Entries are enriched with source metadata (name, category, bias) by looking up the `minifluxFeedId` in the MongoDB `Source` collection. The `NewsItem.source.bias` and `NewsItem.source.category` fields are populated directly from the `Source` document. The top-level `NewsItem.bias` is also set to mirror `NewsItem.source.bias`.
    *   **Validation Check:** Before saving, entries are validated to ensure essential fields (including the string `minifluxEntryId`, title, and content from Miniflux) are present; incomplete entries are skipped to maintain data quality for subsequent LLM processing.
    *   Enriched data is bulk upserted into the MongoDB `newsitems` collection.
    *   Processed entries are marked as read in Miniflux using the `markEntriesAsRead` function in `rssService.js`, which correctly converts the string `minifluxEntryId` values to numbers for this specific API interaction.
    *   A separate scheduled job (`processQueuedArticles`) identifies unprocessed articles in MongoDB (querying by their string `minifluxEntryId`).
    *   These articles are sent to `llmService.js` (via `better-queue`) for keyword extraction. The `llmService.js` no longer determines bias.
    *   Results from the LLM (keywords), along with incremented processing attempt counts, are updated back into the MongoDB `newsitems` documents. The `NewsItem.bias` field is updated based on `NewsItem.source.bias` during this step by `wordProcessingService.js`.
    *   **Keyword Cache Generation (`wordProcessingService.js`):**
        *   Keywords from processed articles are aggregated into a global cache (`keywordCache`).
        *   The `biases` and `categories` associated with each keyword in this cache are derived from the `NewsItem.source.bias` and `NewsItem.source.category` fields of the articles the keyword appears in. If `source.category` is not available, it defaults to `NewsCategory.UNKNOWN`.
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
├── docker/                  # Docker-related files and data volumes
│   ├── mongodb/             # MongoDB data volume
│   ├── mongodb_config/      # MongoDB config volume
│   ├── ollama/              # Ollama Dockerfile and config
│   │   └── Dockerfile       # Ollama container configuration
│   ├── ollama_data/         # Ollama models and data
│   └── postgres/            # PostgreSQL data volume
├── news-backend/            # Backend application
│   ├── data/                # Data files (e.g., initial seeds, potentially master_sources.json as backup/seed)
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
│   ├── Dockerfile           # Backend container configuration
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
├── docker-compose.yml       # Docker configuration for all services
├── Dockerfile               # Frontend container configuration
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
*   **Docker Services:**
    * **Frontend Container:** React application serving the UI
    * **Backend Container:** Node.js/Express API and processing logic
    * **MongoDB Container:** Database for storing news items and sources
    * **Miniflux Container:** RSS feed aggregator
    * **PostgreSQL Container:** Database for Miniflux
    * **Ollama Container:** Local LLM service for text analysis

## 6. Setup & Running

### Prerequisites

*   Docker & Docker Compose (Ensure Docker Desktop is running)
*   Git for cloning the repository

### Environment Setup

1.  **Docker Configuration:**
    *   The entire application stack is containerized using Docker Compose (`docker-compose.yml` in the project root).
    *   This manages all services: Frontend, Backend, Miniflux, PostgreSQL, MongoDB, and Ollama.
    *   Start all services with:
        ```bash
        docker-compose up -d
        ```
    *   Access points:
        *   Frontend UI: `http://localhost:3000`
        *   Backend API: `http://localhost:5001`
        *   Admin UI: `http://localhost:5001/admin.html`
        *   Miniflux UI: `http://localhost:8080` (Default user: `admin`, pass: `adminpass`)
    *   **Miniflux API Key:** Generate an API key within the Miniflux UI (Settings > API Keys). You will need to update this in the docker-compose.yml environment variables for the backend service.

2.  **Container Environment Variables:**
    *   **Backend Container:**
        ```dotenv
        MONGODB_URI=mongodb://superadmin:supersecret@mongodb:27017/infocloud?authSource=admin
        DB_NAME=infocloud
        OLLAMA_API_URL=http://ollama:11434
        PORT=5001
        MINIFLUX_URL=http://miniflux:8080
        MINIFLUX_API_KEY=YOUR_GENERATED_MINIFLUX_API_KEY
        ```
    *   **Frontend Container:**
        ```dotenv
        REACT_APP_API_URL=http://backend:5001
        ```
    *   **MongoDB Container:**
        ```dotenv
        MONGO_INITDB_ROOT_USERNAME=superadmin
        MONGO_INITDB_ROOT_PASSWORD=supersecret
        MONGO_INITDB_DATABASE=infocloud
        ```
    *   **PostgreSQL Container:**
        ```dotenv
        POSTGRES_USER=miniflux
        POSTGRES_PASSWORD=secret
        ```

### Installation

1.  Clone the repository.
2.  Start the Docker containers:
    ```bash
    docker-compose up -d
    ```
3.  Access the application at `http://localhost:3000`

### Initial Data Setup

1.  Access the Admin UI at `http://localhost:5001/admin.html`
2.  Import sources or add them manually through the UI
3.  The system will automatically begin fetching and processing news items

## 7. Development Workflow

*   **Docker-based Development:** The recommended workflow is to use the containerized environment:
    ```bash
    # Start all containers
    docker-compose up -d
    
    # View logs from all containers
    docker-compose logs -f
    
    # View logs from specific container
    docker logs infocloud-backend -f
    
    # Stop all containers
    docker-compose down
    ```

*   **Local Development (Alternative):** For frontend-only changes, you can run the frontend locally while using containerized backend services:
    1. Start backend containers: `docker-compose up -d backend mongodb miniflux db ollama`
    2. Install frontend dependencies: `npm install`
    3. Run frontend locally: `npm start`

*   **Container Rebuilding:** After code changes, rebuild containers:
    ```bash
    # Rebuild specific service
    docker-compose build frontend
    
    # Rebuild and restart
    docker-compose up -d --build frontend
    ```

*   **Linting/Formatting:** Follow ESLint rules (`.eslintrc.js`).
*   **Branching:** Use feature branches.

## 8. LLM Integration Details

*   **Engine:** Ollama (containerized local inference).
*   **Tasks:** Primarily keyword extraction. Bias detection is no longer performed by the LLM; bias is sourced directly from the admin-defined `Source.bias`. Potentially summarization.
*   **Mechanism:** Articles are queued (`better-queue`) by `cron.js` for asynchronous processing. The `llmService.js` dequeues these articles, using their string `minifluxEntryId` to fetch the full `NewsItem` data from MongoDB if necessary, and then interacts with the Ollama API for keyword extraction.
*   **Caching:** `lru-cache` is used in `llmService.js` to avoid re-processing identical content for keyword extraction.
*   **Dependencies:** Uses the containerized Ollama service accessible at http://ollama:11434 within the Docker network.
*   **Data Integrity:** The system ensures that `minifluxEntryId` is consistently handled as a string when interfacing between Miniflux, the `NewsItem` database model, and the LLM processing queue. Updates to `NewsItem` documents post-LLM processing are performed using MongoDB bulk operations. The article's bias is always derived from its `Source` document.

## 9. Docker Container Details

*   **Frontend (`infocloud-frontend`):**
    *   Base image: `node:20-alpine`
    *   Exposes port 3000
    *   Serves the React application
    *   Connects to backend via internal Docker network

*   **Backend (`infocloud-backend`):**
    *   Base image: `node:20-alpine` with Docker CLI and curl
    *   Exposes port 5001
    *   Runs the Express API server
    *   Processes news items and interacts with other services

*   **MongoDB (`infocloud-mongodb`):**
    *   Base image: `mongo:6.0`
    *   Exposes port 27017
    *   Stores news items, sources, and processed data
    *   Data persisted in `./docker/mongodb` volume

*   **Miniflux (`infocloud-miniflux`):**
    *   Base image: `miniflux/miniflux:latest`
    *   Exposes port 8080
    *   Handles RSS feed aggregation
    *   Depends on PostgreSQL database

*   **PostgreSQL (`infocloud-db`):**
    *   Base image: `postgres:14-alpine`
    *   Used by Miniflux for feed storage
    *   Data persisted in `./docker/postgres` volume

*   **Ollama (`infocloud-ollama`):**
    *   Base image: `ollama/ollama:latest`
    *   Exposes port 11434
    *   Provides LLM capabilities for text analysis
    *   Models stored in `./docker/ollama_data` volume

## 10. Docker Backup and Restore

The project includes several scripts to backup and restore Docker containers and volumes:

*   **docker-volume-backup.sh:** Creates backups of MongoDB and PostgreSQL data
*   **docker-volume-restore.sh:** Restores MongoDB and PostgreSQL data from backups
*   **docker-container-snapshot.sh:** Creates snapshots of running containers as Docker images
*   **docker-container-restore.sh:** Restores containers from snapshots

These scripts are stored in the project root directory and should be used for:
* Creating regular backups of application data
* Saving the state of containers before making major changes
* Restoring the system to a previous state if needed

All backup files are stored in the `docker-backups` directory, which is excluded from Git.

## 11. Important Notes for AI Assistant

*   **Primary Source of Truth:** This `project.md` file. Refer to it for architecture, data flow, and key components.
*   **Verify Assumptions:** The codebase evolves. If instructed changes conflict with this document, verify against the current code (`src/` and `news-backend/src/`) before proceeding. Ask for clarification if discrepancies arise.
*   **Focus on Backend/Frontend Separation:** Maintain the client-server boundary.
*   **LLM Usage:** Changes related to text analysis (primarily keyword extraction) likely involve `news-backend/src/services/llmService.js` and potentially `news-backend/src/services/wordProcessingService.js`. Bias is NOT determined by the LLM.
*   **Data Source:** News originates from RSS feeds managed via Miniflux API, processed, and stored in MongoDB (`NewsItem` collection). **Sources themselves are managed in the MongoDB `Source` collection, which defines `source.category` and `source.bias` (the sole determinant of article bias), validated against respective enums (in `news-backend/src/types/index.js`).** The frontend consumes data *from the backend API*, not directly from Miniflux or RSS.
*   **State Management (Frontend):** Check `src/contexts/` or `src/hooks/` for primary state management patterns.
*   **Visualization:** The core 3D cloud is likely rendered by a component in `src/components/` using data passed as props.
*   **Error Handling in Cache Aggregation:** The `aggregateKeywordsForCloud` function in `news-backend/src/services/wordProcessingService.js` has robust error handling to prevent server crashes. This function is called every 2 minutes by a cron job to update the keyword cache used for the tag cloud. The cron job has timeout protection (60 seconds) to prevent hanging processes.
*   **Docker Network:** All services communicate over the internal Docker network named `infocloud_default`. Services reference each other by their service names (e.g., `http://backend:5001`, `mongodb://mongodb:27017`).

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
    *   `Dockerfile`: Container definition.
    *   `package.json`: Dependencies and scripts.
*   `/`: Root directory containing frontend application.
    *   `/src`: React frontend code.
    *   `/public`: Static frontend assets.
    *   `Dockerfile`: Frontend container definition.
    *   `package.json`: Frontend dependencies and scripts.
*   `/docker`: Contains Docker-related files and data volumes.
*   `docker-compose.yml`: Defines all services and their configurations.