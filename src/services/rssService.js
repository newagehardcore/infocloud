// Updated RSS feeds grouped by category and with standardized bias values
const DEFAULT_RSS_FEEDS = [
  // === POLITICS ===
  { url: 'https://www.dailywire.com/feeds/rss.xml', name: 'The Daily Wire', category: NewsCategory.POLITICS, bias: 'RIGHT' },
  { url: 'https://www.newsmax.com/rss/Politics/1/', name: 'Newsmax', category: NewsCategory.POLITICS, bias: 'CONSERVATIVE' },
  { url: 'https://townhall.com/rss/political-cartoons/', name: 'Townhall', category: NewsCategory.POLITICS, bias: 'CONSERVATIVE' },
  { url: 'https://www.redstate.com/feed/', name: 'RedState', category: NewsCategory.POLITICS, bias: 'CONSERVATIVE' },
  { url: 'https://www.theblaze.com/feeds/feed.rss', name: 'The Blaze', category: NewsCategory.POLITICS, bias: 'RIGHT' },
  { url: 'https://freebeacon.com/feed/', name: 'Washington Free Beacon', category: NewsCategory.POLITICS, bias: 'CONSERVATIVE' },
  { url: 'https://www.alternet.org/feeds/feed.rss', name: 'AlterNet', category: NewsCategory.POLITICS, bias: 'LEFT' },
  { url: 'https://www.commondreams.org/rss.xml', name: 'Common Dreams', category: NewsCategory.POLITICS, bias: 'LEFT' },
  { url: 'https://thebulwark.com/feed/', name: 'The Bulwark', category: NewsCategory.POLITICS, bias: 'CONSERVATIVE' },
  { url: 'https://www.washingtonexaminer.com/tag/news.rss', name: 'Washington Examiner', category: NewsCategory.POLITICS, bias: 'CONSERVATIVE' },
  { url: 'https://thehill.com/rss/syndicator/19109', name: 'The Hill', category: NewsCategory.POLITICS, bias: 'CENTRIST' },
  { url: 'https://www.motherjones.com/feed/', name: 'Mother Jones', category: NewsCategory.POLITICS, bias: 'LEFT' },
  { url: 'https://www.vox.com/rss/index.xml', name: 'Vox', category: NewsCategory.POLITICS, bias: 'LIBERAL' },
  { url: 'https://www.politico.com/rss/politicopicks.xml', name: 'Politico', category: NewsCategory.POLITICS, bias: 'CENTRIST' },
  { url: 'https://www.breitbart.com/feed/', name: 'Breitbart', category: NewsCategory.POLITICS, bias: 'RIGHT' },
  { url: 'https://talkingpointsmemo.com/feed', name: 'Talking Points Memo', category: NewsCategory.POLITICS, bias: 'LIBERAL' },

  // === NEWS ===
  { url: 'https://www.washingtontimes.com/rss/headlines/news/', name: 'Washington Times', category: NewsCategory.NEWS, bias: 'CONSERVATIVE' },
  { url: 'https://www.oann.com/feed/', name: 'One America News Network', category: NewsCategory.NEWS, bias: 'RIGHT' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'New York Times', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://feeds.washingtonpost.com/rss/world', name: 'Washington Post', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://www.theguardian.com/us/rss', name: 'The Guardian US', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://www.reuters.com/rssfeed/topNews', name: 'Reuters Top News', category: NewsCategory.NEWS, bias: 'CENTRIST' },
  { url: 'https://www.npr.org/rss/rss.php?id=1001', name: 'NPR News', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://www.cbsnews.com/latest/rss/main', name: 'CBS News', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://abcnews.go.com/abcnews/topstories', name: 'ABC News', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://rss.cnn.com/rss/cnn_topstories.rss', name: 'CNN', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://moxie.foxnews.com/google-publisher/latest.xml', name: 'Fox News', category: NewsCategory.NEWS, bias: 'CONSERVATIVE' },
  { url: 'https://feeds.nbcnews.com/nbcnews/public/news', name: 'NBC News', category: NewsCategory.NEWS, bias: 'LIBERAL' },
  { url: 'https://www.usatoday.com/rss/', name: 'USA Today', category: NewsCategory.NEWS, bias: 'CENTRIST' },

  // === SCIENCE ===
  { url: 'https://www.space.com/feeds/all', name: 'Space.com', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://phys.org/rss-feed/', name: 'Phys.org', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://www.scientificamerican.com/rss/all/', name: 'Scientific American', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://www.universetoday.com/feed/', name: 'Universe Today', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://www.planetary.org/planetary-radio/mat-kaplan-farewell', name: 'Planetary Society', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://www.livescience.com/feeds/all', name: 'Live Science', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://newscientist.com/feed/home/', name: 'New Scientist', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://www.quantamagazine.org/feed/', name: 'Quanta Magazine', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://www.nature.com/nature.rss', name: 'Nature', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://science.sciencemag.org/rss/express.xml', name: 'Science Magazine', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://feeds.feedburner.com/popsci-main', name: 'Popular Science', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },
  { url: 'https://discover.lanl.gov/news/rss/rss.xml', name: 'Los Alamos National Laboratory', category: NewsCategory.SCIENCE, bias: 'CENTRIST' },

  // === TECH ===
  { url: 'https://www.engadget.com/rss.xml', name: 'Engadget', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://feeds.feedburner.com/Mashable', name: 'Mashable', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://www.schneier.com/feed/atom/', name: 'Schneier on Security', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://gizmodo.com/rss', name: 'Gizmodo', category: NewsCategory.TECH, bias: 'LIBERAL' },
  { url: 'https://towardsdatascience.com/feed', name: 'Towards Data Science', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: NewsCategory.TECH, bias: 'LIBERAL' },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://www.zdnet.com/news/rss.xml', name: 'ZDNet', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://readwrite.com/feed/', name: 'ReadWrite', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://www.cnet.com/rss/all/', name: 'CNET', category: NewsCategory.TECH, bias: 'CENTRIST' },
  { url: 'https://venturebeat.com/feed/', name: 'VentureBeat', category: NewsCategory.TECH, bias: 'CENTRIST' },

  // === LAW ===
  { url: 'https://abovethelaw.com/feed/', name: 'Above the Law', category: NewsCategory.LAW, bias: 'LIBERAL' },
  { url: 'https://www.scotusblog.com/feed/', name: 'SCOTUSblog', category: NewsCategory.LAW, bias: 'CENTRIST' },
  { url: 'https://www.lawfareblog.com/feed', alternateUrl: 'https://www.lawfareblog.com/rss.xml', name: 'Lawfare', category: NewsCategory.LAW, bias: 'CENTRIST' },
  { url: 'https://reason.com/volokh/feed/', name: 'The Volokh Conspiracy', category: NewsCategory.LAW, bias: 'LIBERTARIAN' },
  { url: 'https://www.law.com/feed/', name: 'Law.com', category: NewsCategory.LAW, bias: 'CENTRIST' },
  { url: 'https://verdict.justia.com/feed', name: 'Justia Verdict', category: NewsCategory.LAW, bias: 'CENTRIST' },
  { url: 'https://lawandcrime.com/feed/', name: 'Law & Crime', category: NewsCategory.LAW, bias: 'CENTRIST' },
  { url: 'https://www.reuters.com/rss/legal', name: 'Reuters Legal', category: NewsCategory.LAW, bias: 'CENTRIST' },
  { url: 'https://feeds.findlaw.com/NewsTopHeadlines', name: 'FindLaw News', category: NewsCategory.LAW, bias: 'CENTRIST' },

  // === ENVIRONMENT ===
  { url: 'https://insideclimatenews.org/feed/', name: 'InsideClimate News', category: NewsCategory.ENVIRONMENT, bias: 'LIBERAL' },
  { url: 'https://news.mongabay.com/feed/', name: 'Mongabay', category: NewsCategory.ENVIRONMENT, bias: 'CENTRIST' },
  { url: 'https://www.carbonbrief.org/feed', name: 'Carbon Brief', category: NewsCategory.ENVIRONMENT, bias: 'CENTRIST' },
  { url: 'https://grist.org/feed/', name: 'Grist', category: NewsCategory.ENVIRONMENT, bias: 'LIBERAL' },
  { url: 'https://e360.yale.edu/feed.xml', name: 'Yale Environment 360', category: NewsCategory.ENVIRONMENT, bias: 'LIBERAL' },
  { url: 'https://www.treehugger.com/feeds/latest/', name: 'Treehugger', category: NewsCategory.ENVIRONMENT, bias: 'LIBERAL' },
  { url: 'https://www.eenews.net/rss/feed.xml', name: 'E&E News', category: NewsCategory.ENVIRONMENT, bias: 'CENTRIST' },
  { url: 'https://www.nationalgeographic.com/environment/rss/all', name: 'National Geographic Environment', category: NewsCategory.ENVIRONMENT, bias: 'CENTRIST' },
  { url: 'https://feeds.feedburner.com/EnvironmentalLeader', name: 'Environmental Leader', category: NewsCategory.ENVIRONMENT, bias: 'CENTRIST' },

  // === WORLD ===
  { url: 'https://www.spiegel.de/international/index.rss', name: 'Der Spiegel International', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.rappler.com/rss', name: 'Rappler', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.economist.com/the-world-this-week/rss.xml', alternateUrl: 'https://www.economist.com/weeklyedition/rss.xml', name: 'The Economist', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.cbc.ca/rss/world', alternateUrl: 'https://www.cbc.ca/webfeed/rss/rss-world', name: 'CBC News - World', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', category: NewsCategory.WORLD, bias: 'LIBERAL' },
  { url: 'https://www3.nhk.or.jp/nhkworld/en/news/all/index.rss', name: 'NHK World Japan', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.france24.com/en/rss', name: 'France 24', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.dw.com/en/top-stories/rss-feed-2/rss.xml', name: 'Deutsche Welle', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.thelocal.de/feeds/rss.php', name: 'The Local - Europe', category: NewsCategory.WORLD, bias: 'CENTRIST' },
  { url: 'https://www.statnews.com/feed', name: 'STAT', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://www.nih.gov/rss', name: 'NIH News & Events', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://jamanetwork.com/rss/site_3/mostReadArticles.xml', name: 'JAMA Network', category: NewsCategory.HEALTH, bias: 'CENTRIST' },

  // === ARTS ===
  { url: 'https://www.theartnewspaper.com/rss', name: 'The Art Newspaper', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.thisiscolossal.com/feed/', name: 'Colossal', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.artsy.net/rss/news', name: 'Artsy', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://hyperallergic.com/feed/', name: 'Hyperallergic', category: NewsCategory.ARTS, bias: 'LIBERAL' },
  { url: 'https://www.artnews.com/feed/', name: 'ARTnews', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://news.artnet.com/feed', name: 'Artnet News', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.vulture.com/tag/art/rss/', name: 'Vulture - Art', category: NewsCategory.ARTS, bias: 'LIBERAL' },
  { url: 'https://www.apollo-magazine.com/feed/', name: 'Apollo Magazine', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.artsjournal.com/feed', name: 'ArtsJournal', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://frieze.com/feed', name: 'Frieze', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.juxtapoz.com/feed/', name: 'Juxtapoz', category: NewsCategory.ARTS, bias: 'LIBERAL' },
  { url: 'https://www.artforum.com/feed/', name: 'Artforum', category: NewsCategory.ARTS, bias: 'LIBERAL' },
  { url: 'https://www.creativeboom.com/feed/', name: 'Creative Boom', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.designboom.com/feed/', name: 'designboom', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://www.openculture.com/feed', name: 'Open Culture', category: NewsCategory.ARTS, bias: 'LIBERAL' },
  { url: 'https://www.artistsnetwork.com/feed/', name: 'Artists Network', category: NewsCategory.ARTS, bias: 'CENTRIST' },
  { url: 'https://mymodernmet.com/feed/', name: 'My Modern Met', category: NewsCategory.ARTS, bias: 'CENTRIST' },

  // === HEALTH ===
  { url: 'https://www.thelancet.com/rssfeed/lancet_current.xml', name: 'The Lancet', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://www.healthline.com/rss/health-news', name: 'Healthline', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://www.medicalnewstoday.com/newsfeeds/rss/medical_news_today.xml', name: 'Medical News Today', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://www.webmd.com/rss/news_feeds/1/rss.xml', name: 'WebMD', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://www.nejm.org/action/showFeed?jc=nejm&type=etoc&feed=rss', name: 'New England Journal of Medicine', category: NewsCategory.HEALTH, bias: 'CENTRIST' },
  { url: 'https://feeds.feedburner.com/khn/stories?format=xml', name: 'Kaiser Health News', category: NewsCategory.HEALTH, bias: 'CENTRIST' },

  // === FINANCE ===
  { url: 'https://seekingalpha.com/market_currents.xml', name: 'Seeking Alpha - Market News', category: NewsCategory.FINANCE, bias: 'CENTRIST' },
  { url: 'https://www.nakedcapitalism.com/feed', name: 'Naked Capitalism', category: NewsCategory.FINANCE, bias: 'LEFT' },
  { url: 'https://www.marketwatch.com/rss/topstories', name: 'MarketWatch', category: NewsCategory.FINANCE, bias: 'CENTRIST' },
  { url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles', name: 'Investopedia', category: NewsCategory.FINANCE, bias: 'CENTRIST' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC', category: NewsCategory.FINANCE, bias: 'CENTRIST' },
  { url: 'https://www.ft.com/rss/home/us', name: 'Financial Times', category: NewsCategory.FINANCE, bias: 'CENTRIST' },
  { url: 'https://www.bloomberg.com/feed/podcast/decrypted', name: 'Bloomberg', category: NewsCategory.FINANCE, bias: 'CENTRIST' },
  { url: 'https://www.wsj.com/xml/rss/3_7031.xml', name: 'Wall Street Journal', category: NewsCategory.FINANCE, bias: 'CONSERVATIVE' },
  { url: 'https://www.barrons.com/feed/rss?id=latest', name: 'Barrons', category: NewsCategory.FINANCE, bias: 'CONSERVATIVE' },
  { url: 'https://www.fool.com/a/feeds/foolwatch?format=rss2&id=foolwatch', name: 'Motley Fool', category: NewsCategory.FINANCE, bias: 'CENTRIST' },

  // === MUSIC ===
  { url: 'https://www.stereogum.com/feed/',                      name: 'Stereogum',              category: NewsCategory.MUSIC, bias: 'LIBERAL' },
  { url: 'https://pitchfork.com/feed/feed-news/rss',            name: 'Pitchfork',              category: NewsCategory.MUSIC, bias: 'LIBERAL' },
  { url: 'https://www.rollingstone.com/music/feed/',            name: 'Rolling Stone – Music',  category: NewsCategory.MUSIC, bias: 'LIBERAL' },
  { url: 'https://www.billboard.com/feed/',                     name: 'Billboard',              category: NewsCategory.MUSIC, bias: 'CENTRIST' },
  { url: 'https://www.nme.com/feed',                             name: 'NME',                    category: NewsCategory.MUSIC, bias: 'CENTRIST' },
  { url: 'https://www.consequence.net/feed/',                   name: 'Consequence of Sound',   category: NewsCategory.MUSIC, bias: 'LIBERAL' },
  { url: 'https://www.spin.com/feed/',                           name: 'Spin',                   category: NewsCategory.MUSIC, bias: 'LIBERAL' },
  { url: 'https://www.npr.org/rss/rss.php?id=1039',              name: 'NPR Music',              category: NewsCategory.MUSIC, bias: 'CENTRIST' },
  { url: 'https://www.brooklynvegan.com/feed/',                 name: 'BrooklynVegan',          category: NewsCategory.MUSIC, bias: 'CENTRIST' },
  
  // === SPORTS ===
  { url: 'https://deadspin.com/rss', name: 'Deadspin', category: NewsCategory.SPORTS, bias: 'LIBERAL' },
  { url: 'https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyGKCfxBagJG9b8pqLyndmvo7UU', name: 'Fox Sports', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://www.espn.com/espn/rss/news', name: 'ESPN', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://sports.yahoo.com/rss/', name: 'Yahoo Sports', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://www.cbssports.com/rss/headlines/', name: 'CBS Sports', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://www.sbnation.com/rss/current', name: 'SB Nation', category: NewsCategory.SPORTS, bias: 'LIBERAL' },
  { url: 'https://theathletic.com/news/rss/', name: 'The Athletic', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://bleacherreport.com/articles/feed', name: 'Bleacher Report', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://www.si.com/rss/si_topstories.rss', name: 'Sports Illustrated', category: NewsCategory.SPORTS, bias: 'CENTRIST' },
  { url: 'https://www.sportingnews.com/us/rss', name: 'Sporting News', category: NewsCategory.SPORTS, bias: 'CENTRIST' },

  // === FASHION ===
  { url: 'https://www.highsnobiety.com/feed/', name: 'Highsnobiety', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://www.vogue.com/feed/rss', name: 'Vogue', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://www.elle.com/rss/all.xml/', name: 'Elle', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://www.harpersbazaar.com/rss/all.xml/', name: 'Harper\'s Bazaar', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://www.gq.com/feed/rss', name: 'GQ', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://fashionista.com/.rss/excerpt/', name: 'Fashionista', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://hypebeast.com/feed', name: 'Hypebeast', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://wwd.com/feed/', name: 'Women\'s Wear Daily', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://www.manrepeller.com/feed', name: 'Man Repeller', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://www.businessoffashion.com/feed', name: 'Business of Fashion', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://www.dazeddigital.com/rss', name: 'Dazed', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://www.papermag.com/rss', name: 'Paper Magazine', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://i-d.vice.com/en_us/rss', name: 'i-D', category: NewsCategory.FASHION, bias: 'LIBERAL' },
  { url: 'https://footwearnews.com/feed/', name: 'Footwear News', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://stylecaster.com/fashion/feed/', name: 'StyleCaster Fashion', category: NewsCategory.FASHION, bias: 'CENTRIST' },
  { url: 'https://www.tmz.com/rss/news-feed/', name: 'TMZ', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  { url: 'https://www.ign.com/rss/articles', name: 'IGN Articles', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  { url: 'https://www.etonline.com/news/rss', name: 'Entertainment Tonight', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  { url: 'https://www.eonline.com/news.rss', name: 'E! News', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  
  // === ENTERTAINMENT ===
  { url: 'https://variety.com/feed/', name: 'Variety', category: NewsCategory.ENTERTAINMENT, bias: 'LIBERAL' },
  { url: 'https://deadline.com/feed/', name: 'Deadline Hollywood', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  { url: 'https://www.hollywoodreporter.com/feed/', name: 'Hollywood Reporter', category: NewsCategory.ENTERTAINMENT, bias: 'LIBERAL' },
  { url: 'https://ew.com/feed/', name: 'Entertainment Weekly', category: NewsCategory.ENTERTAINMENT, bias: 'LIBERAL' },
  { url: 'https://www.avclub.com/rss', name: 'AV Club', category: NewsCategory.ENTERTAINMENT, bias: 'LIBERAL' },
  { url: 'https://people.com/feed/', name: 'People', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  { url: 'https://www.tmz.com/rss/news-feed/', name: 'TMZ', category: NewsCategory.ENTERTAINMENT, bias: 'CENTRIST' },
  
  // === BUSINESS ===
  { url: 'https://www.forbes.com/real-time/feed2/', name: 'Forbes', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://www.businessinsider.com/rss', name: 'Business Insider', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://fortune.com/feed/', name: 'Fortune', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://hbr.org/rss/index.xml', name: 'Harvard Business Review', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://www.inc.com/rss/', name: 'Inc.', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://www.fastcompany.com/latest/rss', name: 'Fast Company', category: NewsCategory.BUSINESS, bias: 'LIBERAL' },
  { url: 'https://www.entrepreneur.com/latest.rss', name: 'Entrepreneur', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://www.bizjournals.com/bizjournals/feed/feed.json', name: 'Bizjournals', category: NewsCategory.BUSINESS, bias: 'CENTRIST' },
  { url: 'https://qz.com/feed', name: 'Quartz', category: NewsCategory.BUSINESS, bias: 'LIBERAL' },
        
  // === Economics ===
  { url: 'https://www.project-syndicate.org/rss', name: 'Project Syndicate', category: NewsCategory.ECONOMICS, bias: 'CENTRIST' },
  { url: 'https://feeds.feedburner.com/EconomistsView', name: 'Economist\'s View', category: NewsCategory.ECONOMICS, bias: 'LIBERAL' },
  { url: 'https://marginalrevolution.com/feed', name: 'Marginal Revolution', category: NewsCategory.ECONOMICS, bias: 'UNKNOWN' },
  { url: 'https://www.econlib.org/feed/', name: 'EconLog', category: NewsCategory.ECONOMICS, bias: 'UNKNOWN' },
  { url: 'https://www.brookings.edu/topics/u-s-economy/feed/', name: 'Brookings - Economics', category: NewsCategory.ECONOMICS, bias: 'LIBERAL' },
  { url: 'https://cepr.net/feed/', name: 'Center for Economic and Policy Research', category: NewsCategory.ECONOMICS, bias: 'LEFT' },
  { url: 'https://freakonomics.com/feed/', name: 'Freakonomics', category: NewsCategory.ECONOMICS, bias: 'CENTRIST' },
  { url: 'https://www.imf.org/en/news/rss-feed', name: 'IMF News', category: NewsCategory.ECONOMICS, bias: 'CENTRIST' },
  { url: 'https://www.nber.org/rss/new.xml', name: 'NBER Working Papers', category: NewsCategory.ECONOMICS, bias: 'CENTRIST' },
      
  // === Space ===
  { url: 'https://spacenews.com/feed/', name: 'SpaceNews', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  { url: 'https://www.nasaspaceflight.com/feed/', name: 'NASA Spaceflight', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  { url: 'https://www.teslarati.com/feed/', name: 'Teslarati', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  { url: 'https://arstechnica.com/tag/spacex/feed/', name: 'Ars Technica - Space', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  { url: 'https://skyandtelescope.org/feed/', name: 'Sky & Telescope', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  { url: 'https://astronomynow.com/feed/', name: 'Astronomy Now', category: NewsCategory.SPACE, bias: 'CENTRIST' },    
  { url: 'https://blogs.nasa.gov/stationreport/feed/', name: 'NASA ISS Blog', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  { url: 'https://www.spaceflightinsider.com/feed/', name: 'Spaceflight Insider', category: NewsCategory.SPACE, bias: 'CENTRIST' },
  
  // === AI ===
  { url: 'https://venturebeat.com/category/ai/feed/', name: 'VentureBeat AI', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', name: 'MIT Technology Review - AI', category: NewsCategory.AI, bias: 'LIBERAL' },
  { url: 'https://www.artificialintelligence-news.com/feed/', name: 'AI News', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://towardsdatascience.com/feed/tag/artificial-intelligence', name: 'Towards Data Science - AI', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://machinelearningmastery.com/feed/', name: 'Machine Learning Mastery', category: NewsCategory.AI, bias: 'CENTRIST' },  
  { url: 'https://www.deeplearning.ai/blog/feed/', name: 'deeplearning.ai', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://openai.com/blog/rss/', name: 'OpenAI Blog', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://blogs.nvidia.com/blog/category/deep-learning/feed/', name: 'NVIDIA AI Blog', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://ai.googleblog.com/feeds/posts/default', name: 'Google AI Blog', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://www.fast.ai/atom.xml', name: 'fast.ai', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://research.fb.com/feed/', name: 'Meta AI Research', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face Blog', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://www.reddit.com/r/artificial/.rss', name: 'Reddit r/artificial', category: NewsCategory.AI, bias: 'CENTRIST' },
  { url: 'https://www.analyticsvidhya.com/feed/', name: 'Analytics Vidhya', category: NewsCategory.AI, bias: 'CENTRIST' },
];

// Configure parser with better timeout and headers
const parser = new Parser({
  timeout: 30000, // Reduced to 30 seconds to fail faster
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['description', 'description']
    ]
  },
  defaultRSS: 2.0,
  maxRedirects: 5
});

// Add rate limiting and item count limits per source
const MAX_ITEMS_PER_SOURCE = 30; // Reduced from 50 to 30 for better balance
const MAX_ITEMS_PER_BIAS = 100; // Maximum items per political bias category

// Track items per bias category
let biasItemCounts = {
  'Liberal': 0,
  'Left': 0,
  'Center': 0,
  'Conservative': 0,
  'Right': 0,
  'Unknown': 0 // Added Unknown, although no feeds currently use it
};

const SOURCE_RATE_LIMITS = {
  default: MAX_ITEMS_PER_SOURCE,
  // Override limits for sources that tend to flood
  'Deadspin': 20,
  'Mashable': 20,
  'War on the Rocks': 20,
  'Space.com': 20,
  'Scientific American': 20,
  'New Scientist': 20,
  'The Art Newspaper': 20
};

// Helper to get rate limit for a source
const getSourceLimit = (sourceName) => {
  return SOURCE_RATE_LIMITS[sourceName] || SOURCE_RATE_LIMITS.default;
};

// Update mapRssItemToNewsItem to handle rate limiting
const mapRssItemToNewsItem = (item, feedConfig, currentCount) => {
  try {
    // Check if we've hit the rate limit for this source
    const sourceLimit = getSourceLimit(feedConfig.name);
    if (currentCount >= sourceLimit) {
      return null;
    }

    let title = item.title || '';
    let description = item.contentSnippet || item.content || item.description || '';
    let url = item.link || '';
    let publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
    let sourceName = feedConfig.name;
    let sourceBias = feedConfig.bias;
    let articleCategory = feedConfig.category;

    // Basic validation
    if (!title || !url) {
      console.warn(`[RSS] Skipping item due to missing title or URL from ${sourceName}: ${item.title?.substring(0,50)}`);
      return null;
    }

    // Ensure URL is valid and absolute
    try {
      const parsedUrl = new URL(url);
      url = parsedUrl.href;
    } catch (e) {
      console.warn(`[RSS] Skipping item due to invalid URL from ${sourceName}: ${url}`);
      return null;
    }

    // Clean up title and description
    title = title.replace(/<[^>]*>?/gm, '').trim();
    description = description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

    // Truncate description if excessively long
    const MAX_DESC_LENGTH = 500;
    if (description.length > MAX_DESC_LENGTH) {
      description = description.substring(0, MAX_DESC_LENGTH) + '...';
    }

    // Validate and format date
    try {
      publishedAt = new Date(publishedAt).toISOString();
    } catch (e) {
      publishedAt = new Date().toISOString();
    }

    // Generate unique ID
    const id = uuidv4();

    const newsItem = {
      id,
      title,
      description,
      url,
      source: {
        name: sourceName,
        bias: sourceBias,
      },
      publishedAt,
      category: articleCategory,
      keywords: [],
    };
    
    return newsItem;

  } catch (error) {
    console.error(`[RSS] Error mapping article from ${feedConfig.name}:`, error);
    return null;
  }
};

// Update processFeedItems to use bias-based rate limiting
const processFeedItems = (feed, feedConfig) => {
  if (!feed || !feed.items || feed.items.length === 0) {
    return [];
  }

  let processedCount = 0;
  const sourceLimit = getSourceLimit(feedConfig.name);
  const currentBiasCount = biasItemCounts[feedConfig.bias] || 0;
  
  // Sort items by date (newest first) before processing
  const sortedItems = feed.items.sort((a, b) => {
    const dateA = new Date(a.isoDate || a.pubDate || 0);
    const dateB = new Date(b.isoDate || b.pubDate || 0);
    return dateB - dateA;
  });
  
  const processedItems = [];
  
  for (const item of sortedItems) {
    // Check both source and bias limits
    if (processedCount >= sourceLimit) break;
    if (currentBiasCount >= MAX_ITEMS_PER_BIAS) break;
    
    const newsItem = mapRssItemToNewsItem(item, feedConfig, processedCount);
    if (newsItem) {
      processedItems.push(newsItem);
      processedCount++;
      biasItemCounts[feedConfig.bias] = (biasItemCounts[feedConfig.bias] || 0) + 1;
    }
  }
  
  return processedItems;
};

// Reset bias counts at the start of each fetch cycle
const resetBiasCounts = () => {
  biasItemCounts = {
    'Liberal': 0,
    'Left': 0,
    'Center': 0,
    'Conservative': 0,
    'Right': 0,
    'Unknown': 0
  };
};

// Update fetchAllRssNews to use bias tracking
const fetchAllRssNews = async () => {
  console.log(`[RSS Service] Starting fetch for ${DEFAULT_RSS_FEEDS.length} feeds.`);
  resetBiasCounts(); // Reset bias counts at start
  const allNewsItems = [];
  const db = getDB();
  const newsCollection = db.collection('newsitems');

  const feedPromises = DEFAULT_RSS_FEEDS.map(async (feedConfig) => {
    try {
      console.log(`[RSS Service] Fetching: ${feedConfig.name} (${feedConfig.url})`);
      const feed = await fetchFeedWithRetry(feedConfig);
      
      const mappedItems = processFeedItems(feed, feedConfig);
      
      const itemsWithKeywords = await Promise.all(
        mappedItems.map(async (item) => {
          item.keywords = await extractKeywords(item);
          return item;
        })
      );

      console.log(`[RSS Service] Fetched, mapped, and extracted keywords for ${itemsWithKeywords.length} items from ${feedConfig.name}`);
      
      if (itemsWithKeywords.length > 0) {
        try {
          const bulkOps = itemsWithKeywords.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $setOnInsert: item },
              upsert: true
            }
          }));
          
          if (bulkOps.length > 0) {
            const result = await newsCollection.bulkWrite(bulkOps, { ordered: false });
            console.log(`[DB] Upserted ${result.upsertedCount} new items from ${feedConfig.name}. Matched: ${result.matchedCount}`);
          }
        } catch (dbError) {
          console.error(`[DB] Error saving items from ${feedConfig.name}:`, dbError);
          if (dbError.code === 11000) {
            console.warn(`[DB] Duplicate key error encountered for ${feedConfig.name}. Some items might already exist.`);
          }
        }
        return itemsWithKeywords;
      }
      return [];
    } catch (error) {
      console.error(`[RSS Service] Error processing ${feedConfig.name} (${feedConfig.url}):`, error.message);
      return [];
    }
  });

  const results = await Promise.allSettled(feedPromises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allNewsItems.push(...result.value);
    }
  });

  console.log(`[RSS Service] Finished fetching. Total items processed (potential duplicates): ${allNewsItems.length}. Check DB logs for upsert counts.`);

  // Log bias distribution at the end
  console.log('[RSS Service] Final bias distribution:', biasItemCounts);
  
  return allNewsItems;
};

// Add retry logic for feed fetching with improved error handling
const fetchFeedWithRetry = async (feedConfig, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Add exponential backoff between retries
        const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 10000); // Cap at 10 seconds
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        console.log(`[RSS Service] Retry attempt ${attempt} for ${feedConfig.name}`);
      }
      
      // Try alternative URL if main URL fails on subsequent attempts
      let urlToTry = feedConfig.url;
      if (attempt > 0 && feedConfig.alternateUrl) {
        urlToTry = feedConfig.alternateUrl;
        console.log(`[RSS Service] Trying alternate URL for ${feedConfig.name}: ${urlToTry}`);
      }
      
      return await parser.parseURL(urlToTry);
    } catch (error) {
      lastError = error;
      
      // Enhanced error logging
      const errorMessage = error.message || 'Unknown error';
      const statusCode = error.response?.status;
      console.error(`[RSS Service] Error fetching ${feedConfig.name} (Attempt ${attempt + 1}/${maxRetries + 1}):`, {
        error: errorMessage,
        statusCode,
        url: feedConfig.url
      });
      
      // Don't retry on certain errors
      if (
        error.message.includes('404') || 
        error.message.includes('410') || // Gone
        error.message.includes('Invalid XML')
      ) {
        break;
      }
      
      // For 403 errors, try with different headers on next attempt
      if (error.message.includes('403')) {
        parser.options.headers = {
          ...parser.options.headers,
          'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
          'Referer': new URL(feedConfig.url).origin
        };
      }
      
      if (attempt === maxRetries) {
        console.error(`[RSS Service] All retry attempts failed for ${feedConfig.name}`);
      }
    }
  }
  
  throw lastError;
}; 