/**
 * Service for fetching upcoming and active Codeforces contests, and for
 * generating personalised daily problem recommendations.
 */

import { mockCodeforcesContests } from './mockCodeforcesData';

const CODEFORCES_API_URL = 'https://codeforces.com/api/contest.list';
const USE_MOCK_DATA = false; // Set to true to use mock data instead of API

/**
 * Fetch upcoming and active Codeforces contests from the API
 * @returns {Promise<Array>} Array of contest objects
 */
export async function fetchCodeforcesContests() {
  if (USE_MOCK_DATA) {
    console.log('Using mock Codeforces data');
    return Promise.resolve(mockCodeforcesContests);
  }

  try {
    const params = new URLSearchParams({ gym: 'false' });
    const response = await fetch(`${CODEFORCES_API_URL}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Codeforces API error: ${data.comment || 'Unknown error'}`);
    }

    // Only include upcoming (BEFORE) and currently running (CODING) contests
    const activeContests = (data.result || []).filter(
      contest => contest.phase === 'BEFORE' || contest.phase === 'CODING'
    );

    if (import.meta.env.DEV) {
      console.log(`[Codeforces] Active/upcoming contests: ${activeContests.length}`);
    }

    return activeContests.map(contest => ({
      id: contest.id,
      name: contest.name,
      type: contest.type,
      phase: contest.phase,
      durationSeconds: contest.durationSeconds,
      startTimeSeconds: contest.startTimeSeconds,
      detailLink: `https://codeforces.com/contest/${contest.id}`
    }));
  } catch (error) {
    console.error('Error fetching Codeforces contests:', error);
    if (import.meta.env.DEV) {
      console.log('Falling back to mock Codeforces data (DEV mode)');
      return mockCodeforcesContests;
    }
    throw error;
  }
}

/**
 * Format Codeforces contests for timeline display
 * @param {Array} contests - Array of contest objects
 * @param {Date} referenceDate - Reference date for calculating week offsets
 * @returns {Array} Array of formatted events for timeline
 */
export function formatContestsForTimeline(contests, referenceDate = new Date()) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const getWeekOffset = (targetDate, refDate) => {
    const diff = targetDate - refDate;
    return Math.floor(diff / msPerWeek);
  };

  const getWeekDuration = (durationMs) => {
    // Enforce a minimum of 1 week so short contests (typically 2-3 hours)
    // remain visible on the weekly timeline view
    return Math.max(1, Math.ceil(durationMs / msPerWeek));
  };

  const getContestColors = (type) => {
    switch (type) {
      case 'CF':
        return { start: '#4a9eff', end: '#6bb5ff' };
      case 'IOI':
        return { start: '#ff6b3d', end: '#ff8c5c' };
      case 'ICPC':
        return { start: '#9c4aff', end: '#b56bff' };
      default:
        return { start: '#808080', end: '#a0a0a0' };
    }
  };

  return contests
    .filter(contest => contest.startTimeSeconds)
    .map(contest => {
      const startDate = new Date(contest.startTimeSeconds * 1000);
      const endDate = new Date((contest.startTimeSeconds + contest.durationSeconds) * 1000);
      const startWeek = getWeekOffset(startDate, referenceDate);
      const duration = getWeekDuration(endDate - startDate);
      const colors = getContestColors(contest.type);

      return {
        id: `codeforces-${contest.id}`,
        title: contest.name,
        startWeek,
        duration,
        gradient: `linear-gradient(90deg, ${colors.start} 0%, ${colors.end} 100%)`,
        type: 'codeforces',
        phase: contest.phase,
        detailLink: contest.detailLink,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        contestType: contest.type
      };
    });
}

// ---------------------------------------------------------------------------
// Daily problem recommendations
// ---------------------------------------------------------------------------

