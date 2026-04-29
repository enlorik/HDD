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

// Export CF_TAGS so it can be used for category selection UI
export { CF_TAGS };

/**
 * Build a URL for the CF API.  Always route through the server proxy
 * to avoid browser CORS restrictions (now works in both dev and production).
 */
function cfApiUrl(method, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const query = qs ? `?${qs}` : '';
  return `/api/cf/${method}${query}`;
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
 * Returns a Set of strings like "1234A", "567B".
 */
export async function fetchUserSolvedIds(handle) {
  try {
    const res = await fetch(cfApiUrl('user.status', { handle, count: 10000 }));
    const data = await res.json();
    if (data.status !== 'OK') return new Set();
    const solved = new Set();
    for (const sub of data.result) {
      if (sub.verdict === 'OK' && sub.problem) {
        solved.add(`${sub.problem.contestId}${sub.problem.index}`);
      }
    }
    return solved;
  } catch {
    return new Set();
  }
}

/**
 * Fetch problems for a given tag from the CF problemset.
 * Returns array of problem objects: { contestId, index, name, rating, tags }
 * Throws an error if the HTTP response is not OK or the API returns a non-OK status.
 */
export async function fetchProblemsByTag(tag) {
  const res = await fetch(cfApiUrl('problemset.problems', { tags: tag }));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching problems for tag "${tag}"`);
  }
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`CF API error for tag "${tag}": ${data.comment || data.error || 'Unknown error'}`);
  }
  return (data.result?.problems ?? []).map(p => ({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags,
  }));
}

/**
 * Pick one "daily" problem for a given tag, personalised to the user.
 *
 * Algorithm:
 * 1. Filter problems to those with rating in [userRating - 100, userRating + 300].
 * 2. Exclude problems already solved by the user.
 * 3. Prefer problems from recent contests (sort by contestId descending).
 * 4. From the top 20 eligible candidates, pick one deterministically using:
 *      index = (Math.floor(Date.now() / 86400000) + offset) % candidates.length
 *    so it rotates daily but is stable within the same day.
 * 5. Return the chosen problem, or null if no eligible problems found.
 *
 * @param {string} tag - The problem tag to filter by
 * @param {number} userRating - User's rating for filtering problem difficulty
 * @param {Set} solvedIds - Set of problem IDs the user has already solved
 * @param {number} offset - Offset for selecting a different problem (default 0)
 */
export async function getDailyProblem(tag, userRating, solvedIds, offset = 0) {
  const problems = await fetchProblemsByTag(tag);

  const eligible = problems
    .filter(p =>
      p.rating != null &&
      p.rating >= userRating - 100 &&
      p.rating <= userRating + 300 &&
      !solvedIds.has(`${p.contestId}${p.index}`)
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
  const dayIndex = (dateSeed + offset) % eligible.length;
  return eligible[dayIndex];
}

/**
 * Run an array of async task functions with at most `concurrency` running at
 * a time, inserting a `delayMs` pause between batches to avoid rate-limit bursts.
 */
async function batchedPromiseAll(tasks, concurrency = 3, delayMs = 300) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
    if (i + concurrency < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

/**
 * Fetch daily problems for selected tags.
 * Returns an array of { tag, displayName, problem, error? } objects.
 * problem may be null for tags with no eligible problems.
 * error is true when the fetch itself failed (network error, rate limit, etc.).
 *
 * @param {string|null} handle - Codeforces handle (null for default rating)
 * @param {Array<string>} selectedTags - Array of tag strings to fetch (defaults to first 5)
 * @param {Object} offsets - Map of tag -> offset for getting different problems
 *
 * If handle is null/empty, skip solved-filtering and use a default rating of 1200.
 */
export async function fetchAllDailyProblems(handle, selectedTags = null, offsets = {}) {
  let userRating = 1200;
  let solvedIds = new Set();

  if (handle) {
    const [info, solved] = await Promise.all([
      fetchUserInfo(handle),
      fetchUserSolvedIds(handle),
    ]);
    if (info) userRating = info.rating;
    solvedIds = solved;
  }

  // If no tags selected, use first 5 as default
  const tagsToFetch = selectedTags || CF_TAGS.slice(0, 5).map(t => t.tag);

  const tasks = tagsToFetch.map((tagString) => async () => {
    const tagInfo = CF_TAGS.find(t => t.tag === tagString);
    if (!tagInfo) return null;

    const { tag, displayName } = tagInfo;
    const offset = offsets[tag] || 0;

    try {
      const problem = await getDailyProblem(tag, userRating, solvedIds, offset);
      return { tag, displayName, problem };
    } catch (err) {
      console.error(`[daily] Failed to load tag "${tag}":`, err.message);
      return { tag, displayName, problem: null, error: true };
    }
  });

  const results = await batchedPromiseAll(tasks, 3, 300);
  return results.filter(r => r !== null);
}
