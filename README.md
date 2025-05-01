# INFOCLOUD - README

## Real-time Interactive News Tag Cloud Application

"INFOCLOUD" is a real-time news aggregator visualization application that displays current news as an interactive 3D tag cloud. The application visualizes news topics as words sized by frequency, colored by political leaning, and allows users to explore stories by clicking on terms. It also includes a time-travel feature that lets users rewind to see how news evolved throughout the day.

![INFOCLOUD Application](https://example.com/screenshot.png)

## Core Features

### Primary Visualization
- 3D tag cloud using Three.js where words represent news topics
- Words sized proportionally to their frequency/importance
- Color coding based on media political spectrum:
  - Pale blue: Liberal
  - Bright blue: Left
  - Purple/neutral: Centrist 
  - Pale red: Mainstream Conservative
  - Bright red: Right
  - Gray: Unclear

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
- Self-hosted Miniflux RSS aggregation system 
- Over 200 feeds from diverse news sources across the political spectrum
- Organized by topic categories (Politics, Tech, Health, etc.)
- Color-coded by political bias for balanced representation
- Deduplication of similar stories from different sources
- Wider variety of perspectives and coverage

## Technical Implementation

### Framework and Architecture
- **Frontend**: React with TypeScript for the web application framework
- **Visualization**: Three.js for 3D tag cloud rendering
- **Backend**: Node.js/Express with MongoDB for news storage and processing
- **RSS System**: Self-hosted Miniflux for feed aggregation and management
- **Database**: MongoDB for news items, PostgreSQL for Miniflux
- Responsive design that works on desktop and mobile browsers

### Data Handling
- **Feed Management**: 
  - Miniflux handles RSS fetching, parsing, and categorization
  - Feeds organized by topics/categories within Miniflux
  - Bias information maintained in the backend
- **Data Processing**:
  - Fetches processed entries from Miniflux API
  - Enriches entries with bias information
  - Extracts keywords using NLP techniques (natural and compromise libraries)
  - Analyzes and categorizes media bias using a curated mapping system
- **Storage**:
  - MongoDB for processed news items and keywords
  - PostgreSQL for the underlying Miniflux feed database
- **Update Frequency**:
  - Automatic feed refresh through scheduled cron jobs
  - Updates data every 5-10 minutes for real-time visualization
  - Stores historical snapshots for the time machine feature

### Performance Optimization
- Adaptive rendering based on device capabilities
- Throttling and debouncing for expensive operations
- Simplified view for mobile and low-power devices
- Frame rate monitoring with quality adjustments

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)
- Docker and Docker Compose for running Miniflux
- MongoDB installed locally or accessible instance

### Environment Setup

1. **Backend Configuration**

Create a `.env` file in the `news-backend` directory with the following content:

```
MINIFLUX_URL=http://localhost:8080
MINIFLUX_USERNAME=admin
MINIFLUX_PASSWORD=adminpass
MONGODB_URI=mongodb://localhost:27017/infocloud
```

2. **Start Miniflux and Database Services**

The application uses self-hosted Miniflux for RSS aggregation, which runs in Docker containers:

```bash
# Start the containers (Miniflux and PostgreSQL)
docker-compose up -d
```

Default Miniflux credentials:
- Username: `admin`
- Password: `adminpass`
- Access URL: http://localhost:8080

### Installation

1. Clone the repository

2. Install dependencies for both backend and frontend:
```bash
# Install backend dependencies
cd news-backend
npm install

# Install frontend dependencies
cd ../news-frontend
npm install
```

3. Set up your environment (see Environment Setup above)

4. Import RSS feeds into Miniflux:
```bash
cd news-backend
node src/miniflux/importAllFeeds.js
```

5. Start the backend server:
```bash
cd news-backend
npm start
```

6. In a separate terminal, start the frontend:
```bash
cd news-frontend
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
- RSS aggregation powered by [Miniflux](https://miniflux.app/)
- News data from over 200 diverse news sources across the political spectrum
- Built with [React](https://reactjs.org/), [Express](https://expressjs.com/), and [Three.js](https://threejs.org/)
- NLP processing with [natural](https://github.com/NaturalNode/natural) and [compromise](https://github.com/spencermountain/compromise)
- Database systems: [MongoDB](https://www.mongodb.com/) and [PostgreSQL](https://www.postgresql.org/)
