# Project: News Aggregation App

## 1. Project Overview

This project is a full-stack news aggregation application designed to collect, analyze, and display news from various RSS feeds and external news APIs. The frontend, built with React, features a dynamic 3D tag cloud for exploring topics with category- and bias-based filters. The backend, using Node.js and Express, manages data retrieval, storage, keyword extraction, and bias analysis, serving data to the frontend via RESTful APIs.

**Technologies:**

*   **Frontend:** React, CSS
*   **Backend:** Node.js, Express
*   **Data:** JSON
*   **APIs:** External News APIs (e.g., News API, Google News), RSS Feeds

**Core Design:**

*   **Microservice-inspired:** Backend services are modular (e.g., `rssService`, `newsApiService`).
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
        *   **Purpose:** Visualizes news keywords as an interactive 3D tag cloud.
        *   **Location:** `src/components/TagCloud3DOptimized.tsx`
        *   **Key Functions:** `generateCloud()`
        *   **Dependencies:** `wordProcessing`
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
        *   **Purpose:** Fetches and processes news data from the backend API.
        *   **Location:** `src/services/rssService.js`
        *   **Key Functions:** `fetchNews()`.
        *   **Dependencies:** `timeSnapshotService`
    *   **`timeSnapshotService.ts`:**
        *   **Purpose:** Manages time snapshot related operations.
        *   **Location:** `src/services/timeSnapshotService.ts`
        *   **Key Functions:** `fetchTimeSnapshots()`, `createTimeSnapshot()`
        *   **Dependencies:** None
*   **`utils/wordProcessing.ts`**:
    *   **Purpose:** Processes word data for the 3D Tag Cloud.
    *   **Location:** `src/utils/wordProcessing.ts`
    *   **Key Functions:** `processWordsForCloud()`, `sortAndFilterWords()`
    *   **Dependencies:** None

### Backend (`news-backend/src/`)

*   **`app.js`:**
    *   **Purpose:** Main Express application.
    *   **Location:** `news-backend/src/app.js`
    *   **Key Functions:** Route setup, server initialization.
    *   **Dependencies:** `express`, `routes/news.js`
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
    *   **Purpose:** API routes for news data.
    *   **Location:** `news-backend/src/routes/news.js`
    *   **Key Functions:** `GET /news`, `GET /news/:id`, `GET /relatedNews`
    *   **Dependencies:** `services`
*   **`services/`:**
    *   **`gNewsService.js`:**
        *   **Purpose:** Fetches data from Google News API.
        *   **Location:** `news-backend/src/services/gNewsService.js`
        *   **Key Functions:** `fetchNews()`.
        *   **Dependencies:** `axios`
    *   **`newsApiService.js`:**
        *   **Purpose:** Fetches data from News API.
        *   **Location:** `news-backend/src/services/newsApiService.js`
        *   **Key Functions:** `fetchNews()`.
        *   **Dependencies:** `axios`
    *   **`rssService.js`:**
        *   **Purpose:** Fetches and parses RSS feeds.
        *   **Location:** `news-backend/src/services/rssService.js`
        *   **Key Functions:** `fetchAndParseFeed()`.
        *   **Dependencies:** `rss-parser`
    *   **`theNewsApiService.js`:**
        *   **Purpose:** Fetches data from The News API.
        *   **Location:** `news-backend/src/services/theNewsApiService.js`
        *   **Key Functions:** `fetchNews()`.
        *   **Dependencies:** `axios`
*   **`utils/`:**
    *   **`biasAnalyzer.js`:**
        *   **Purpose:** Analyzes news articles for potential bias.
        *   **Location:** `news-backend/src/utils/biasAnalyzer.js`
        *   **Key Functions:** `analyzeBias()`.
        *   **Dependencies:** external APIs.
    *   **`keywordExtractor.js`:**
        *   **Purpose:** Extracts keywords from news articles.
        *   **Location:** `news-backend/src/utils/keywordExtractor.js`
        *   **Key Functions:** `extractKeywords()`.
        *   **Dependencies:** external APIs.
    *   **`rssUtils.js`:**
        *   **Purpose:** Utilities for RSS parsing and handling.
        *   **Location:** `news-backend/src/utils/rssUtils.js`
        *   **Key Functions:** `parseFeed()`.
        *   **Dependencies:** None

