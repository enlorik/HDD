# HDD

A React + Vite web application featuring a timeline calendar dashboard and bounty board for tracking projects and challenges.

## Features

### 1. Timeline Dashboard with Codeforces Integration
- Dark, calm dashboard-style UI (not a grid layout)
- Weekly view with weeks displayed as columns
- Vertical "Today" line marking the current week
- Rounded horizontal event bars spanning multiple weeks
- Color-coded events with hover effects
- **Real-time Codeforces contest integration**
  - Fetches upcoming and active contests from the Codeforces API
  - Displays contest start and end dates
  - Color-coded by contest type (CF, IOI, ICPC)
  - Clickable events that open contest details on Codeforces

### 2. Bounty Board
- **Railway Template Bounties Integration**
  - Automatically scrapes template bounties from Railway Station
  - Daily updates via GitHub Actions
  - Displays scraped bounties in a dedicated section
- **Codeforces Contests Integration**
  - Fetches upcoming and active contests from the Codeforces API
  - Displays contests as cards with type, phase, and start date
- Displays UNSOLVED bounties as cards
- Card preview shows:
  - Title and reward amount
  - Brief description
  - Difficulty level (Easy/Medium/Hard)
  - Category tags
- Click any card to view full details in a modal
- Supports four bounty states: UNSOLVED, SOLVED, GONE, ERROR
- Clean, responsive card layout

## Tech Stack

- **React 19.2.0** - UI framework
- **Vite 7.2.4** - Build tool and dev server
- **React Router** - Client-side routing
- **CSS3** - Styling with dark theme

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Build

```bash
# Create production build
npm run build
```

### Lint

```bash
# Check code quality
npm run lint
```

## Project Structure

```
HDD/
├── .github/
│   └── workflows/
│       └── update-railway-bounties.yml # Daily Railway bounties scraper
├── scripts/
│   ├── scrape_railway_bounties.py      # Railway bounties scraper
│   └── requirements.txt                # Python dependencies
├── src/
│   ├── components/
│   │   ├── Timeline.jsx      # Timeline calendar component
│   │   ├── Timeline.css      # Timeline styles
│   │   ├── Bounty.jsx        # Bounty board component
│   │   └── Bounty.css        # Bounty styles
│   ├── services/
│   │   ├── codeforcesService.js  # Codeforces API integration
│   │   └── mockCodeforcesData.js # Mock data for development
│   ├── App.jsx               # Main app with routing
│   ├── App.css               # App-level styles
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles
├── public/
│   └── railway-bounties.json # Scraped Railway bounties data
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
├── package.json             # Dependencies and scripts
└── RAILWAY_BOUNTIES.md      # Railway bounties docs
```

## Design System

The app uses a consistent dark theme:
- Background: `#1a1a2e`
- Cards/Containers: `#16213e`
- Borders: `#2a2a4e`
- Text: `#eaeaea`
- Accents: Various colors for different elements

### Codeforces Contest Type Colors
- **CF**: Blue gradient (`#4a9eff` to `#6bb5ff`)
- **IOI**: Orange gradient (`#ff6b3d` to `#ff8c5c`)
- **ICPC**: Purple gradient (`#9c4aff` to `#b56bff`)

## Codeforces Integration

### How It Works
1. The Timeline and Bounty components automatically fetch upcoming/active Codeforces contests when loaded
2. Contests are displayed as color-coded bars in the timeline
3. Each bar is color-coded by its type (CF/IOI/ICPC)
4. Clicking a contest bar opens the contest page on Codeforces
5. The data is fetched fresh on each page load

### API Integration
- **Endpoint**: `https://codeforces.com/api/contest.list`
- **Filters**: Upcoming (`BEFORE`) and active (`CODING`) contests
- **Data Extracted**:
  - Contest name and ID
  - Contest type (CF, IOI, ICPC)
  - Phase (BEFORE, CODING)
  - Start time and duration

## Railway Bounties Integration

### How It Works
1. A Python scraper fetches template bounties from Railway Station daily
2. The scraper parses the HTML and extracts bounty information
3. Data is saved to `public/railway-bounties.json`
4. The Bounty component automatically loads and displays Railway bounties
5. Changes are committed automatically via GitHub Actions

### Automated Updates
A GitHub Actions workflow (`.github/workflows/update-railway-bounties.yml`) is configured to:
- Run daily at midnight UTC
- Scrape Railway template bounties
- Update the JSON file with new bounties
- Commit changes to the repository
- Can be manually triggered from the Actions tab

### Local Development
To run the scraper locally:

```bash
# Install Python dependencies
pip install -r scripts/requirements.txt

# Run the scraper
python3 scripts/scrape_railway_bounties.py

# View the results
cat public/railway-bounties.json
```

For detailed documentation, see [RAILWAY_BOUNTIES.md](RAILWAY_BOUNTIES.md).

## Future Enhancements

- Add filtering and sorting for bounties
- Implement backend integration for bounty states
- Add user authentication
- Mobile app version
- Cache Codeforces contests for better performance
- Add more detailed contest information in tooltips

## License

Private repository - All rights reserved
