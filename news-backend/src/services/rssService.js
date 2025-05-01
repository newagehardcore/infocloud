const axios = require('axios');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs if needed
const { getDB } = require('../config/db');
const { PoliticalBias } = require('../types'); // Import PoliticalBias from shared types
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