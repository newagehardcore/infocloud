# RSS Feed CORS Solution

## Problem

The application was encountering CORS (Cross-Origin Resource Sharing) errors when trying to fetch RSS feeds directly from the browser. This is because:

1. Most news sites do not set the `Access-Control-Allow-Origin` header to allow requests from arbitrary origins.
2. The browser strictly enforces this security policy, blocking these cross-origin requests.
3. Some RSS feeds were using incorrect or outdated URLs.

## Solution

We've implemented a server-side proxy approach to resolve these issues:

### 1. Development Environment

- Created a `setupProxy.js` file in the `src` directory that:
  - Adds a `/api/rss-feed` endpoint that fetches RSS feeds from the server-side
  - Uses `rss-parser` to parse the feeds
  - Falls back to raw XML fetching when the parser fails
  - Handles errors gracefully

### 2. Production Environment

- Created a `server.js` file for production that:
  - Serves the same API endpoints as the development proxy
  - Also serves the built React application
  - Handles all routes properly

### 3. Client-Side Changes

- Updated the `RSSSource` class to:
  - Call the proxy endpoint instead of directly requesting RSS feeds
  - Handle both parsed feed data and raw XML content
  - Deal with various feed formats consistently
- Updated RSS feed URLs to more current and reliable ones

## How to Run

### Development Mode

Run both the React development server and the backend server:

```bash
npm run dev
```

This uses `concurrently` to start both servers in parallel.

### Production Mode

Build the React app and start the production server:

```bash
npm run build
npm run start:prod
```

## Benefits

1. **No CORS Issues**: Server-to-server requests are not subject to browser CORS restrictions
2. **Better Error Handling**: Centralizes error handling for feed fetching
3. **More Reliable**: Updated feed URLs and better fallback mechanisms
4. **Scalable**: The proxy architecture can be extended to support more features
5. **Production Ready**: Works in both development and production environments

## Technical Details

- Uses `http-proxy-middleware` for development proxying
- Uses `express` for the production server
- Uses `rss-parser` for primary RSS parsing
- Includes a custom XML parser as fallback for problematic feeds
- Maintains the same client-side API for easy integration 