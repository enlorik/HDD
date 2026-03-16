/**
 * Service for fetching Timus Online Judge problems and handling submissions
 */

const TIMUS_PROBLEMS_URL = '/timus-problems.json';
const TIMUS_BASE_URL = 'https://acm.timus.ru';

/**
 * Languages supported by Timus Online Judge for submission.
 * Each entry has a label shown in the UI and the value passed to the submission URL.
 */
export const TIMUS_LANGUAGES = [
  { label: 'GNU C++17', value: '93' },
  { label: 'GNU C++14', value: '88' },
  { label: 'GNU C++11', value: '75' },
  { label: 'Microsoft Visual C++ 2017', value: '90' },
  { label: 'GNU C11', value: '87' },
  { label: 'Java 11', value: '92' },
  { label: 'Python 3', value: '91' },
  { label: 'Free Pascal 3.0', value: '65' },
  { label: 'Haskell GHC 8.8', value: '94' },
  { label: 'Go 1.13', value: '95' },
  { label: 'Ruby 2.7', value: '96' },
];

/**
 * Fetch Timus problems, optionally filtered by category/tag, sorted by difficulty (easiest first)
 * @param {string|null} category - Tag/category to filter by, or null for all
 * @returns {Promise<{ problems: Array, categories: Array }>}
 */
export async function fetchTimusProblems(category = null) {
  try {
    const response = await fetch(TIMUS_PROBLEMS_URL);

    if (!response.ok) {
      throw new Error(`Failed to load Timus problems: HTTP ${response.status}`);
    }

    const data = await response.json();
    const allProblems = data.problems || [];
    const categories = data.categories || [];

    const filtered = category
      ? allProblems.filter(p =>
          // A non-empty tags array takes priority; fall back to the category
          // string when tags is absent or empty (e.g. volume-based scrape).
          Array.isArray(p.tags) && p.tags.length > 0
            ? p.tags.includes(category)
            : p.category === category
        )
      : allProblems;

    if (import.meta.env.DEV) {
      console.log(`[Timus] Loaded ${filtered.length} problems (category: ${category || 'all'})`);
    }

    return { problems: sortByDifficulty(filtered), categories };
  } catch (error) {
    console.error('Error fetching Timus problems:', error);
    throw error;
  }
}

/**
 * Attempt to fetch the set of problem IDs that a user has solved on Timus.
 *
 * In production (Railway) the request is routed through our server-side proxy
 * (/api/timus-solved/:judgeId) which avoids the browser Same-Origin Policy.
 * In development (or if the proxy is unreachable) the function falls back to
 * a direct cross-origin request, which will typically be blocked by CORS and
 * return null so the caller can fall back to manual tracking.
 *
 * @param {string} judgeId - The user's numeric Timus Judge ID
 * @returns {Promise<Set<number>|null>} Set of solved problem IDs, or null on failure
 */
export async function fetchUserSolvedProblems(judgeId) {
  if (!judgeId) return null;

  // ------------------------------------------------------------------
  // 1. Try the server-side proxy (works in production; no CORS issues)
  // ------------------------------------------------------------------
  try {
    const proxyUrl = `/api/timus-solved/${encodeURIComponent(judgeId)}`;
    const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      const ids = new Set((data.solvedIds || []).map(Number));
      if (import.meta.env.DEV) {
        console.log(`[Timus] Proxy: ${ids.size} solved problems for judge ID ${judgeId}`);
      }
      return ids.size > 0 ? ids : null;
    }
  } catch {
    // Proxy not available (e.g. local dev with Vite only) — fall through
  }

  // ------------------------------------------------------------------
  // 2. Direct cross-origin request (blocked by CORS in most browsers)
  // ------------------------------------------------------------------
  try {
    const url = `${TIMUS_BASE_URL}/author.aspx?id=${encodeURIComponent(judgeId)}&space=1&action=getstat`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) return null;

    const text = await response.text();
    // Extract problem IDs from links of the form: problem.aspx?space=1&num=XXXX
    const matches = [...text.matchAll(/problem\.aspx\?space=1&num=(\d+)/g)];
    const ids = new Set(matches.map(m => parseInt(m[1], 10)));

    if (import.meta.env.DEV) {
      console.log(`[Timus] Direct: ${ids.size} solved problems for judge ID ${judgeId}`);
    }

    return ids.size > 0 ? ids : null;
  } catch {
    // CORS block or network error — return null to signal fallback to manual tracking
    return null;
  }
}

/**
 * Sort problems by difficulty ascending (easiest first), then by id ascending
 * @param {Array} problems
 * @returns {Array}
 */
function sortByDifficulty(problems) {
  return [...problems].sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.id - b.id;
  });
}

/**
 * Get the URL for the Timus problem statement page
 * @param {number} problemId - Timus problem number
 * @returns {string}
 */
export function getProblemUrl(problemId) {
  return `${TIMUS_BASE_URL}/problem.aspx?space=1&num=${problemId}`;
}

/**
 * Get the URL for the Timus submission page, pre-filled with the problem number.
 * If a judgeId is provided it is included so Timus can identify the submitter.
 * If a language code is provided it is pre-selected on the submission form.
 * @param {number} problemId - Timus problem number
 * @param {string|null} judgeId - User's Timus judge ID (optional)
 * @param {string|null} language - Timus language code, e.g. '93' for GNU C++17 (optional)
 * @returns {string}
 */
export function getSubmissionUrl(problemId, judgeId = null, language = null) {
  const params = new URLSearchParams({ space: '1', num: String(problemId) });
  if (judgeId) {
    params.set('JudgeID', judgeId);
  }
  if (language) {
    params.set('Language', language);
  }
  return `${TIMUS_BASE_URL}/submit.aspx?${params.toString()}`;
}

/**
 * Open the Timus submission page for a problem in a new browser tab.
 * Direct browser-to-Timus POST is blocked by CORS, so we redirect the user
 * to the Timus website where they can submit using their account.
 * @param {number} problemId - Timus problem number
 * @param {string|null} judgeId - User's Timus judge ID (optional)
 * @param {string|null} language - Timus language code (optional)
 */
export function openSubmissionPage(problemId, judgeId = null, language = null) {
  const url = getSubmissionUrl(problemId, judgeId, language);
  window.open(url, '_blank', 'noopener,noreferrer');
}

