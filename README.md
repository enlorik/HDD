# HDD

A React + Vite competitive programming dashboard for tracking Codeforces contests and Timus Online Judge problems. Features a visual contest timeline, a bounty board of active contests, a full Timus problem browser with solved-status tracking, and a locally-stored user profile.

## Features

### 1. Codeforces Timeline (`/`)
- Weekly calendar layout showing upcoming and ongoing Codeforces contests.
- "Today" marker for at-a-glance date alignment.
- Color-coded contest types: CF (blue), IOI (orange), ICPC (purple).
- Toggle individual contests on or off; preferences persist across sessions via `localStorage`.
- Click any contest bar to open its Codeforces page.

### 2. Bounty Board (`/bounty`)
- Card grid of active and upcoming Codeforces contests.
- Each card shows the contest type badge, name, phase, and start date.
- Click a card to go directly to the Codeforces contest page.

### 3. Timus Problems (`/timus`)
- Browse 1,000+ Timus Online Judge problems loaded from a daily-updated JSON file.
- Filter by volume/category or toggle between unsolved / solved views.
- Color-coded difficulty levels: Easy (green), Medium (blue), Hard (orange), Expert (red).
- Mark problems solved or unsolved manually; status persists in `localStorage`.
- If a Judge ID is saved in your profile, solved problems are auto-synced from Timus on page load.
- Submit button opens the Timus submission form pre-filled with problem ID, Judge ID, and chosen language.

### 4. Problem Detail (`/timus/:id`)
- Detailed view for a single Timus problem.
- Shows metadata: difficulty, category, and total solve count.
- Language selector supporting 11 languages (C++17, C++14, Java, Python 3, etc.).
- Opens the Timus submission page in a new tab with fields pre-filled.
- Mark / unmark the problem as solved from this view.

### 5. Profile (`/profile`)
- Store your Timus username, Timus Judge ID, and Codeforces handle locally.
- Data is saved to `localStorage` under the key `hdd-user-profile` — no account required.
- Judge ID is used to pre-fill Timus submission forms and to auto-sync solved problems.

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Routing | React Router v7 |
| Styling | Per-component CSS files |
| State persistence | Browser `localStorage` |
| Deployment | Railway (Nix/serve) |
| CI / data refresh | GitHub Actions |

## Project Structure

```
HDD/
├── public/
│   └── timus-problems.json      # Daily-updated Timus problem list
├── scripts/
│   └── fetch_timus_problems.py  # Scraper that generates timus-problems.json
├── src/
│   ├── components/
│   │   ├── Timeline.jsx / .css
│   │   ├── Bounty.jsx / .css
│   │   ├── TimusProblems.jsx / .css
│   │   ├── ProblemDetail.jsx / .css
│   │   └── Profile.jsx / .css
│   ├── services/
│   │   ├── codeforcesService.js
│   │   └── timusService.js
│   └── App.jsx
├── .github/workflows/
│   └── update-timus-problems.yml  # Runs daily at 03:00 UTC
├── railway.json
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
npm run build       # outputs to dist/
npm run preview     # serve the production build locally
```

### Lint

```bash
npm run lint
```

## Automated Data Updates

The Timus problem list (`public/timus-problems.json`) is refreshed daily via a GitHub Actions workflow (`.github/workflows/update-timus-problems.yml`). The workflow:

1. Runs the Python scraper `scripts/fetch_timus_problems.py`.
2. Commits and pushes the updated JSON if any problems changed.

The workflow can also be triggered manually from the GitHub Actions UI.

## Deployment

The app is configured for [Railway](https://railway.app) via `railway.json`:

- **Build**: `npm run build` (Nixpacks builder)
- **Start**: `npx serve dist --listen $PORT`
- **Restart policy**: on failure, up to 10 retries