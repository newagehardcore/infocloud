const axios = require('axios');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs if needed
const { getDB } = require('../config/db');
const { extractKeywords } = require('../utils/keywordExtractor'); // Import keyword extractor
const { PoliticalBias } = require('../utils/biasAnalyzer');
const { processNewsKeywords } = require('./wordProcessingService');

const parser = new Parser();

// Define constants for bias and category based on NewsItem model structure
// (Replace string literals if you prefer importing constants from a shared file)
const NewsCategory = {
  World: 'World',
  Politics: 'Politics',
  US: 'US',
  All: 'All', // Or a more specific default?
  Finance: 'Finance',
  Tech: 'Tech',
  Entertainment: 'Entertainment',
  Sports: 'Sports',
  Science: 'Science',
  Health: 'Health',
  News: 'News', // Ensure 'News' is defined here
  Environment: 'Environment',
  Music: 'Music',
  Law: 'Law',
  AI: 'AI',
  Space: 'Space',
  Fashion: 'Fashion',
  Art: 'Art'
  // Add other categories from frontend enum if needed for consistency
};

// Track items per bias category
let biasItemCounts = {
  [PoliticalBias.Left]: 0,
  [PoliticalBias.Liberal]: 0,
  [PoliticalBias.Centrist]: 0,
  [PoliticalBias.Conservative]: 0,
  [PoliticalBias.Right]: 0,
  [PoliticalBias.Unknown]: 0
};

// Reset bias counts at the start of each fetch cycle
const resetBiasCounts = () => {
  biasItemCounts = {
    [PoliticalBias.Left]: 0,
    [PoliticalBias.Liberal]: 0,
    [PoliticalBias.Centrist]: 0,
    [PoliticalBias.Conservative]: 0,
    [PoliticalBias.Right]: 0,
    [PoliticalBias.Unknown]: 0
  };
};

// Add these constants at the top with other constants
const MAX_ITEMS_PER_BIAS = 50; // Maximum number of items to keep per bias category
const BIAS_DISTRIBUTION_TARGET = {
  [PoliticalBias.Left]: 20,    // 20% left
  [PoliticalBias.Liberal]: 20, // 20% liberal
  [PoliticalBias.Centrist]: 20, // 20% centrist
  [PoliticalBias.Conservative]: 20, // 20% conservative
  [PoliticalBias.Right]: 20,   // 20% right
};

