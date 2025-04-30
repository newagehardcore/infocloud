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
        *   **Purpose:** Fetches processed news and keyword data from the backend API.
        *   **Location:** `src/services/rssService.js`
        *   **Key Functions:** `fetchNews()` (or similar function fetching from backend).
        *   **Dependencies:** Backend API endpoint.
    *   **`timeSnapshotService.ts`:**
        *   **Purpose:** Manages time snapshot related operations.
        *   **Location:** `src/services/timeSnapshotService.ts`
        *   **Key Functions:** `fetchTimeSnapshots()`, `createTimeSnapshot()`
        *   **Dependencies:** None
*   **`utils/wordProcessing.ts`:**
    *   **Purpose:** **[DEPRECATED]** Previously processed word data for the 3D Tag Cloud. This logic is now handled by the backend `wordProcessingService`.
    *   **Location:** `src/utils/wordProcessing.ts`
    *   **Key Functions:** None (obsolete).
    *   **Dependencies:** None.

### Backend (`news-backend/src/`)

*   **`app.js`:**
    *   **Purpose:** Main Express application.
    *   **Location:** `news-backend/src/app.js`
    *   **Key Functions:** Route setup, server initialization.
    *   **Dependencies:** `express`, `routes/news.js`
    *   **Purpose:** Scheduled tasks for fetching news from RSS feeds.
    *   **Location:** `news-backend/src/cron.js`
    *   **Key Functions:** `startNewsFetchingJob()` (or similar).
    *   **Dependencies:** `node-cron`, `rssService`, `wordProcessingService`
*   **`cron.js`:**
    *   **Purpose:** Scheduled tasks for fetching news.
    *   **Location:** `news-backend/src/cron.js`
    *   **Key Functions:** `startNewsFetchingJob()`.
    *   **Dependencies:** `node-cron`
*   **`config/db.js`:**
    *   **Purpose:** Database connection configuration.
    *   **Location:** `news-backend/src/config/db.js`
    *   **Key Functions:** `connectToDatabase()`.
    *   **Dependencies:** `mongoose`
*   **`models/NewsItem.js`:**
    *   **Purpose:** MongoDB model for news items.
    *   **Location:** `news-backend/src/models/NewsItem.js`
    *   **Key Functions:** `NewsItemSchema`.
    *   **Dependencies:** `mongoose`
*   **`routes/news.js`:**
    *   **Purpose:** API routes for serving processed news and keyword data.
    *   **Location:** `news-backend/src/routes/news.js`
    *   **Key Functions:** `GET /news` (or similar endpoint providing news and words).
    *   **Dependencies:** `services/rssService`, `services/wordProcessingService`
*   **`services/`:**
    *   **`gNewsService.js`:** **[DEPRECATED]**
        *   **Purpose:** Previously fetched data from Google News API. Removed as project now uses RSS exclusively.
        *   **Location:** `news-backend/src/services/gNewsService.js`
    *   **`newsApiService.js`:** **[DEPRECATED]**
        *   **Purpose:** Previously fetched data from News API. Removed as project now uses RSS exclusively.
        *   **Location:** `news-backend/src/services/newsApiService.js`
    *   **`rssService.js`:**
        *   **Purpose:** Fetches and parses RSS feeds.
        *   **Location:** `news-backend/src/services/rssService.js`
        *   **Key Functions:** `fetchAndParseFeed()`.
        *   **Dependencies:** `rss-parser`
    *   **`theNewsApiService.js`:** **[DEPRECATED]**
        *   **Purpose:** Previously fetched data from The News API. Removed as project now uses RSS exclusively.
        *   **Location:** `news-backend/src/services/theNewsApiService.js`
    *   **`wordProcessingService.js`:**
        *   **Purpose:** Processes text from fetched RSS items to extract and rank keywords/tags.
        *   **Location:** `news-backend/src/services/wordProcessingService.js`
        *   **Key Functions:** Keyword extraction, frequency counting, potentially NLP tasks.
        *   **Dependencies:** Input text data (likely from `rssService`).
