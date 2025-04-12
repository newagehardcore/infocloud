# Whats Going On - README

## Real-time Interactive News Tag Cloud Application

"Whats Going On" is a real-time news aggregator visualization application that displays current news as an interactive 3D tag cloud. The application visualizes news topics as words sized by frequency, colored by political leaning, and allows users to explore stories by clicking on terms. It also includes a time-travel feature that lets users rewind to see how news evolved throughout the day.

![Whats Going On Application](https://example.com/screenshot.png)

## Core Features

### Primary Visualization
- 3D tag cloud using Three.js where words represent news topics
- Words sized proportionally to their frequency/importance
- Color coding based on media political spectrum:
  - Pale blue: Mainstream left/Democratic-leaning outlets
  - Bright blue: Alternative/progressive left media
  - Purple/neutral: Centrist outlets
  - Pale red: Mainstream right/Republican-leaning outlets
  - Bright red: Alternative right media
  - Gray: Sources with unclear political alignment

### Real-time Updates
- News updates continually flow into the visualization
- New words animate by growing from nothing
- Existing words dynamically resize as importance changes
- Visual hints (subtle glow) indicate newly appeared terms

### Interactive Exploration
- First level: Main tag cloud with keywords colored by source bias
- Click interaction: Selecting a word reveals related news from that specific topic
- Source information and links to original articles
- Related stories using similar keywords

### Category Filtering
- Category filtering system along the top navigation bar
- Categories: All (default), World, US, Tech, Business, Entertainment, Sports, Health, Science
- Real-time filtering with smooth transitions between states

### Time Machine Feature
- "Clock" interface that users can interact with
- Normal mode: Real-time news updates
- Time machine mode: Users can rewind to view past states
- Clear visual indicator when viewing historical vs. current data

### Multiple News Sources
- News aggregation from multiple sources:
  - NewsAPI.org
  - The Guardian
  - The New York Times
  - GNews
  - TheNewsAPI
- Deduplication of similar stories from different sources
- Wider variety of perspectives and coverage

## Technical Implementation

### Framework and Architecture
- React with TypeScript for the web application framework
- Three.js for 3D visualization rendering
- Responsive design that works on desktop and mobile browsers

### Data Handling
- Fetches news from multiple news APIs
- Processes text to extract key terms using NLP techniques (natural and compromise libraries)
- Analyzes and categorizes media bias
- Stores historical snapshots for the time machine feature
- Updates data every 5-10 minutes for real-time feeling

### Performance Optimization
- Adaptive rendering based on device capabilities
- Throttling and debouncing for expensive operations
- Simplified view for mobile and low-power devices
- Frame rate monitoring with quality adjustments

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)
- API keys for news sources (see below)

### API Keys Setup
The application uses multiple news APIs to aggregate content. You'll need to obtain API keys from the following services:

1. **NewsAPI.org** - Get a free API key at [https://newsapi.org/register](https://newsapi.org/register)
2. **The Guardian API** - Register for a free API key at [https://open-platform.theguardian.com/access/](https://open-platform.theguardian.com/access/)
3. **New York Times API** - Get an API key at [https://developer.nytimes.com/get-started](https://developer.nytimes.com/get-started)
4. **GNews API** - Register for an API key at [https://gnews.io/register](https://gnews.io/register)
5. **TheNewsAPI** - Get an API key at [https://www.thenewsapi.com/](https://www.thenewsapi.com/)

After obtaining your API keys, create a `.env` file in the root directory with the following content:
```
REACT_APP_NEWS_API_KEY=your-newsapi-key
REACT_APP_GUARDIAN_API_KEY=your-guardian-api-key
REACT_APP_NY_TIMES_API_KEY=your-nytimes-api-key
REACT_APP_GNEWS_API_KEY=your-gnews-api-key
REACT_APP_THE_NEWS_API_KEY=your-thenewsapi-key
```

The application will work with at least one API key, but for best results, provide keys for multiple services.

### Installation
1. Clone the repository
2. Install dependencies:
```
npm install
```
3. Set up your API keys in the `.env` file (see API Keys Setup above)
4. Start the development server:
```
npm start
```

### Building for Production
```
npm run build
```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Planned Future Features
- **Personalized Alerts** - Users can star specific words for notifications
- **Geographic Overlay** - Toggle to visualize where news is happening on a map

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- News data provided by [NewsAPI.org](https://newsapi.org/), [The Guardian API](https://open-platform.theguardian.com/), [New York Times API](https://developer.nytimes.com/), [GNews API](https://gnews.io/), and [TheNewsAPI](https://www.thenewsapi.com/)
- Built with [React](https://reactjs.org/) and [Three.js](https://threejs.org/)
- NLP processing with [natural](https://github.com/NaturalNode/natural) and [compromise](https://github.com/spencermountain/compromise)
