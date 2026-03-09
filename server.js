/**
 * Production server for Railway deployment.
 *
 * Serves the built Vite SPA from the `dist` directory and provides a
 * server-side proxy endpoint for fetching a user's Timus solved-problem
 * list.  The proxy avoids the browser CORS restriction that prevents the
 * SPA from reading data from acm.timus.ru directly.
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
const TIMUS_BASE = 'acm.timus.ru';

// Pre-load index.html once at startup so the SPA fallback route
// does not perform a file-system read on every request.
const INDEX_HTML = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter for the proxy endpoint.
// Each IP is allowed at most RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;           // requests per window per IP
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
// Proxy: GET /api/timus-solved/:judgeId
// Fetches the Timus author-stats page server-side and returns the list of
// solved problem IDs as JSON, sidestepping the browser Same-Origin Policy.
// ---------------------------------------------------------------------------
app.get('/api/timus-solved/:judgeId', rateLimit, (req, res) => {
  const { judgeId } = req.params;

  // Only allow numeric judge IDs to prevent SSRF / path-traversal attacks.
  if (!/^\d+$/.test(judgeId)) {
    return res.status(400).json({ error: 'Invalid judge ID – must be numeric.' });
  }

  const timusPath = `/author.aspx?id=${judgeId}&space=1&action=getstat`;
  const options = {
    hostname: TIMUS_BASE,
    path: timusPath,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HDD-App/1.0)',
      Accept: 'text/html',
    },
  };

  const request = https.get(options, (timusRes) => {
    if (timusRes.statusCode !== 200) {
      res.status(502).json({ error: `Timus returned HTTP ${timusRes.statusCode}` });
      timusRes.resume();
      return;
    }

    const chunks = [];
    timusRes.on('data', (chunk) => { chunks.push(chunk); });
    timusRes.on('end', () => {
      // Solved problem IDs are extracted from <td class="accepted"> cells on
      // the author stats page.  Each accepted cell contains a link of the form:
      //   <a href="status.aspx?space=1&num=1293&author=...">1293</a>
      // We extract the `num` parameter value from those links.
      const body = Buffer.concat(chunks).toString('latin1');
      const matches = [...body.matchAll(/class="accepted"[^>]*>\s*<a[^>]*[?&]num=(\d+)/g)];
      const solvedIds = [...new Set(matches.map((m) => parseInt(m[1], 10)))];
      res.json({ judgeId, solvedIds });
    });
  });

  request.on('error', (err) => {
    console.error('[proxy] Timus request failed:', err.message);
    res.status(502).json({ error: 'Failed to reach Timus.' });
  });

  request.setTimeout(12000, () => {
    request.destroy();
    res.status(504).json({ error: 'Timus request timed out.' });
  });
});

// ---------------------------------------------------------------------------
// SPA fallback – serve pre-loaded index.html for all unmatched routes so
// that client-side routing (react-router-dom) works on hard refresh / URL.
// ---------------------------------------------------------------------------
app.get('*', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(INDEX_HTML);
});

app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
