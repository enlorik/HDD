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
  { tag: 'dp',               displayName: 'Dynamic Programming' },
  { tag: 'graphs',           displayName: 'Graphs' },
  { tag: 'greedy',           displayName: 'Greedy' },
  { tag: 'math',             displayName: 'Math' },
  { tag: 'binary search',    displayName: 'Binary Search' },
  { tag: 'data structures',  displayName: 'Data Structures' },
  { tag: 'strings',          displayName: 'Strings' },
  { tag: 'number theory',    displayName: 'Number Theory' },
  { tag: 'two pointers',     displayName: 'Two Pointers' },
  { tag: 'implementation',   displayName: 'Implementation' },
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
 */
export async function fetchProblemsByTag(tag) {
  try {
    const res = await fetch(cfApiUrl('problemset.problems', { tags: tag }));
    const data = await res.json();
    if (data.status !== 'OK') return [];
    return (data.result?.problems ?? []).map(p => ({
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
      tags: p.tags,
    }));
  } catch {
    return [];
  }
}

/**
 * Pick one "daily" problem for a given tag, personalised to the user.
 *
 * Algorithm:
 * 1. Filter problems to those with rating in [userRating - 100, userRating + 300].
 * 2. Exclude problems already solved by the user.
 * 3. Prefer problems from recent contests (sort by contestId descending).
 * 4. From the top 20 eligible candidates, pick one deterministically using:
 *      index = Math.floor(Date.now() / 86400000) % candidates.length
 *    so it rotates daily but is stable within the same day.
 * 5. Return the chosen problem, or null if no eligible problems found.
 */
export async function getDailyProblem(tag, userRating, solvedIds) {
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
  const dayIndex = dateSeed % eligible.length;
  return eligible[dayIndex];
}

/**
 * Fetch daily problems for all tags.
 * Returns an array of { tag, displayName, problem } objects.
 * problem may be null for tags with no eligible problems.
 *
 * If handle is null/empty, skip solved-filtering and use a default rating of 1200.
 */
export async function fetchAllDailyProblems(handle) {
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

  const results = await Promise.all(
    CF_TAGS.map(async ({ tag, displayName }) => {
      const problem = await getDailyProblem(tag, userRating, solvedIds);
      return { tag, displayName, problem };
    })
  );

  return results;
}
