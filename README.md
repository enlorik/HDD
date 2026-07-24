# HDD

A React + Vite competitive programming dashboard for tracking Codeforces contests and getting personalised daily problem recommendations.

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

### 3. Daily Problems (`/daily`)
- One recommended Codeforces problem per topic tag across **34 tags**.
- Problems are personalised to your current rating and filtered to exclude problems you've already solved.
- Default rating of 1200 is used when no handle is set.
- Problem selection is deterministic by UTC date (same picks every day) and rotates daily.
- Rating badge colour coding: ≤ 1200 green, ≤ 1600 blue, ≤ 2000 orange, > 2000 red.
- Manual **🔄 Refresh** button to reload all cards.

### 4. Profile (`/profile`)
- Store your Codeforces handle locally.
- Data is saved to `localStorage` under the key `hdd-user-profile` — no account required.
- The handle is used by the Daily Problems page to fetch your rating and filter solved problems.

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Routing | React Router v7 |
| Styling | Per-component CSS files |
| State persistence | Browser `localStorage` |
| Production server | Express 5 (`server.js`) |
| Deployment | Railway |

## Project Structure

```
HDD/
├── public/
├── src/
│   ├── components/
│   │   ├── Timeline.jsx / .css
│   │   ├── Bounty.jsx / .css
│   │   ├── DailyProblems.jsx / .css
│   │   └── Profile.jsx / .css
│   ├── services/
│   │   ├── codeforcesService.js   # Contests, timeline helpers, daily problem logic
│   │   └── mockCodeforcesData.js  # Fallback mock data for development
│   └── App.jsx
├── server.js        # Express production server + Codeforces API proxy
├── railway.json     # Railway deployment config
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

In development the frontend calls the Codeforces API directly (no proxy needed).

### Build

```bash
npm run build       # outputs to dist/
npm run preview     # serve the production build locally
```

### Lint

```bash
npm run lint
```

## Production Server

`server.js` is an Express 5 server that:

- Serves the compiled Vite SPA from `dist/`.
- Proxies `GET /api/cf/:method` to `https://codeforces.com/api/:method`, forwarding any query parameters. This avoids browser CORS restrictions in production.
- Applies a simple in-memory rate limiter (60 requests/min per IP) to protect the proxy.

Start with:

```bash
npm start   # node server.js
```

## Deployment

The app is configured for [Railway](https://railway.app) via `railway.json`:

- **Build**: `npm run build` (Nixpacks builder)
- **Start**: `node server.js`
- **Restart policy**: on failure, up to 10 retries

## Design notes

**Why a proxy server for a frontend app** — Codeforces doesn't send CORS headers, so the browser can't call the API directly. The Express proxy handles that, and also scrapes problem statement HTML, which is impossible cross-origin from the browser. A side benefit: one chokepoint for rate limiting, so a buggy client can't hammer Codeforces and get the shared hosting IP temporarily banned.

**Why the daily pick is deterministic** — For the same date, rating, and solved-problem history, the pick is always identical. Refreshing doesn't reroll (no slot-machine effect), and the result is easy to test: fix the date and inputs, snapshot the expected output. Two users with the same rating and solved set get the same problem; users with different ratings or solved sets get different candidates and may get different picks — the pick is stable per user across the day, not globally uniform.

**Why the rating band is asymmetric [−100, +300]** — Practice should stretch, not repeat. A small floor below your current rating keeps a warm-up option available; the larger ceiling pushes toward difficulty. The asymmetry reflects the deliberate-practice idea that slightly-too-hard is more valuable for growth than slightly-too-easy.

**Why `Promise.allSettled` instead of `Promise.all`** — The daily page needs three things: the problemset, your user info, and your solved submissions. If one fetch fails (handle not set, Codeforces API hiccup), `allSettled` delivers whatever succeeded and lets the page render with sensible defaults. `Promise.all` would reject everything on a single partial failure and leave the page blank.
