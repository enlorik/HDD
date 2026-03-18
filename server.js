/**
 * Production server for Railway deployment.
 *
 * Serves the built Vite SPA from the `dist` directory and provides a
 * server-side proxy for the Codeforces API to avoid browser CORS
 * restrictions.
 */

import express from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const CF_BASE = 'codeforces.com';

// Pre-load index.html once at startup so the SPA fallback route
// does not perform a file-system read on every request.
const INDEX_HTML = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter for the proxy endpoint.
// Each IP is allowed at most RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;           // requests per window per IP
const rateLimitMap = new Map();      // ip -> { count, resetAt }

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests – please wait a moment and try again.' });
  }

  entry.count += 1;
  return next();
}

// ---------------------------------------------------------------------------
// Serve static assets produced by `npm run build`
// ---------------------------------------------------------------------------
app.use(express.static(DIST_DIR));

// ---------------------------------------------------------------------------
// Proxy: GET /api/cf/:method
// Proxies requests to the Codeforces API (https://codeforces.com/api/:method)
// with whatever query string was passed.  Validates the method name to
// contain only alphanumeric characters and dots to prevent SSRF attacks.
// ---------------------------------------------------------------------------
app.get('/api/cf/:method', rateLimit, (req, res) => {
  const { method } = req.params;

  // Only allow safe method names (e.g. "user.info", "problemset.problems").
  if (!/^[a-zA-Z0-9.]+$/.test(method)) {
    return res.status(400).json({ error: 'Invalid method name.' });
  }

  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const cfPath = `/api/${method}${qs}`;
  const options = {
    hostname: CF_BASE,
    path: cfPath,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HDD-App/1.0)',
      Accept: 'application/json',
    },
  };

  const request = https.get(options, (cfRes) => {
    if (cfRes.statusCode !== 200) {
      res.status(502).json({ error: `Codeforces returned HTTP ${cfRes.statusCode}` });
      cfRes.resume();
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    cfRes.pipe(res);
  });

  request.on('error', (err) => {
    console.error('[proxy] Codeforces request failed:', err.message);
    res.status(502).json({ error: 'Failed to reach Codeforces.' });
  });

  request.setTimeout(15000, () => {
    request.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Codeforces request timed out.' });
    } else {
      res.end();
    }
  });
});

// ---------------------------------------------------------------------------
// SPA fallback – serve pre-loaded index.html for all unmatched routes so
// that client-side routing (react-router-dom) works on hard refresh / URL.
// ---------------------------------------------------------------------------
app.get('/{*splat}', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
