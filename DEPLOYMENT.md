# INFOCLOUD - Deployment Guide

This document provides instructions for deploying the "INFOCLOUD" real-time news tag cloud application.

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- A web server for hosting static files (for production deployment)

## Development Setup

1. Clone the repository:
```
git clone <repository-url>
cd infocloud
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm start
```

This will start the application in development mode at [http://localhost:3000](http://localhost:3000).

## Production Deployment

### Building the Application

1. Create a production build:
```
npm run build
```

This will create a `build` directory with optimized production files.

2. The build folder contains static files that can be served by any web server.

### Deployment Options

#### Option 1: Static Hosting Services

You can deploy the application to static hosting services like:

- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Firebase Hosting

Most of these services offer simple deployment through their CLI tools or GitHub integration.

#### Option 2: Traditional Web Server

1. Copy the contents of the `build` directory to your web server's public directory.
2. Configure your web server to serve the `index.html` file for all routes (for client-side routing).

Example Nginx configuration:
```
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/build;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Environment Variables

For a production deployment with a real News API, you'll need to set up environment variables:

1. Create a `.env` file in the project root (for development) or set environment variables on your hosting platform:
```
REACT_APP_NEWS_API_KEY=your_api_key_here
```

2. Update the `newsService.ts` file to use this environment variable:
```typescript
const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
```

## API Integration

To use a real News API instead of mock data:

1. Sign up for an API key from a news service provider (e.g., NewsAPI.org, GNews)
2. Set the API key as described in the Environment Variables section
3. Uncomment the API call code in `src/services/newsService.ts` and comment out the mock data code

## Performance Considerations

- The application uses adaptive rendering based on device capabilities
- For high-traffic sites, consider implementing a caching layer for API responses
- Consider implementing server-side rendering for improved initial load performance

## Troubleshooting

- If you encounter CORS issues with the News API, you may need to set up a proxy server
- For WebGL rendering issues on older devices, the application will automatically fall back to a simplified 2D view