*   **`utils/`:**
    *   **`biasAnalyzer.js`:** **[STATUS UNCERTAIN - Review Needed]**
        *   **Purpose:** Previously analyzed news articles for potential bias. Verify if still used or deprecated.
        *   **Location:** `news-backend/src/utils/biasAnalyzer.js`
    *   **`keywordExtractor.js`:** **[DEPRECATED]**
        *   **Purpose:** Previously extracted keywords. This functionality is now likely part of `wordProcessingService`.
        *   **Location:** `news-backend/src/utils/keywordExtractor.js`
    *   **`rssUtils.js`:** **[STATUS UNCERTAIN - Review Needed]**
        *   **Purpose:** Utilities for RSS parsing and handling. Verify if still needed or merged into `rssService`.
        *   **Location:** `news-backend/src/utils/rssUtils.js`

## 4. Data Flow

1.  **Backend Data Fetching & Processing:**
    *   `cron.js` schedules jobs to fetch news from RSS feeds via `rssService.js`.
    *   Fetched article text is passed to `wordProcessingService.js` for keyword extraction and processing.
    *   Processed data (news items and associated keywords/tags) is stored (e.g., in MongoDB via `NewsItem.js`).
2.  **Frontend Data Request:**
    *   `rssService.js` (frontend) sends requests to the backend API (e.g., `GET /news`) to fetch processed news and keyword data.
    *   Data may be filtered based on user selections via `FilterContext`.
3.  **Data Display:**
    *   Fetched data is used to render components.
    *   `TagCloud3DOptimized.tsx` receives pre-processed keyword data from the backend to visualize the tag cloud.
    *   Time-related filtering data is handled via `TimeControls.tsx`.
4. The user makes UI changes via `EditMenu.tsx`, which modifies the state and then refreshes data.

## 5. External Dependencies

*   **`axios`:** HTTP client (potentially less used now if only fetching RSS via backend).
*   **`mongoose`:** MongoDB Object Modeling.
*   **`rss-parser`:** RSS feed parsing (Backend).
*   **`node-cron`:** Scheduling jobs for data fetching (Backend).
*   **External APIs:** **RSS Feeds only.**

## 6. Critical Functions and Files

*   **Backend:**
    *   `news-backend/src/cron.js`: `startNewsFetchingJob()` - Core logic for fetching new RSS data.
    *   `news-backend/src/routes/news.js`: API endpoint handling for processed data.
    *   `news-backend/src/services/rssService.js`: `fetchAndParseFeed()` - Handles RSS feed data retrieval.
    *   `news-backend/src/services/wordProcessingService.js`: Core logic for keyword extraction and processing.
*   **Frontend:**
    *   `src/services/rssService.js`: `fetchNews()` - Handles fetching processed data from the backend.
    *   `src/components/TagCloud3DOptimized.tsx`: Renders the 3D tag cloud visualization using backend data.
    *   `src/contexts/FilterContext.tsx`: Core logic for storing and accessing filter values.

## 7. Configuration and Environment

*   **Environment Variables:**
    *   Backend requires database connection strings. API keys for external news services are no longer needed.
*   **Configuration Files:**
    *   `news-backend/src/config/db.js`: Handles database connection details.
    *   `package.json`: Defines environment variables via scripts.
*   **Environments:** No clear differentiation between dev/prod in the current setup.

## 8. Common Patterns

*   **Service Layer:** Clear separation of concerns with backend `services/` and frontend `services/`.
*   **Component-Based:** React components are modular and reusable.
*   **Utility Functions:** `utils/` directories for shared functionality.
*   **RESTful APIs:** Backend exposes data via REST.
* **Data Caching:** The backend database stores fetched and processed news data.
* **Naming Conventions:** Files and functions are generally named descriptively.
* **Error Handling:** No explicit pattern, but try-catch blocks are present in API interaction code.
* **Testing:** There are `test.tsx` files, but no clear testing strategy in place.