const rssSources = [
  // Existing Sources (Bias/URL potentially updated) + New Sources + Researched Additions
  { name: "ABA Journal", url: "https://www.abajournal.com/web_rss_feed", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "ABC News - Health", url: "https://abcnews.go.com/abcnews/healthheadlines", bias: PoliticalBias.Liberal, category: NewsCategory.Health }, // Added
  { name: "ABC News - Politics", url: "https://abcnews.go.com/abcnews/politicsheadlines", bias: PoliticalBias.Liberal, category: NewsCategory.Politics }, // Added
  { name: "ABC News - Technology", url: "https://abcnews.go.com/abcnews/technologyheadlines", bias: PoliticalBias.Liberal, category: NewsCategory.Tech }, // Added
  { name: "ABC News - US", url: "https://abcnews.go.com/abcnews/usheadlines", bias: PoliticalBias.Liberal, category: NewsCategory.US }, // Added
  { name: "ABC News - World", url: "https://abcnews.go.com/abcnews/internationalheadlines", bias: PoliticalBias.Liberal, category: NewsCategory.World }, // Added
  { name: "Above the Law", url: "https://abovethelaw.com/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Law }, // Added
  { name: "AI News", url: "https://www.artificialintelligence-news.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", bias: PoliticalBias.Liberal, category: NewsCategory.World },
  { name: "All Music", url: "https://www.allmusic.com/rss/blog.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Music }, // Added
  { name: "Analytics Vidhya", url: "https://feeds.feedburner.com/AnalyticsVidhya", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "AP News", url: "https://apnews.com/hub/ap-top-news/rss", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "AP News - Health", url: "https://apnews.com/hub/health/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Health }, // Added
  { name: "AP News - Science", url: "https://apnews.com/hub/science/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Science }, // Added
  { name: "AP News - Sports", url: "https://apnews.com/hub/sports/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Sports }, // Added
  { name: "AP News - Tech", url: "https://apnews.com/hub/technology/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech }, // Added
  { name: "Ars Technica", url: "http://feeds.arstechnica.com/arstechnica/index", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Ars Technica - AI", url: "https://feeds.arstechnica.com/arstechnica/artificial-intelligence", bias: PoliticalBias.Centrist, category: NewsCategory.AI }, // Added
  { name: "Ars Technica - Science", url: "https://feeds.arstechnica.com/arstechnica/science", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "Ars Technica - Space", url: "https://arstechnica.com/science/space/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Space }, // Added
  { name: "Art Observed", url: "http://artobserved.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Artforum", url: "https://www.artforum.com/rss.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Artnet News", url: "https://news.artnet.com/feed", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Artnews", url: "https://www.artnews.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Artsy News", url: "https://www.artsy.net/rss/news", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Astronomy Magazine", url: "https://astronomy.com/rss/news", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "Axios", url: "https://api.axios.com/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "Axios - Science", url: "https://api.axios.com/feed/science", bias: PoliticalBias.Liberal, category: NewsCategory.Science }, // Added
  { name: "Axios - Space", url: "https://api.axios.com/feed/space", bias: PoliticalBias.Liberal, category: NewsCategory.Space }, // Added
  { name: "Axios - Technology", url: "https://api.axios.com/feed/technology", bias: PoliticalBias.Liberal, category: NewsCategory.Tech }, // Added
  { name: "BBC News", url: "http://feeds.bbci.co.uk/news/rss.xml", bias: PoliticalBias.Centrist, category: NewsCategory.World }, // Bias: Center -> Centrist
  { name: "BBC News - Health", url: "http://feeds.bbci.co.uk/news/health/rss.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "BBC News - Science & Environment", url: "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added (Covers Env too)
  { name: "BBC News - Technology", url: "http://feeds.bbci.co.uk/news/technology/rss.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Billboard", url: "https://www.billboard.com/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Music }, // Added
  { name: "Bleacher Report", url: "https://bleacherreport.com/articles/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "Bloomberg News - Politics", url: "https://feeds.bloomberg.com/politics/news.rss", bias: PoliticalBias.Liberal, category: NewsCategory.Politics }, // Updated Bias: Lean Left -> Liberal, Clarified Category
  { name: "Bloomberg News - Technology", url: "https://feeds.bloomberg.com/technology/news.rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech }, // Added
  { name: "Boing Boing", url: "https://boingboing.net/feed", bias: PoliticalBias.Left, category: NewsCategory.Tech }, // Added (More general culture/tech)
  { name: "Breitbart News", url: "http://feeds.breitbart.com/breitbart", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "Business Insider", url: "https://www.businessinsider.com/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Finance },
  { name: "Business of Fashion (BoF)", url: "https://www.businessoffashion.com/rss/articles", bias: PoliticalBias.Centrist, category: NewsCategory.Fashion }, // Added
  { name: "BuzzFeed News", url: "https://www.buzzfeed.com/world.xml", bias: PoliticalBias.Left, category: NewsCategory.News }, // Bias: Left -> Left
  { name: "CBN", url: "https://www1.cbn.com/rss-feeds/cbn-news-finance.xml", bias: PoliticalBias.Right, category: NewsCategory.Finance }, // Added, Bias: Right -> Right
  { name: "CBS News", url: "https://www.cbsnews.com/latest/rss/main", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "CBS News - Health", url: "https://www.cbsnews.com/latest/rss/health", bias: PoliticalBias.Liberal, category: NewsCategory.Health }, // Added
  { name: "CBS News - Science", url: "https://www.cbsnews.com/latest/rss/science", bias: PoliticalBias.Liberal, category: NewsCategory.Science }, // Added
  { name: "CBS News - Tech", url: "https://www.cbsnews.com/latest/rss/technology", bias: PoliticalBias.Liberal, category: NewsCategory.Tech }, // Added
  { name: "CBS Sports", url: "https://rss.cbssports.com/rss/headlines/", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "CDC Newsroom", url: "https://tools.cdc.gov/api/v2/resources/media/rss/channel/Newsroom%20Releases.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Christian Science Monitor", url: "https://rss.csmonitor.com/feeds/usa", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Bias: Center -> Centrist
  { name: "Climate Central", url: "https://www.climatecentral.org/news/rss", bias: PoliticalBias.Centrist, category: NewsCategory.Environment }, // Added
  { name: "CNET News", url: "https://www.cnet.com/rss/news/", bias: PoliticalBias.Liberal, category: NewsCategory.Tech }, // Added
  { name: "CNN", url: "http://rss.cnn.com/rss/cnn_topstories.rss", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "CNN - Health", url: "http://rss.cnn.com/rss/cnn_health.rss", bias: PoliticalBias.Liberal, category: NewsCategory.Health },
  { name: "CNN - Politics", url: "http://rss.cnn.com/rss/cnn_allpolitics.rss", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "CNN - Tech", url: "http://rss.cnn.com/rss/cnn_tech.rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "Colossal", url: "https://www.thisiscolossal.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Consequence of Sound", url: "https://consequence.net/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Music }, // Added
  { name: "Daily Beast", url: "http://feeds.thedailybeast.com/summary/latest", bias: PoliticalBias.Left, category: NewsCategory.News }, // Added, Bias: Left -> Left
  { name: "Daily Caller", url: "http://feeds.feedburner.com/dailycaller", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Added, Bias: Right -> Right
  { name: "Daily Mail", url: "https://www.dailymail.co.uk/news/index.rss", bias: PoliticalBias.Right, category: NewsCategory.News }, // Updated Bias: Right -> Right
  { name: "Daily Wire", url: "https://www.dailywire.com/feeds/rss.xml", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "Deadline", url: "https://deadline.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Entertainment }, // Added
  { name: "Deadspin", url: "https://deadspin.com/rss", bias: PoliticalBias.Left, category: NewsCategory.Sports }, // Added
  { name: "DeepMind Blog", url: "https://deepmind.googleblog.com/feeds/posts/default", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "Democracy Now", url: "https://www.democracynow.org/democracynow.rss", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "Discover Magazine", url: "http://feeds.discovermagazine.com/discovermagazine", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "Drudge Report", url: "http://drudgereportfeed.com/", bias: PoliticalBias.Right, category: NewsCategory.News }, // Added (Aggregator, Right-leaning)
  { name: "E! News", url: "https://www.eonline.com/feeds/rss/news", bias: PoliticalBias.Centrist, category: NewsCategory.Entertainment }, // Added
  { name: "Earth.com", url: "https://www.earth.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Environment }, // Added
  { name: "Elle", url: "https://www.elle.com/rss/all.xml/", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "Entertainment Weekly (EW.com)", url: "https://ew.com/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Entertainment },
  { name: "Environmental Health News", url: "https://www.ehn.org/feeds/original_reporting/feed.rss", bias: PoliticalBias.Liberal, category: NewsCategory.Environment },
  { name: "EPA News Releases", url: "https://www.epa.gov/newsreleases/search/rss", bias: PoliticalBias.Unknown, category: NewsCategory.Environment }, // Added
  { name: "ESA News", url: "https://www.esa.int/rssfeed/ESA_Highlights", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "ESPN", url: "https://www.espn.com/espn/rss/news", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "Financial Times", url: "https://www.ft.com/?format=rss", bias: PoliticalBias.Centrist, category: NewsCategory.Finance }, // Bias: Center -> Centrist
  { name: "FindLaw Legal News", url: "https://news.findlaw.com/legalnews/feeds/industry/legal.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "Forbes", url: "https://www.forbes.com/real-time/feed2/", bias: PoliticalBias.Centrist, category: NewsCategory.Finance }, // Added, Bias: Center -> Centrist
  { name: "Forbes - Tech", url: "https://www.forbes.com/technology/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Fox Business", url: "http://feeds.foxbusiness.com/foxbusiness/latest", bias: PoliticalBias.Conservative, category: NewsCategory.Finance }, // Added, Bias: Lean Right -> Conservative
  { name: "Fox News", url: "http://feeds.foxnews.com/foxnews/latest", bias: PoliticalBias.Right, category: NewsCategory.News }, // Bias: Right -> Right
  { name: "Fox News - Health", url: "http://feeds.foxnews.com/foxnews/health", bias: PoliticalBias.Right, category: NewsCategory.Health }, // Added
  { name: "Fox News - Politics", url: "http://feeds.foxnews.com/foxnews/politics", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Added
  { name: "Fox News - Science", url: "http://feeds.foxnews.com/foxnews/science", bias: PoliticalBias.Right, category: NewsCategory.Science }, // Added
  { name: "Fox News - Tech", url: "http://feeds.foxnews.com/foxnews/tech", bias: PoliticalBias.Right, category: NewsCategory.Tech }, // Added
  { name: "Fox Sports", url: "https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyGKCfxBagJG9b8pqLyndmvo7UU", bias: PoliticalBias.Conservative, category: NewsCategory.Sports }, // Added
  { name: "Frieze", url: "https://www.frieze.com/rss.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Gizmodo", url: "https://gizmodo.com/rss", bias: PoliticalBias.Left, category: NewsCategory.Tech }, // Added
  { name: "Google AI Blog", url: "https://ai.googleblog.com/feeds/posts/default", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "Google News - Top Stories", url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", bias: PoliticalBias.Unknown, category: NewsCategory.News }, // Added (Aggregator)
  { name: "Grist", url: "https://grist.org/feed/", bias: PoliticalBias.Left, category: NewsCategory.Environment }, // Added
  { name: "Ground News", url: "https://ground.news/feeds/rss/all", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Bias: Center -> Centrist
  { name: "GQ", url: "https://www.gq.com/feed/story/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "Harper's Bazaar", url: "https://www.harpersbazaar.com/rss/all.xml/", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "Harvard Health Publishing", url: "https://www.health.harvard.edu/rss/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Healthline", url: "https://www.healthline.com/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Fashion }, // Added
  { name: "Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Entertainment },
  { name: "HuffPost", url: "https://www.huffpost.com/section/front-page/feed", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "Hypebeast Fashion", url: "https://hypebeast.com/fashion/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Fashion }, // Added
  { name: "Hypebeast Music", url: "https://hypebeast.com/music/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Music }, // Added
  { name: "Hyperallergic", url: "https://hyperallergic.com/feed/", bias: PoliticalBias.Left, category: NewsCategory.Art }, // Added
  { name: "IGN", url: "https://feeds.ign.com/ign/all", bias: PoliticalBias.Centrist, category: NewsCategory.Entertainment }, // Added (Gaming focus)
  { name: "IJR (Independent Journal Review)", url: "https://ijr.com/feed/", bias: PoliticalBias.Right, category: NewsCategory.News }, // Added, Bias: Right -> Right
  { name: "InsideClimate News", url: "https://insideclimatenews.org/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Environment }, // Added
  { name: "Jacobin", url: "https://jacobin.com/feed/", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "Jurist", url: "https://www.jurist.org/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "Just the News", url: "https://justthenews.com/rss.xml", bias: PoliticalBias.Conservative, category: NewsCategory.News }, // Added, Bias: Lean Right -> Conservative
  { name: "Justia News", url: "https://news.justia.com/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "Juxtapoz", url: "https://www.juxtapoz.com/news/?format=feed&type=rss", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "Kaiser Health News (KHN)", url: "https://khn.org/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "KDnuggets", url: "https://www.kdnuggets.com/feed", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "Kotaku", url: "https://kotaku.com/rss", bias: PoliticalBias.Left, category: NewsCategory.Entertainment }, // Added (Gaming)
  { name: "Law.com", url: "https://www.law.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "Law360", url: "https://www.law360.com/rss", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added (May require subscription for full access)
  { name: "Lifehacker", url: "https://lifehacker.com/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "Live Science", url: "https://www.livescience.com/feeds/all", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "Machine Learning Mastery", url: "https://machinelearningmastery.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "MarketWatch", url: "http://feeds.marketwatch.com/marketwatch/topstories/", bias: PoliticalBias.Centrist, category: NewsCategory.Finance }, // Added
  { name: "Mashable", url: "https://mashable.com/feeds/rss/all", bias: PoliticalBias.Left, category: NewsCategory.News }, // Added (General tech/culture)
  { name: "Mashable - Tech", url: "https://mashable.com/tech/rss/", bias: PoliticalBias.Left, category: NewsCategory.Tech }, // Added
  { name: "Mayo Clinic News Network", url: "https://newsnetwork.mayoclinic.org/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Medical News Today", url: "https://rss.medicalnewstoday.com/featured", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Medscape", url: "https://www.medscape.com/rss/public/medscape/features", bias: PoliticalBias.Unknown, category: NewsCategory.Health }, // Added (Requires signup?)
  { name: "MIT Technology Review - AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.AI }, // Added
  { name: "Mixmag", url: "https://mixmag.net/rss", bias: PoliticalBias.Unknown, category: NewsCategory.Music }, // Added
  { name: "Mongabay", url: "https://news.mongabay.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Environment }, // Added
  { name: "Mother Jones", url: "https://www.motherjones.com/feed/", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "MSNBC", url: "http://www.msnbc.com/feeds/latest", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "NASA Breaking News", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "NASA Science", url: "https://science.nasa.gov/rss.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "National Geographic - Environment", url: "https://www.nationalgeographic.com/environment/rss-feed.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Environment }, // Added
  { name: "National Geographic - Science", url: "https://www.nationalgeographic.com/science/rss-feed.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "National Law Journal", url: "https://www.law.com/nationallawjournal/feed", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "National Review", url: "https://www.nationalreview.com/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "Nature", url: "https://www.nature.com/nature.rss", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "NBC News - Health", url: "http://feeds.nbcnews.com/nbcnews/public/health", bias: PoliticalBias.Liberal, category: NewsCategory.Health },
  { name: "NBC News - Politics", url: "http://feeds.nbcnews.com/nbcnews/public/politics", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "NBC News - Tech", url: "http://feeds.nbcnews.com/nbcnews/public/technologyscience", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "NBC News - US", url: "http://feeds.nbcnews.com/nbcnews/public/news", bias: PoliticalBias.Liberal, category: NewsCategory.US },
  { name: "NBC News - World", url: "http://feeds.nbcnews.com/nbcnews/public/world", bias: PoliticalBias.Liberal, category: NewsCategory.World },
  { name: "NBC Sports", url: "https://sports.nbcsports.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "New Scientist", url: "https://www.newscientist.com/feed/home/", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "NewsNation", url: "https://www.newsnationnow.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Added, Bias: Center -> Centrist
  { name: "Newsweek", url: "https://www.newsweek.com/rss", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Updated Bias: Center -> Centrist
  { name: "NIH News", url: "https://www.nih.gov/news-events/news-releases/feed.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "NME", url: "https://www.nme.com/feed", bias: PoliticalBias.Liberal, category: NewsCategory.Music },
  { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "NPR - Health", url: "https://feeds.npr.org/1007/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Health },
  { name: "NPR - Politics", url: "https://feeds.npr.org/1014/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "NPR - Science", url: "https://feeds.npr.org/1007/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Science },
  { name: "NPR - Technology", url: "https://feeds.npr.org/1019/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "NY Post News", url: "https://nypost.com/feed/", bias: PoliticalBias.Conservative, category: NewsCategory.News }, // Updated Bias: Lean Right -> Conservative
  { name: "NY Post Opinion", url: "https://nypost.com/opinion/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Added, Bias: Right -> Right
  { name: "NYT - Arts", url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Art },
  { name: "NYT - Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Finance },
  { name: "NYT - Health", url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Health },
  { name: "NYT - Home Page", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "NYT - Music", url: "https://rss.nytimes.com/services/xml/rss/nyt/Music.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Music },
  { name: "NYT - Opinion", url: "https://www.nytimes.com/svc/collections/v1/publish/www.nytimes.com/column/opinion-today/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "NYT - Politics", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "NYT - Science", url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Science },
  { name: "NYT - Space & Cosmos", url: "https://rss.nytimes.com/services/xml/rss/nyt/Space.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Space },
  { name: "NYT - Sports", url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Sports },
  { name: "NYT - Style", url: "https://rss.nytimes.com/services/xml/rss/nyt/FashionandStyle.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "NYT - Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "NYT - World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", bias: PoliticalBias.Liberal, category: NewsCategory.World },
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss/", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added
  { name: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/", bias: PoliticalBias.Centrist, category: NewsCategory.Entertainment }, // Added (Gaming)
  { name: "People Magazine", url: "https://people.com/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Entertainment },
  { name: "Phys.org", url: "https://phys.org/rss-feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "Phys.org - Space", url: "https://phys.org/rss-feed/space-news/", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "Pitchfork", url: "https://pitchfork.com/rss/news/", bias: PoliticalBias.Left, category: NewsCategory.Music }, // Added
  { name: "Planetary Society Blog", url: "https://www.planetary.org/rss/blog", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "Politico", url: "https://rss.politico.com/politico-news.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Entertainment },
  { name: "Popular Mechanics", url: "https://www.popularmechanics.com/rss/", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "Popular Science", url: "https://www.popsci.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "ProPublica", url: "http://feeds.propublica.org/propublica/main", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "Quanta Magazine", url: "https://api.quantamagazine.org/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "Reason", url: "https://reason.com/feed/", bias: PoliticalBias.Conservative, category: NewsCategory.Politics }, // Updated Bias: Lean Right -> Conservative (Libertarian often classed here)
  { name: "Recode", url: "https://www.vox.com/rss/recode/index.xml", bias: PoliticalBias.Left, category: NewsCategory.Tech }, // Added (Part of Vox)
  { name: "Refinery29 - Fashion", url: "https://www.refinery29.com/en-us/fashion/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "Resident Advisor", url: "https://ra.co/xml/news.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Music }, // Added
  { name: "Reuters", url: "http://feeds.reuters.com/reuters/topNews", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Bias: Center -> Centrist
  { name: "Reuters - Arts", url: "https://feeds.reuters.com/reuters/entertainment", bias: PoliticalBias.Centrist, category: NewsCategory.Art }, // Added (Entertainment focuses broader)
  { name: "Reuters - Business", url: "https://feeds.reuters.com/reuters/businessNews", bias: PoliticalBias.Centrist, category: NewsCategory.Finance }, // Added
  { name: "Reuters - Environment", url: "https://feeds.reuters.com/reuters/environment", bias: PoliticalBias.Centrist, category: NewsCategory.Environment }, // Added
  { name: "Reuters - Health", url: "https://feeds.reuters.com/reuters/healthNews", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Reuters - Legal", url: "https://feeds.feedblitz.com/reuters/legal", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "Reuters - Politics", url: "https://feeds.reuters.com/Reuters/PoliticsNews", bias: PoliticalBias.Centrist, category: NewsCategory.Politics }, // Added
  { name: "Reuters - Science", url: "https://feeds.reuters.com/reuters/scienceNews", bias: PoliticalBias.Centrist, category: NewsCategory.Science }, // Added
  { name: "Reuters - Sports", url: "https://feeds.reuters.com/reuters/sportsNews", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "Reuters - Tech", url: "https://feeds.reuters.com/reuters/technologyNews", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Reuters - US", url: "https://feeds.reuters.com/Reuters/domesticNews", bias: PoliticalBias.Centrist, category: NewsCategory.US }, // Added
  { name: "Reuters - World", url: "https://feeds.reuters.com/Reuters/worldNews", bias: PoliticalBias.Centrist, category: NewsCategory.World }, // Added
  { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", bias: PoliticalBias.Left, category: NewsCategory.Entertainment }, // Added (General)
  { name: "Rolling Stone - Music", url: "https://www.rollingstone.com/music/feed/", bias: PoliticalBias.Left, category: NewsCategory.Music }, // Added
  { name: "Science Magazine", url: "https://www.sciencemag.org/rss/news_current.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/all.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "Scientific American", url: "http://rss.sciam.com/ScientificAmerican-Global", bias: PoliticalBias.Liberal, category: NewsCategory.Science },
  { name: "SCOTUSblog", url: "https://www.scotusblog.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Law }, // Added
  { name: "Semafor", url: "https://www.semafor.com/feed", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "SI.com (Sports Illustrated)", url: "https://www.si.com/.rss/full/news", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "Sky & Telescope", url: "https://skyandtelescope.org/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "Sky News - Tech", url: "https://feeds.skynews.com/feeds/rss/technology.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Sky News - UK", url: "https://feeds.skynews.com/feeds/rss/uk.xml", bias: PoliticalBias.Centrist, category: NewsCategory.World }, // Added (UK focus)
  { name: "Sky News - World", url: "https://feeds.skynews.com/feeds/rss/world.xml", bias: PoliticalBias.Centrist, category: NewsCategory.World }, // Added
  { name: "Sky Sports News", url: "https://www.skysports.com/rss/12040", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added
  { name: "Slate", url: "https://slate.com/feeds/all.rss", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "Smithsonian Magazine - Science", url: "https://www.smithsonianmag.com/rss/science-nature/", bias: PoliticalBias.Unknown, category: NewsCategory.Science }, // Added
  { name: "Space.com", url: "https://www.space.com/feeds/all", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "SpaceNews", url: "https://spacenews.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "STAT News", url: "https://www.statnews.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Health }, // Added
  { name: "Stereogum", url: "https://www.stereogum.com/feed/", bias: PoliticalBias.Liberal, category: NewsCategory.Music },
  { name: "Straight Arrow News", url: "https://straightarrownews.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Added, Bias: Center -> Centrist
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Techdirt", url: "https://www.techdirt.com/techdirt_rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "Techmeme", url: "https://www.techmeme.com/feed.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Tech }, // Added (Aggregator)
  { name: "TechRadar", url: "https://www.techradar.com/rss", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "The American Conservative", url: "https://www.theamericanconservative.com/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Added, Bias: Right -> Right
  { name: "The American Spectator", url: "https://spectator.org/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Added, Bias: Right -> Right
  { name: "The Art Newspaper", url: "https://www.theartnewspaper.com/rss.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Art }, // Added
  { name: "The Athletic", url: "https://theathletic.com/rss/us", bias: PoliticalBias.Centrist, category: NewsCategory.Sports }, // Added (Subscription required)
  { name: "The Atlantic", url: "https://www.theatlantic.com/feed/channel/news/", bias: PoliticalBias.Left, category: NewsCategory.News }, // Updated Bias: Left -> Left
  { name: "The Blaze", url: "https://www.theblaze.com/feeds/feed.rss", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "The Cut - Fashion", url: "https://www.thecut.com/tags/fashion/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "The Daily Signal", url: "https://www.dailysignal.com/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "The Dispatch", url: "https://thedispatch.com/feed/", bias: PoliticalBias.Conservative, category: NewsCategory.Politics }, // Added, Bias: Lean Right -> Conservative
  { name: "The Economist", url: "https://www.economist.com/united-states/rss.xml", bias: PoliticalBias.Liberal, category: NewsCategory.Finance },
  { name: "The Epoch Times", url: "https://www.theepochtimes.com/feed", bias: PoliticalBias.Conservative, category: NewsCategory.News }, // Added, Bias: Lean Right -> Conservative
  { name: "The Federalist", url: "http://thefederalist.com/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Added, Bias: Right -> Right
  { name: "The Free Press", url: "https://www.thefp.com/feed", bias: PoliticalBias.Conservative, category: NewsCategory.News }, // Added, Bias: Lean Right -> Conservative
  { name: "The Grayzone", url: "https://thegrayzone.com/feed/", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "The Guardian - Environment", url: "https://www.theguardian.com/environment/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Environment },
  { name: "The Guardian - Music", url: "https://www.theguardian.com/music/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Music },
  { name: "The Guardian - Science", url: "https://www.theguardian.com/science/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Science },
  { name: "The Guardian - Sports", url: "https://www.theguardian.com/sport/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Sports },
  { name: "The Guardian - Tech", url: "https://www.theguardian.com/uk/technology/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "The Guardian - World", url: "https://www.theguardian.com/world/rss", bias: PoliticalBias.Liberal, category: NewsCategory.World },
  { name: "The Hill", url: "https://thehill.com/rss/syndicator/19109", bias: PoliticalBias.Centrist, category: NewsCategory.Politics }, // Bias: Center -> Centrist
  { name: "The Intercept", url: "https://theintercept.com/feed/?rss", bias: PoliticalBias.Left, category: NewsCategory.News }, // Added, Bias: Left -> Left
  { name: "The Nation", url: "https://www.thenation.com/feed/content/feed/", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "The New Republic", url: "https://newrepublic.com/feed/main", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "The New Yorker", url: "https://www.newyorker.com/feed/news", bias: PoliticalBias.Left, category: NewsCategory.News }, // Updated Bias: Left -> Left
  { name: "The Onion", url: "https://www.theonion.com/rss", bias: PoliticalBias.Left, category: NewsCategory.Entertainment }, // Added (Satire)
  { name: "The Post Millennial", url: "https://thepostmillennial.com/rss.xml", bias: PoliticalBias.Right, category: NewsCategory.News }, // Added, Bias: Right -> Right
  { name: "The Street", url: "https://www.thestreet.com/static/rss/all-stories.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Finance }, // Added
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", bias: PoliticalBias.Left, category: NewsCategory.Tech }, // Added
  { name: "The Volokh Conspiracy", url: "https://reason.com/volokh/feed/", bias: PoliticalBias.Conservative, category: NewsCategory.Law }, // Added (Libertarian/Conservative)
  { name: "The Week", url: "http://feeds.feedburner.com/theweek/headlines", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Bias: Center -> Centrist
  { name: "TIME", url: "http://feeds.feedburner.com/time/topstories", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "TMZ", url: "https://www.tmz.com/rss.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Entertainment }, // Added
  { name: "Tom's Hardware", url: "https://www.tomshardware.com/feeds/all", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "Towards Data Science", url: "https://towardsdatascience.com/feed", bias: PoliticalBias.Unknown, category: NewsCategory.AI }, // Added (Medium publication)
  { name: "Treehugger", url: "https://www.treehugger.com/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Environment },
  { name: "Truthout", url: "https://truthout.org/latest/feed/", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", bias: PoliticalBias.Centrist, category: NewsCategory.World }, // Added
  { name: "Universe Today", url: "https://www.universetoday.com/feed/", bias: PoliticalBias.Unknown, category: NewsCategory.Space }, // Added
  { name: "USA Today", url: "http://rssfeeds.usatoday.com/usatoday-NewsTopStories", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "USA Today - Sports", url: "http://rssfeeds.usatoday.com/UsatodaycomSports-TopStories", bias: PoliticalBias.Liberal, category: NewsCategory.Sports },
  { name: "Variety", url: "https://variety.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Entertainment }, // Added
  { name: "VentureBeat", url: "http://feeds.feedburner.com/venturebeat/main", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "VentureBeat - AI", url: "https://feeds.feedburner.com/venturebeat/ai", bias: PoliticalBias.Centrist, category: NewsCategory.AI }, // Added
  { name: "Vice News", url: "https://www.vice.com/en/rss", bias: PoliticalBias.Left, category: NewsCategory.News }, // Bias: Left -> Left
  { name: "Vogue", url: "https://www.vogue.com/feed/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Fashion },
  { name: "Vox", url: "https://www.vox.com/rss/index.xml", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "Vulture", url: "https://www.vulture.com/rss.xml", bias: PoliticalBias.Left, category: NewsCategory.Entertainment }, // Added (Part of NY Mag)
  { name: "Washington Examiner", url: "https://www.washingtonexaminer.com/tag/news.rss", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "Washington Free Beacon", url: "https://freebeacon.com/feed/", bias: PoliticalBias.Right, category: NewsCategory.Politics }, // Bias: Right -> Right
  { name: "Washington Post", url: "http://feeds.washingtonpost.com/rss/politics", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "Washington Post - Tech", url: "http://feeds.washingtonpost.com/rss/business/technology", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "Washington Times", url: "https://www.washingtontimes.com/rss/headlines/news/", bias: PoliticalBias.Right, category: NewsCategory.News }, // Bias: Right -> Right
  { name: "WebMD", url: "http://rss.webmd.com/rss/android/news.rss", bias: PoliticalBias.Unknown, category: NewsCategory.Health }, // Added
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml", bias: PoliticalBias.Unknown, category: NewsCategory.Health }, // Added
  { name: "Wired", url: "https://www.wired.com/feed/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "Wired - AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", bias: PoliticalBias.Liberal, category: NewsCategory.AI },
  { name: "Wired - Business", url: "https://www.wired.com/feed/category/business/latest/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Finance },
  { name: "Wired - Culture", url: "https://www.wired.com/feed/category/culture/latest/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Entertainment },
  { name: "Wired - Politics", url: "https://www.wired.com/feed/category/politics/latest/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Politics },
  { name: "Wired - Science", url: "https://www.wired.com/feed/category/science/latest/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Science },
  { name: "Wired - Security", url: "https://www.wired.com/feed/category/security/latest/rss", bias: PoliticalBias.Liberal, category: NewsCategory.Tech },
  { name: "World Socialist Web Site", url: "https://www.wsws.org/en/rss.xml", bias: PoliticalBias.Left, category: NewsCategory.Politics }, // Bias: Left -> Left
  { name: "WSJ - Markets", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Finance }, // Added
  { name: "WSJ - Tech", url: "https://feeds.a.dj.com/rss/RSSWSJD.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "WSJ News", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", bias: PoliticalBias.Centrist, category: NewsCategory.News }, // Updated Bias: Center -> Centrist
  { name: "WSJ Opinion", url: "https://feeds.a.dj.com/rss/RSSOpinion.xml", bias: PoliticalBias.Conservative, category: NewsCategory.Politics }, // Updated Bias: Lean Right -> Conservative
  { name: "WWD (Women's Wear Daily)", url: "https://wwd.com/feed/", bias: PoliticalBias.Centrist, category: NewsCategory.Fashion }, // Added
  { name: "Yahoo Finance", url: "https://finance.yahoo.com/rss/topstories", bias: PoliticalBias.Liberal, category: NewsCategory.Finance },
  { name: "Yahoo News", url: "https://news.yahoo.com/rss/", bias: PoliticalBias.Liberal, category: NewsCategory.News },
  { name: "Yale Environment 360", url: "https://e360.yale.edu/feed", bias: PoliticalBias.Liberal, category: NewsCategory.Environment },
  { name: "ZDNet", url: "https://www.zdnet.com/news/rss.xml", bias: PoliticalBias.Centrist, category: NewsCategory.Tech }, // Added
  { name: "ZeroHedge", url: "https://www.zerohedge.com/feed", bias: PoliticalBias.Conservative, category: NewsCategory.Finance }, // Added, Bias: Lean Right -> Conservative (Often considered Right/Far-Right)
].sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted by name

/**
 * Maps an item from the rss-parser library to our NewsItem structure.
 * @param {object} item - Parsed item from rss-parser.
 * @param {object} feedConfig - The configuration object for the feed this item belongs to.
 * @returns {object | null} A NewsItem object or null if validation fails.
 */
const mapRssItemToNewsItem = (item, feedConfig) => {
  try {
    let title = item.title || '';
    let description = item.contentSnippet || item.content || item.summary || ''; // Prefer contentSnippet
    let url = item.link || '';
    let publishedAt = item.isoDate || item.pubDate || new Date().toISOString(); // Prefer isoDate

    // Basic validation
    if (!title || !url) {
      console.warn(`[RSS] Skipping item due to missing title or URL from ${feedConfig.name}: ${item.title?.substring(0,50)}`);
      return null;
    }

    // Ensure URL is valid
    try {
      const parsedUrl = new URL(url);
      url = parsedUrl.href;
    } catch (e) {
      console.warn(`[RSS] Skipping item due to invalid URL from ${feedConfig.name}: ${url}`);
      return null;
    }

    // Clean up (basic tag removal and whitespace normalization)
    title = title.replace(/<[^>]*>?/gm, '').trim();
    description = description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

    // Truncate description
    const MAX_DESC_LENGTH = 500;
    if (description.length > MAX_DESC_LENGTH) {
      description = description.substring(0, MAX_DESC_LENGTH) + '...';
    }

    // Validate and format date
    try {
      publishedAt = new Date(publishedAt).toISOString();
    } catch (e) {
      publishedAt = new Date().toISOString(); // Fallback
    }

    // Generate a more robust unique ID that includes source and normalized title
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const id = `${feedConfig.name}-${normalizedTitle}-${publishedAt}`;

    const newsItem = {
      id,
      title,
      description,
      url,
      source: {
        name: feedConfig.name,
        bias: feedConfig.bias,
      },
      publishedAt,
      category: feedConfig.category,
      keywords: [], // Keywords extracted later
      createdAt: new Date() // Timestamp of backend processing
    };
    
    return newsItem;

  } catch (error) {
    console.error(`[RSS] Error mapping article from ${feedConfig.name}:`, error);
    return null;
  }
};

// Add this function after the mapRssItemToNewsItem function
const balanceNewsByBias = async (newsCollection) => {
  try {
    // Get current counts by bias using case-insensitive comparison
    const biasCounts = await newsCollection.aggregate([
      {
        $group: {
          _id: { $toLower: "$source.bias" },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalItems = biasCounts.reduce((sum, group) => sum + group.count, 0);
    const biasDistribution = {};

    // Calculate current distribution
    biasCounts.forEach(group => {
      const bias = group._id.charAt(0).toUpperCase() + group._id.slice(1); // Capitalize first letter
      biasDistribution[bias] = (group.count / totalItems) * 100;
    });

    // Check if any bias exceeds target ratio
    for (const [bias, targetRatio] of Object.entries(BIAS_DISTRIBUTION_TARGET)) {
      const currentRatio = biasDistribution[bias] || 0;
      if (currentRatio > targetRatio) {
        const excessCount = Math.ceil(totalItems * (currentRatio - targetRatio) / 100);
        console.log(`[Bias Balance] Removing ${excessCount} excess items from ${bias} bias (current: ${currentRatio.toFixed(1)}%, target: ${targetRatio}%)`);
        
        // Remove excess items, keeping the most recent ones
        const result = await newsCollection.deleteMany({
          "source.bias": { $regex: new RegExp(`^${bias}$`, 'i') },
          _id: { $in: await newsCollection
            .find({ "source.bias": { $regex: new RegExp(`^${bias}$`, 'i') } })
            .sort({ publishedAt: 1 })
            .limit(excessCount)
            .project({ _id: 1 })
            .toArray()
            .then(docs => docs.map(doc => doc._id))
          }
        });
        
        console.log(`[Bias Balance] Removed ${result.deletedCount} items from ${bias} bias`);
      }
    }
  } catch (error) {
    console.error('[Bias Balance] Error balancing news by bias:', error);
  }
};

// Add these functions after the balanceNewsByBias function
const calculateBiasMetrics = async (newsCollection) => {
  const metrics = {
    timestamp: new Date(),
    totalItems: 0,
    distribution: {},
    categoryBreakdown: {},
    recentTrends: {}
  };

  // Get total counts and distribution by bias
  const biasCounts = await newsCollection.aggregate([
    { $group: { _id: '$source.bias', count: { $sum: 1 } } }
  ]).toArray();

  metrics.totalItems = biasCounts.reduce((sum, item) => sum + item.count, 0);
  
  biasCounts.forEach(item => {
    metrics.distribution[item._id] = {
      count: item.count,
      percentage: (item.count / metrics.totalItems * 100).toFixed(2) + '%'
    };
  });

  // Get breakdown by category and bias
  const categoryBiasCounts = await newsCollection.aggregate([
    { $group: { 
      _id: { category: '$category', bias: '$source.bias' },
      count: { $sum: 1 }
    }}
  ]).toArray();

  categoryBiasCounts.forEach(item => {
    const category = item._id.category;
    const bias = item._id.bias;
    if (!metrics.categoryBreakdown[category]) {
      metrics.categoryBreakdown[category] = {};
    }
    metrics.categoryBreakdown[category][bias] = item.count;
  });

  // Calculate trends over the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentBiasCounts = await newsCollection.aggregate([
    { $match: { publishedAt: { $gte: yesterday } } },
    { $group: { _id: '$source.bias', count: { $sum: 1 } } }
  ]).toArray();

  recentBiasCounts.forEach(item => {
    metrics.recentTrends[item._id] = item.count;
  });

  return metrics;
};

const logBiasMetrics = async (newsCollection) => {
  const metrics = await calculateBiasMetrics(newsCollection);
  
  console.log('\n=== News Bias Distribution Report ===');
  console.log(`Timestamp: ${metrics.timestamp}`);
  console.log(`Total Items: ${metrics.totalItems}\n`);
  
  console.log('Overall Distribution:');
  Object.entries(metrics.distribution).forEach(([bias, data]) => {
    console.log(`${bias}: ${data.count} articles (${data.percentage})`);
  });
  
  console.log('\nCategory Breakdown:');
  Object.entries(metrics.categoryBreakdown).forEach(([category, biases]) => {
    console.log(`\n${category}:`);
    Object.entries(biases).forEach(([bias, count]) => {
      console.log(`  ${bias}: ${count} articles`);
    });
  });
  
  console.log('\nLast 24 Hours Trends:');
  Object.entries(metrics.recentTrends).forEach(([bias, count]) => {
    console.log(`${bias}: ${count} new articles`);
  });
  
  console.log('\n=====================================\n');
  
  return metrics;
};

/**
 * Fetches news from all configured RSS feeds.
 * TODO: Add category filtering.
 * TODO: Add keyword extraction call. - DONE
 * TODO: Add saving to database. - DONE
 */
const fetchAllRssNews = async () => {
  console.log(`[RSS Service] Starting fetch for ${rssSources.length} feeds.`);
  const allNewsItems = [];
  const db = getDB(); // Get database connection
  const newsCollection = db.collection('newsitems'); // Use collection name (e.g., 'newsitems')

  const feedPromises = rssSources.map(async (feedConfig) => {
    try {
      console.log(`[RSS Service] Fetching: ${feedConfig.name} (${feedConfig.url})`);
      const feed = await parser.parseURL(feedConfig.url);
      const mappedItems = feed.items
        .map(item => mapRssItemToNewsItem(item, feedConfig))
        .filter(item => item !== null);

      // Extract keywords for successfully mapped items
      const itemsWithKeywords = await Promise.all(
        mappedItems.map(async (item) => {
          item.keywords = await extractKeywords(item);
          return item;
        })
      );

      // Process keywords using TF-IDF
      const itemsWithRefinedKeywords = await processNewsKeywords(itemsWithKeywords);

      // Check for duplicates before saving
      if (itemsWithRefinedKeywords.length > 0) {
        const bulkOps = [];
        for (const item of itemsWithRefinedKeywords) {
          // Check if article with same title and source exists within last 24 hours
          const existing = await newsCollection.findOne({
            url: item.url
          });

          if (!existing) {
            bulkOps.push({
              updateOne: {
                filter: { url: item.url },
                update: { $set: item },
                upsert: true
              }
            });
          } else {
            console.log(`[Duplicate] Skipping duplicate article from ${item.source.name}: "${item.title.substring(0, 50)}..."`);
          }
        }

        if (bulkOps.length > 0) {
          await newsCollection.bulkWrite(bulkOps);
        }
      }

      console.log(`[RSS Service] Fetched, processed, and saved ${itemsWithRefinedKeywords.length} items from ${feedConfig.name}`);
      return itemsWithRefinedKeywords;
    } catch (error) {
      console.error(`[RSS Service] Error processing ${feedConfig.name} (${feedConfig.url}):`, error.message);
      return [];
    }
  });

  // Wait for all feed processing attempts
  const results = await Promise.allSettled(feedPromises);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allNewsItems.push(...result.value);
    } else if (result.status === 'rejected') {
      // Errors are logged within the map function, but maybe log again here if needed
      console.error(`[RSS Service] Promise rejected for feed ${rssSources[index]?.name}: ${result.reason}`);
    }
  });

  console.log(`[RSS Service] Finished fetching. Total items processed (potential duplicates): ${allNewsItems.length}. Check DB logs for upsert counts.`);
  // Keyword extraction could happen here on allNewsItems before returning/final save
  // For now, just return the collected items

  // After all feeds are processed and before returning
  // await balanceNewsByBias(newsCollection); // <-- Temporarily disable bias balancing
  await logBiasMetrics(newsCollection); // Keep logging metrics to see the unbalanced state
  
  console.log(`[RSS Service] Finished fetching, balancing, and monitoring. Total items processed: ${allNewsItems.length}`);
  return allNewsItems;
};


module.exports = {
  fetchAllRssNews,
  rssSources, // Export if needed elsewhere
};