## 4. Data Flow

1.  **Backend Data Fetching:**
    *   `cron.js` schedules jobs to fetch news from RSS feeds (`rssService.js`) and external APIs (`gNewsService.js`, `newsApiService.js`, `theNewsApiService.js`).
    *   Fetched data is processed by `keywordExtractor.js` and `biasAnalyzer.js`.
    *   Cleaned data is stored in MongoDB via `NewsItem.js`.
2.  **Frontend Data Request:**
    *   `rssService.js` (frontend) sends requests to the backend API (e.g., `GET /news`) to fetch news.
    *   Data may be filtered via `FilterContext`.
3.  **Data Display:**
    *   Fetched data is used to render components like `NewsDetail.tsx`, `RelatedNewsPanel.tsx`, and `TagCloud3DOptimized.tsx`.
    *   `TagCloud3DOptimized.tsx` uses `wordProcessing.ts` to prepare keyword data for visualization.
    *   Time related filtering data is handled via `TimeControls.tsx`
4. The user makes UI changes via `EditMenu.tsx`, which modifies the state and then refreshes data.

## 5. External Dependencies

*   **`axios`:** HTTP client for making API requests.
*   **`mongoose`:** MongoDB Object Modeling.
*   **`rss-parser`:** RSS feed parsing.
*   **`node-cron`:** Scheduling jobs for data fetching.
*   **External APIs:** Google News, News API, and potential RSS feeds.

## 6. Critical Functions and Files

*   **Backend:**
    *   `news-backend/src/cron.js`: `startNewsFetchingJob()` - Core logic for fetching new data on a schedule.
    *   `news-backend/src/routes/news.js`: API endpoint handling.
    *   `news-backend/src/services/rssService.js`: `fetchAndParseFeed()` - Handles RSS feed data retrieval.
    * `news-backend/src/utils/keywordExtractor.js`: `extractKeywords()` - Key logic for word extraction.
    * `news-backend/src/utils/biasAnalyzer.js`: `analyzeBias()` - Key logic for analyzing bias in the news articles.
*   **Frontend:**
    *   `src/services/rssService.js`: `fetchNews()` - Handles fetching news from the backend.
    *   `src/components/TagCloud3DOptimized.tsx`: `generateCloud()` - Core logic for creating the 3D tag cloud visualization.
    *   `src/utils/wordProcessing.ts`: `processWordsForCloud()`- processes the keywords for the cloud.
    * `src/contexts/FilterContext.tsx`: Core logic for storing and accessing filter values.

## 7. Configuration and Environment

*   **Environment Variables:**
    *   Backend requires database connection strings and API keys for external services.
    *   API keys for external services like newsapi.org or gnews.io.
*   **Configuration Files:**
    *   `news-backend/src/config/db.js`: Handles database connection details.
    *   `package.json`: Defines environment variables via scripts.
*   **Environments:** No clear differentiation between dev/prod in the current setup.

## 8. Common Patterns

*   **Service Layer:** Clear separation of concerns with backend `services/` and frontend `services/`.
*   **Component-Based:** React components are modular and reusable.
*   **Utility Functions:** `utils/` directories for shared functionality.
*   **RESTful APIs:** Backend exposes data via REST.
* **Data Caching:** The backend database stores fetched news data, reducing redundant API calls.
* **Naming Conventions:** Files and functions are generally named descriptively.
* **Error Handling:** No explicit pattern, but try-catch blocks are present in API interaction code.
* **Testing:** There are `test.tsx` files, but no clear testing strategy in place.