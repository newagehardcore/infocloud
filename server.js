const express = require('express');
const path = require('path');
const axios = require('axios');
const Parser = require('rss-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize RSS parser with custom fields and increased timeout
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  },
  timeout: 60000, // Increase timeout to 60 seconds
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html'
  }
});

// Custom feed configurations for problematic sites
const feedConfigs = {
  'reuters.com': {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://www.reuters.com/'
    },
    timeout: 40000, // Increased timeout for Reuters
    useDirectFetch: true,  // Always use direct fetch for Reuters
    maxRetries: 3,  // Try up to 3 times
    fallbackUrl: 'https://www.reuters.com/arc/outboundfeeds/v3/rss/breakingviews/' // Alternative RSS feed from Reuters if the main one fails
  },
  'apnews.com': {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'apcf=accept',  // Accept cookies which might help with access
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://apnews.com/'
    },
    timeout: 40000,
    useDirectFetch: true,
    maxRetries: 3,
    // Multiple fallback URLs to try
    fallbackUrls: [
      'https://apnews.com/hub/us-news/rss',
      'https://apnews.com/hub/world-news/rss',
      'https://apnews.com/hub/technology/rss'
    ]
  },
  'wsj.com': {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Referer': 'https://www.wsj.com/'
    },
    timeout: 30000,
    useDirectFetch: true,  // Use direct fetch for Wall Street Journal
    fallbackUrl: 'https://www.wsj.com/news/rss-news-and-features', // Newer feed URL
    requiresSubscription: true
  },
  'dw.com': {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Referer': 'https://www.dw.com/'
    },
    timeout: 30000,
    fallbackUrl: 'https://rss.dw.com/rdf/rss-en-all' // More reliable feed URL for Deutsche Welle
  }
};