const CF_TAGS = [
  { tag: 'dp',                        displayName: 'Dynamic Programming' },
  { tag: 'dfs and similar',           displayName: 'DFS and Similar' },
  { tag: 'graphs',                    displayName: 'Graphs' },
  { tag: 'trees',                     displayName: 'Trees' },
  { tag: 'binary search',             displayName: 'Binary Search' },
  { tag: 'two pointers',              displayName: 'Two Pointers' },
  { tag: 'greedy',                    displayName: 'Greedy' },
  { tag: 'constructive algorithms',   displayName: 'Constructive Algorithms' },
  { tag: 'data structures',           displayName: 'Data Structures' },
  { tag: 'number theory',             displayName: 'Number Theory' },
  { tag: 'math',                      displayName: 'Math' },
  { tag: 'combinatorics',             displayName: 'Combinatorics' },
  { tag: 'brute force',               displayName: 'Brute Force' },
  { tag: 'implementation',            displayName: 'Implementation' },
  { tag: 'sortings',                  displayName: 'Sortings' },
  { tag: 'strings',                   displayName: 'Strings' },
  { tag: 'hashing',                   displayName: 'Hashing' },
  { tag: 'shortest paths',            displayName: 'Shortest Paths' },
  { tag: 'matrices',                  displayName: 'Matrices' },
  { tag: 'string suffix structures',  displayName: 'String Suffix Structures' },
  { tag: 'graph matchings',           displayName: 'Graph Matchings' },
  { tag: 'meet-in-the-middle',        displayName: 'Meet-in-the-Middle' },
  { tag: 'games',                     displayName: 'Games' },
  { tag: 'schedules',                 displayName: 'Schedules' },
  { tag: 'bitmasks',                  displayName: 'Bitmasks' },
  { tag: 'divide and conquer',        displayName: 'Divide and Conquer' },
  { tag: 'flows',                     displayName: 'Flows' },
  { tag: 'geometry',                  displayName: 'Geometry' },
  { tag: 'probabilities',             displayName: 'Probabilities' },
  { tag: 'ternary search',            displayName: 'Ternary Search' },
  { tag: '2-sat',                     displayName: '2-SAT' },
  { tag: 'chinese remainder theorem', displayName: 'Chinese Remainder Theorem' },
  { tag: 'fft',                       displayName: 'FFT' },
  { tag: 'expression parsing',        displayName: 'Expression Parsing' },
  { tag: 'dsu',                       displayName: 'DSU' },
];

/**
 * Build a URL for the CF API.  In production, route through the server proxy
 * to avoid browser CORS restrictions.  In development, call the CF API
 * directly (the Vite dev server doesn't proxy these paths).
 */
function cfApiUrl(method, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const query = qs ? `?${qs}` : '';
  if (import.meta.env.DEV) {
    return `https://codeforces.com/api/${method}${query}`;
  }
  return `/api/cf/${method}${query}`;
}

function getProblemKey(problem) {
  return `${problem.contestId}-${problem.index}`;
}

// ---------------------------------------------------------------------------
// Full problemset cache
// The entire CF problemset is fetched once per session and refreshed after TTL.
// ---------------------------------------------------------------------------

const PROBLEMSET_TTL_MS = 60 * 60 * 1000; // 1 hour

const _problemsetCache = {
  problems: null,    // Array of { contestId, index, name, rating, tags }
  tagIndex: null,    // Map<tag, problem[]>
  fetchedAt: 0,
};

/**
 * Fetch the full CF problemset once per TTL and cache it in memory.
 * Builds problems[] and a tagIndex map.
 * Returns the populated cache object.
 */
