# HDD

A React + Vite web application featuring a timeline calendar dashboard and bounty board for tracking projects and challenges.

## Features

### 1. Timeline Dashboard with Topcoder Integration
- Dark, calm dashboard-style UI (not a grid layout)
- Weekly view with weeks displayed as columns
- Vertical "Today" line marking the current week
- Rounded horizontal event bars spanning multiple weeks
- Color-coded events with hover effects
- **Real-time Topcoder challenge integration**
  - Fetches active challenges from Topcoder API
  - Displays registration and submission deadlines
  - Color-coded by track (Dev, Design, Data Science, QA)
  - Clickable events that open challenge details on Topcoder
- Combines hardcoded events with live Topcoder challenges

### 2. Bounty Board
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
│       └── update-topcoder.yml  # Daily Topcoder sync workflow
├── src/
│   ├── components/
│   │   ├── Timeline.jsx      # Timeline calendar component
│   │   ├── Timeline.css      # Timeline styles
│   │   ├── Bounty.jsx        # Bounty board component
│   │   └── Bounty.css        # Bounty styles
│   ├── services/
│   │   └── topcoderService.js  # Topcoder API integration
│   ├── App.jsx               # Main app with routing
│   ├── App.css               # App-level styles
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles
├── public/                   # Static assets
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies and scripts
```

## Design System

The app uses a consistent dark theme:
- Background: `#1a1a2e`
- Cards/Containers: `#16213e`
- Borders: `#2a2a4e`
- Text: `#eaeaea`
- Accents: Various colors for different elements

### Topcoder Track Colors
- **Development**: Blue gradient (`#4a9eff` to `#6bb5ff`)
- **Design**: Orange gradient (`#ff6b3d` to `#ff8c5c`)
- **Data Science**: Purple gradient (`#9c4aff` to `#b56bff`)
- **QA**: Green gradient (`#4aff8c` to `#6bffaa`)

## Topcoder Integration

### How It Works
1. The Timeline component automatically fetches active Topcoder challenges when loaded
2. Challenges are displayed alongside hardcoded events in the timeline
3. Each challenge bar is color-coded by its track (Dev/Design/DS/QA)
4. Clicking a challenge bar opens the challenge details page on Topcoder
5. The data is fetched fresh on each page load

### API Integration
- **Endpoint**: `https://api.topcoder.com/v5/challenges`
- **Filters**: Active challenges across Dev, Design, Data Science, and QA tracks
- **Data Extracted**:
  - Challenge name
  - Registration end date
  - Submission end date
  - Track type
  - Challenge ID for detail links

### Automated Updates
A GitHub Actions workflow (`.github/workflows/update-topcoder.yml`) is configured to:
- Run daily at midnight UTC
- Build the application to verify integration
- Can be manually triggered from the Actions tab

The workflow ensures the application stays up-to-date with dependencies and validates that the Topcoder integration continues to function correctly.

## Future Enhancements

- Add filtering and sorting for bounties
- Implement backend integration for bounty states
- Add user authentication
- Mobile app version
- Cache Topcoder challenges for better performance
- Add more detailed challenge information in tooltips

## License

Private repository - All rights reserved