// Helper function to determine which config to use
const getFeedConfig = (url) => {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace('www.', '');
  
  // Find a matching domain in our configs
  for (const [configDomain, config] of Object.entries(feedConfigs)) {
    if (domain.includes(configDomain)) {
      return config;
    }
  }
  
  // Default config
  return {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    },
    timeout: 20000,
    useDirectFetch: false
  };
};

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint for RSS feeds
app.get('/api/rss-feed', async (req, res) => {
  try {
    const feedUrl = req.query.url;
    
    if (!feedUrl) {
      return res.status(400).json({ error: 'Missing feed URL parameter' });
    }
    
    console.log(`\n[RSS] Attempting to fetch: ${feedUrl}`);
    
    // Get the appropriate config for this feed
    const config = getFeedConfig(feedUrl);
    
    // If this is a feed we know needs direct fetching, skip the parser
    if (config.useDirectFetch) {
      try {
        console.log(`[RSS] Using direct fetch for ${feedUrl}`);
        
        // Use the retry function for direct fetches
        const fetchWithRetry = async (url, maxRetries = 2) => {
          let lastError;
          let currentUrl = url;
          const retries = config.maxRetries || maxRetries;
          let fallbackIndex = 0;
          let attempts = 0;
          
          for (let attempt = 0; attempt <= retries; attempt++) {
            attempts++;
            try {
              console.log(`[RSS] Attempt ${attempt + 1}/${retries + 1} for ${currentUrl}`);
              console.log('[RSS] Using headers:', JSON.stringify(config.headers, null, 2));
              
              const response = await axios.get(currentUrl, {
                headers: config.headers,
                timeout: config.timeout,
                validateStatus: false // Don't throw on any status code
              });
              
              console.log(`[RSS] Response status: ${response.status} for ${currentUrl}`);
              
              // Handle redirects manually if needed
              if (response.status === 301 || response.status === 302) {
                if (response.headers.location) {
                  console.log(`[RSS] Following redirect from ${currentUrl} to ${response.headers.location}`);
                  currentUrl = response.headers.location;
                  continue; // Try the new URL
                }
              }
              
              if (response.status !== 200) {
                throw new Error(`HTTP error! Status: ${response.status}, Response: ${response.data?.substring(0, 200)}`);
              }
              
              return response;
            } catch (error) {
              lastError = error;
              console.error(`[RSS] Attempt ${attempt + 1} failed for ${currentUrl}:`, {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                headers: error.response?.headers,
                data: error.response?.data?.substring(0, 200),
                code: error.code
              });
              
              // Special handling for common error types
              if (error.response?.status === 404) {
                console.error(`[RSS] Feed not found (404) at URL: ${currentUrl}`);
              } else if (error.response?.status === 403) {
                console.error(`[RSS] Access denied (403) for URL: ${currentUrl}`);
              } else if (error.code === 'ECONNABORTED') {
                console.error(`[RSS] Connection timed out for URL: ${currentUrl}`);
              } else if (error.code === 'ENOTFOUND') {
                console.error(`[RSS] Host not found for URL: ${currentUrl}`);
              }
              
              // Check for multiple fallback URLs
              if (config.fallbackUrls && Array.isArray(config.fallbackUrls) && fallbackIndex < config.fallbackUrls.length) {
                console.log(`[RSS] Trying fallback URL #${fallbackIndex + 1}: ${config.fallbackUrls[fallbackIndex]}`);
                currentUrl = config.fallbackUrls[fallbackIndex];
                fallbackIndex++;
              }
              // Try single fallback URL if available and not already tried
              else if (config.fallbackUrl && currentUrl !== config.fallbackUrl) {
                console.log(`[RSS] Trying fallback URL for ${url}: ${config.fallbackUrl}`);
                currentUrl = config.fallbackUrl;
              } 
              // Otherwise wait before retrying the same URL
              else if (attempt < retries) {
                // Wait before retrying (exponential backoff)
                const delay = 1000 * Math.pow(2, attempt);
                console.log(`[RSS] Waiting ${delay}ms before retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          
          throw new Error(`Failed to fetch RSS feed after ${attempts} attempts. Last error: ${lastError.message}`);
        };
        
        const response = await fetchWithRetry(feedUrl);
        console.log(`[RSS] Successfully fetched ${feedUrl}`);
        
        return res.json({ 
          success: true, 
          rawContent: true,
          feed: { 
            items: [], 
            feedUrl,
            rawXml: response.data 
          } 
        });
      } catch (axiosError) {
        console.error(`[RSS] All fetch attempts failed for: ${feedUrl}`, axiosError.message);
        return res.status(500).json({ 
          error: 'Failed to fetch feed after multiple attempts', 
          details: axiosError.message,
          url: feedUrl
        });
      }
    }
    
    // Try parsing with RSS parser
    try {
      console.log(`[RSS] Attempting to parse ${feedUrl} with RSS parser`);
      const feed = await parser.parseURL(feedUrl);
      console.log(`[RSS] Successfully parsed ${feedUrl}, found ${feed.items?.length || 0} items`);
      return res.json({ success: true, feed });
    } catch (parseError) {
      console.error(`[RSS] Parser error for ${feedUrl}:`, {
        message: parseError.message,
        code: parseError.code,
        response: parseError.response?.status,
        data: parseError.response?.data?.substring(0, 200)
      });
      return res.status(500).json({ 
        error: 'Failed to parse feed', 
        details: parseError.message,
        url: feedUrl
      });
    }
  } catch (error) {
    console.error('[RSS] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Generic proxy endpoint
app.get('/api/proxy', async (req, res) => {
  try {
    const target = req.query.target;
    
    if (!target) {
      return res.status(400).json({ error: 'Missing target URL parameter' });
    }
    
    try {
      // Validate URL
      new URL(target);
    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid target URL' });
    }
    
    try {
      const response = await axios.get(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        timeout: 20000
      });
      
      // Forward the response
      return res.json(response.data);
    } catch (axiosError) {
      console.error(`Proxy request failed for: ${target}`, axiosError.message);
      return res.status(500).json({ 
        error: 'Proxy request failed', 
        details: axiosError.message,
        stack: process.env.NODE_ENV === 'development' ? axiosError.stack : undefined
      });
    }
  } catch (error) {
    console.error('Error in proxy endpoint:', error.message);
    return res.status(500).json({ 
      error: 'Server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// RSS proxy endpoint
app.get('/api/proxy/rss', async (req, res) => {
  const feedUrl = req.query.url;
  
  if (!feedUrl) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  console.log(`Proxy request for RSS feed: ${feedUrl}`);
  const config = getFeedConfig(feedUrl);
  
  // Function to attempt fetch with retry logic
  const fetchWithRetry = async (url, retries = 2) => {
    let lastError;
    let currentUrl = url;
    const maxRetries = config.maxRetries || retries;
    let fallbackIndex = 0;
    let attempts = 0;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts++;
      try {
        if (config.useDirectFetch) {
          // Use direct axios fetch for problematic feeds
          console.log(`Attempt ${attempt + 1}/${maxRetries + 1} for ${currentUrl}`);
          const response = await axios.get(currentUrl, {
            headers: config.headers,
            timeout: config.timeout,
            responseType: 'text'
          });
          
          // Handle redirects manually if needed
          if (response.status === 301 || response.status === 302) {
            if (response.headers.location) {
              console.log(`Following redirect from ${currentUrl} to ${response.headers.location}`);
              currentUrl = response.headers.location;
              continue; // Try the new URL
            }
          }
          
          if (response.status !== 200) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
          return response.data;
        } else {
          // Use RSS parser for normal feeds
          const parser = new Parser({
            headers: config.headers,
            timeout: config.timeout,
            customFields: {
              item: [
                ['media:content', 'media'],
                ['media:group', 'mediaGroup'],
                ['content:encoded', 'contentEncoded']
              ]
            }
          });
          
          const feed = await parser.parseURL(currentUrl);
          return feed;
        }
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        
        // Log detailed error information
        console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed for ${currentUrl}: ${error.message}`);
        if (status) {
          console.error(`Server returned status code: ${status}`);
        }
        
        // Special handling for common error types
        if (status === 404) {
          console.error(`Feed not found (404) at URL: ${currentUrl}`);
        } else if (status === 403) {
          console.error(`Access denied (403) for URL: ${currentUrl}`);
        } else if (error.code === 'ECONNABORTED') {
          console.error(`Connection timed out for URL: ${currentUrl}`);
        } else if (error.code === 'ENOTFOUND') {
          console.error(`Host not found for URL: ${currentUrl}`);
        }
        
        // Check for multiple fallback URLs
        if (config.fallbackUrls && Array.isArray(config.fallbackUrls) && fallbackIndex < config.fallbackUrls.length) {
          console.log(`Trying fallback URL #${fallbackIndex + 1}: ${config.fallbackUrls[fallbackIndex]}`);
          currentUrl = config.fallbackUrls[fallbackIndex];
          fallbackIndex++;
        }
        // Try single fallback URL if available and not already tried
        else if (config.fallbackUrl && currentUrl !== config.fallbackUrl) {
          console.log(`Trying fallback URL for ${url}: ${config.fallbackUrl}`);
          currentUrl = config.fallbackUrl;
        } 
        // Otherwise wait before retrying the same URL
        else if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = 1000 * Math.pow(2, attempt);
          console.log(`Waiting ${delay}ms before retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed - create a detailed error
    const errorDetails = {
      url: url,
      attempts: attempts,
      lastAttemptedUrl: currentUrl,
      message: lastError.message,
      code: lastError.code || 'UNKNOWN',
      responseStatus: lastError.response?.status,
      responseData: lastError.response?.data
    };
    
    // Log the full error details for server debugging
    console.error(`All ${attempts} fetch attempts failed:`, errorDetails);
    
    // Throw with comprehensive error information
    throw new Error(`Failed to fetch RSS feed after ${attempts} attempts: ${lastError.message}`);
  };

  try {
    const result = await fetchWithRetry(feedUrl);
    
    // If we got direct XML response, parse it
    if (typeof result === 'string') {
      try {
        const parsedFeed = await parseRawRssXml(result);
        return res.json(parsedFeed);
      } catch (parseError) {
        console.error(`Error parsing RSS XML for ${feedUrl}: ${parseError.message}`);
        return res.status(500).json({
          error: 'Failed to parse RSS feed',
          details: parseError.message,
          url: feedUrl
        });
      }
    }
    
    // Otherwise return the already-parsed feed
    return res.json(result);
    
  } catch (error) {
    const errorDetails = {
      message: error.message,
      code: error.code,
      url: feedUrl,
      source: getDomainFromUrl(feedUrl)
    };
    
    console.error(`Failed to fetch RSS feed from ${feedUrl}:`, errorDetails);
    
    // Provide specific error messages based on error types
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Request timed out',
        details: errorDetails
      });
    } else if (error.response && error.response.status) {
      return res.status(error.response.status).json({
        error: `Source returned ${error.response.status}`,
        details: errorDetails
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch RSS feed',
        details: errorDetails
      });
    }
  }
});

// Helper function to extract domain from URL for better error reporting
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return url; // Return the original if parsing fails
  }
}

// Helper functions for RSS proxy
function parseRawRssXml(xmlContent) {
  return new Promise((resolve, reject) => {
    const parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media'],
          ['media:group', 'mediaGroup'],
          ['content:encoded', 'contentEncoded']
        ]
      }
    });
    
    parser.parseString(xmlContent, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Serve any static files
  app.use(express.static(path.join(__dirname, 'build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 