async function fetchFullProblemset() {
  const now = Date.now();
  if (_problemsetCache.problems && now - _problemsetCache.fetchedAt < PROBLEMSET_TTL_MS) {
    return _problemsetCache;
  }

  const res = await fetch(cfApiUrl('problemset.problems'));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching full problemset`);
  }
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`CF API error: ${data.comment || data.error || 'Unknown error'}`);
  }

  const problems = (data.result?.problems ?? []).map(p => ({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags,
  }));

  // Build tag -> problem[] index
  const tagIndex = new Map();
  for (const p of problems) {
    for (const t of (p.tags ?? [])) {
      if (!tagIndex.has(t)) tagIndex.set(t, []);
      tagIndex.get(t).push(p);
    }
  }

  _problemsetCache.problems = problems;
  _problemsetCache.tagIndex = tagIndex;
  _problemsetCache.fetchedAt = now;

  if (import.meta.env.DEV) {
    console.log(`[Codeforces] Cached ${problems.length} problems across ${tagIndex.size} tags`);
  }

  return _problemsetCache;
}

/**
 * Fetch user info (rating) for a CF handle.
 * Returns { rating: number } or null on failure.
 */
export async function fetchUserInfo(handle) {
  try {
    const res = await fetch(cfApiUrl('user.info', { handles: handle }));
    const data = await res.json();
    if (data.status !== 'OK' || !data.result?.length) return null;
    return { rating: data.result[0].rating ?? 1200 };
  } catch {
    return null;
  }
}

/**
 * Fetch all problem IDs the user has solved (AC submissions).
 * Returns a Set of strings like "1234-A", "567-B".
 */
export async function fetchUserSolvedIds(handle) {
  try {
    const res = await fetch(cfApiUrl('user.status', { handle, count: 10000 }));
    const data = await res.json();
    if (data.status !== 'OK') return new Set();
    const solved = new Set();
    for (const sub of data.result) {
      if (sub.verdict === 'OK' && sub.problem) {
        solved.add(getProblemKey(sub.problem));
      }
    }
    return solved;
  } catch {
    return new Set();
  }
}

/**
 * Fetch problems for a given tag from the cached full problemset.
 * Returns array of problem objects: { contestId, index, name, rating, tags }
 */
export async function fetchProblemsByTag(tag) {
  const { tagIndex } = await fetchFullProblemset();
  return tagIndex.get(tag) ?? [];
}

/**
 * Select one daily problem from a pool of candidate problems.
 * Filters by rating range and solved set, picks deterministically by UTC date.
 * Returns the chosen problem, or null if no eligible problems found.
 */
function pickDailyProblem(problems, userRating, solvedIds) {
  const eligible = problems
    .filter(p =>
      p.rating != null &&
      p.rating >= userRating - 100 &&
      p.rating <= userRating + 300 &&
      !solvedIds.has(getProblemKey(p))
    )
    .sort((a, b) => b.contestId - a.contestId)
    .slice(0, 20);

  if (!eligible.length) return null;

  // Build a numeric seed from the UTC calendar date (YYYYMMDD) so every user
  // sees the same problem on the same calendar day regardless of time zone.
  const today = new Date();
  const dateSeed =
    today.getUTCFullYear() * 10000 +
    (today.getUTCMonth() + 1) * 100 +
    today.getUTCDate();
  return eligible[dateSeed % eligible.length];
}

/**
 * Pick one "daily" problem for a given tag, personalised to the user.
 *
 * Algorithm:
 * 1. Look up problems for the tag in the cached tagIndex (no extra API call).
 * 2. Filter problems to those with rating in [userRating - 100, userRating + 300].
 * 3. Exclude problems already solved by the user.
 * 4. Prefer problems from recent contests (sort by contestId descending).
 * 5. From the top 20 eligible candidates, pick one deterministically using
 *    a seed derived from the UTC calendar date (YYYYMMDD) so every user sees
 *    the same problem on the same calendar day regardless of time zone.
 * 6. Return the chosen problem, or null if no eligible problems found.
 */
export async function getDailyProblem(tag, userRating, solvedIds) {
  const { tagIndex } = await fetchFullProblemset();
  return pickDailyProblem(tagIndex.get(tag) ?? [], userRating, solvedIds);
}

/**
 * Fetch daily problems for all tags.
 * Returns an array of { tag, displayName, problem, error? } objects.
 * problem may be null for tags with no eligible problems.
 * error is true when the initial fetch failed (network error, rate limit, etc.).
 *
 * Makes exactly one call to problemset.problems (cached for the session), plus
 * separate calls to user.info and user.status when a handle is provided.
 * If handle is null/empty, solved-filtering is skipped and rating defaults to 1200.
 */
export async function fetchAllDailyProblems(handle) {
  let userRating = 1200;
  let solvedIds = new Set();

  // Fetch the full problemset and user data concurrently.
  // fetchFullProblemset returns immediately from cache on subsequent calls.
  const [problemsetResult, infoResult, solvedResult] = await Promise.allSettled([
    fetchFullProblemset(),
    handle ? fetchUserInfo(handle) : Promise.resolve(null),
    handle ? fetchUserSolvedIds(handle) : Promise.resolve(new Set()),
  ]);

  if (problemsetResult.status !== 'fulfilled') {
    console.error('[daily] Failed to fetch full problemset:', problemsetResult.reason);
    return CF_TAGS.map(({ tag, displayName }) => ({ tag, displayName, problem: null, error: true }));
  }

  if (infoResult.status === 'fulfilled' && infoResult.value) {
    userRating = infoResult.value.rating;
  }
  if (solvedResult.status === 'fulfilled' && solvedResult.value) {
    solvedIds = solvedResult.value;
  }

  // All filtering is now local – no per-tag network calls needed.
  const { tagIndex } = problemsetResult.value;
  return CF_TAGS.map(({ tag, displayName }) => {
    try {
      const problem = pickDailyProblem(tagIndex.get(tag) ?? [], userRating, solvedIds);
      return { tag, displayName, problem };
    } catch (err) {
      console.error(`[daily] Failed to filter tag "${tag}":`, err.message);
      return { tag, displayName, problem: null, error: true };
    }
  });
}
