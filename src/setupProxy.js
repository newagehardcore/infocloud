const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

module.exports = function(app) {
  // Handle RSS feed requests
  app.use('/api/rss-feed', async (req, res) => {
    try {
      const feedUrl = req.query.url;
      
      if (!feedUrl) {
        return res.status(400).json({ error: 'Missing feed URL parameter' });
      }
      
      console.log(`Backend proxy fetching RSS feed: ${feedUrl}`);
      
      try {
        // Attempt to fetch and parse the RSS feed
        const feed = await parser.parseURL(feedUrl);
        return res.json({ success: true, feed });
      } catch (error) {
        console.error(`Error parsing RSS feed: ${feedUrl}`, error);
        
        // If parser fails, try a direct fetch as a fallback
        try {
          const response = await axios.get(feedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; InfoCloud/1.0)',
              'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            timeout: 10000
          });
          
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
          console.error(`Direct fetch also failed for: ${feedUrl}`, axiosError);
          return res.status(500).json({ 
            error: 'Failed to fetch feed', 
            details: axiosError.message,
            url: feedUrl
          });
        }
      }
    } catch (error) {
      console.error('Error in RSS proxy:', error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  });
  
  // Add proxy for other APIs that might have CORS issues
  app.use('/api/proxy', createProxyMiddleware({
    target: '', // Target will be set by the request
    changeOrigin: true,
    pathRewrite: function (path, req) {
      // Extract target from query params
      const target = req.query.target;
      if (!target) {
        throw new Error('Missing target parameter');
      }
      
      try {
        // Return the full target URL
        return new URL(target).pathname;
      } catch (error) {
        console.error('Invalid target URL:', target);
        throw new Error('Invalid target URL');
      }
    },
    router: function(req) {
      // Get target from query params
      const target = req.query.target;
      if (!target) {
        throw new Error('Missing target parameter');
      }
      
      try {
        // Extract origin from the target URL
        const url = new URL(target);
        return `${url.protocol}//${url.host}`;
      } catch (error) {
        console.error('Invalid target URL:', target);
        throw new Error('Invalid target URL');
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      // Set necessary headers for the request
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; InfoCloud/1.0)');
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    }
  }));
}; 