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
import { parseCFProblemStatement } from './cfStatementParser.js';
import { parseLimits, runKotlinSamples } from './judge0.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Trust the first proxy (Railway's load balancer) so req.ip reflects the real client IP.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const CF_BASE = 'codeforces.com';

// Pre-load index.html once at startup so the SPA fallback route
// does not perform a file-system read on every request.
const INDEX_HTML = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter factory.
// ---------------------------------------------------------------------------
function makeRateLimiter(windowMs, max) {
  const map = new Map();
  return function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = map.get(ip);

    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({ error: 'Too many requests – please wait a moment and try again.' });
    }

    entry.count += 1;
    return next();
  };
}

// Proxy endpoints: 60 requests/minute per IP
const rateLimit = makeRateLimiter(60_000, 60);

// Code execution: much stricter — 10 runs/minute per IP
const runRateLimit = makeRateLimiter(60_000, 10);

// ---------------------------------------------------------------------------
// Serve static assets produced by `npm run build`
// ---------------------------------------------------------------------------
app.use(express.static(DIST_DIR));
app.use(express.json({ limit: '256kb' }));

// ---------------------------------------------------------------------------
// Run Kotlin samples: POST /api/run/kotlin-samples
// Accepts { code, samples, timeLimit, memoryLimit }, submits to Judge0,
// polls for results, normalizes output, and returns per-sample verdicts.
// ---------------------------------------------------------------------------
app.post('/api/run/kotlin-samples', runRateLimit, async (req, res) => {
  const { code, samples, timeLimit, memoryLimit } = req.body ?? {};

  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'code must be a string.' });
  }
  if (code.length > 100_000) {
    return res.status(400).json({ error: 'code exceeds maximum allowed size.' });
  }
  if (!Array.isArray(samples)) {
    return res.status(400).json({ error: 'samples must be an array.' });
  }
  if (samples.length === 0) {
    return res.status(400).json({ error: 'samples must not be empty.' });
  }
  if (samples.length > 20) {
    return res.status(400).json({ error: 'samples must contain at most 20 entries.' });
  }
  for (const s of samples) {
    if (typeof s.input !== 'string' || typeof s.output !== 'string') {
      return res.status(400).json({ error: 'each sample must have string input and output fields.' });
    }
    if (s.input.length > 100_000) {
      return res.status(400).json({ error: 'sample input exceeds maximum allowed size.' });
    }
  }

  const limits = parseLimits(timeLimit, memoryLimit);

  try {
    const results = await runKotlinSamples(code, samples, limits);
    return res.json({ results });
  } catch (err) {
    console.error('[run] Judge0 error:', err.message);
    return res.status(502).json({ error: 'Failed to execute code. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Problem statement: GET /api/cf/problem/:contestId/:index/statement
// Fetches the Codeforces problem page server-side, parses it with cheerio,
// and returns structured plain-text fields – no raw HTML is forwarded.
// ---------------------------------------------------------------------------
app.get('/api/cf/problem/:contestId/:index/statement', rateLimit, (req, res) => {
  const { contestId, index } = req.params;

  if (!/^\d+$/.test(contestId)) {
    return res.status(400).json({ error: 'Invalid contestId: must be numeric.' });
  }
  if (!/^[a-zA-Z0-9]+$/.test(index)) {
    return res.status(400).json({ error: 'Invalid index: must be alphanumeric (e.g. A, B, C1).' });
  }

  const cfPath = `/problemset/problem/${contestId}/${index}`;
  const options = {
    hostname: CF_BASE,
    path: cfPath,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HDD-App/1.0)',
      Accept: 'text/html',
    },
  };

  let rawHtml = '';

  const request = https.get(options, (cfRes) => {
    if (cfRes.statusCode !== 200) {
      res.status(502).json({ error: `Codeforces returned HTTP ${cfRes.statusCode}` });
      cfRes.resume();
      return;
    }

    cfRes.setEncoding('utf-8');
    cfRes.on('data', chunk => { rawHtml += chunk; });
    cfRes.on('end', () => {
      const parsed = parseCFProblemStatement(rawHtml);
      if (!parsed) {
        return res.status(404).json({ error: 'Problem statement not found on Codeforces page.' });
      }
      res.json(parsed);
    });
  });

  request.on('error', (err) => {
    console.error('[statement] Codeforces request failed:', err.message);
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
