# HDD

A React + Vite web application featuring a timeline calendar dashboard and bounty board for tracking projects and challenges.

## Features

### 1. Timeline Dashboard
- Dark, calm dashboard-style UI (not a grid layout)
- Weekly view with weeks displayed as columns
- Vertical "Today" line marking the current week
- Rounded horizontal event bars spanning multiple weeks
- Color-coded events with hover effects
- Currently uses hardcoded data (ready for Topcoder contest integration)

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
├── src/
│   ├── components/
│   │   ├── Timeline.jsx      # Timeline calendar component
│   │   ├── Timeline.css      # Timeline styles
│   │   ├── Bounty.jsx        # Bounty board component
│   │   └── Bounty.css        # Bounty styles
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

## Future Enhancements

- Replace hardcoded timeline data with Topcoder contest data
- Add filtering and sorting for bounties
- Implement backend integration for bounty states
- Add user authentication
- Mobile app version

## License

Private repository - All rights reserved
