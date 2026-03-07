/**
 * Service for fetching Timus Online Judge problems and handling submissions
 */

import { mockTimusProblems, mockTimusCategories } from './mockTimusData';

const TIMUS_PROBLEMS_URL = '/timus-problems.json';
const TIMUS_BASE_URL = 'https://acm.timus.ru';
const USE_MOCK_DATA = false; // Set to true to use mock data instead of static JSON

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
 * Fetch Timus problems, optionally filtered by category, sorted by difficulty (easiest first)
 * @param {string|null} category - Category to filter by, or null for all categories
 * @returns {Promise<{ problems: Array, categories: Array }>}
 */
export async function fetchTimusProblems(category = null) {
  if (USE_MOCK_DATA) {
    console.log('Using mock Timus data');
    const problems = category
      ? mockTimusProblems.filter(p => p.category === category)
      : mockTimusProblems;
    return Promise.resolve({
      problems: sortByDifficulty(problems),
      categories: mockTimusCategories
    });
  }

  try {
    const response = await fetch(TIMUS_PROBLEMS_URL);

    if (!response.ok) {
      throw new Error(`Failed to load Timus problems: HTTP ${response.status}`);
    }

    const data = await response.json();
    const allProblems = data.problems || [];
    const categories = data.categories || [];

    const filtered = category ? allProblems.filter(p => p.category === category) : allProblems;

    if (import.meta.env.DEV) {
      console.log(`[Timus] Loaded ${filtered.length} problems (category: ${category || 'all'})`);
    }

    return { problems: sortByDifficulty(filtered), categories };
  } catch (error) {
    console.error('Error fetching Timus problems:', error);
    if (import.meta.env.DEV) {
      console.log('Falling back to mock Timus data (DEV mode)');
      const problems = category
        ? mockTimusProblems.filter(p => p.category === category)
        : mockTimusProblems;
      return { problems: sortByDifficulty(problems), categories: mockTimusCategories };
    }
    throw error;
  }
}

/**
 * Attempt to fetch the set of problem IDs that a user has solved on Timus.
 * Timus does not expose a CORS-friendly JSON API, so this request will typically
 * be blocked by the browser's same-origin policy.  The function returns null
 * when it cannot retrieve the data so the caller can fall back to manual tracking.
 *
 * @param {string} judgeId - The user's numeric Timus Judge ID
 * @returns {Promise<Set<number>|null>} Set of solved problem IDs, or null on failure
 */
export async function fetchUserSolvedProblems(judgeId) {
  if (!judgeId) return null;

  try {
    // Timus author page lists all accepted solutions; we attempt a no-cors fetch
    // to see if CORS headers permit reading the response.
    const url = `${TIMUS_BASE_URL}/author.aspx?id=${encodeURIComponent(judgeId)}&space=1&action=getstat`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) return null;

    const text = await response.text();
    // Extract problem IDs from links of the form: problem.aspx?space=1&num=XXXX
    const matches = [...text.matchAll(/problem\.aspx\?space=1&num=(\d+)/g)];
    const ids = new Set(matches.map(m => parseInt(m[1], 10)));

    if (import.meta.env.DEV) {
      console.log(`[Timus] Fetched ${ids.size} solved problems for judge ID ${judgeId}`);
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
 * @param {number} problemId - Timus problem number
 * @param {string|null} judgeId - User's Timus judge ID (optional)
 * @returns {string}
 */
export function getSubmissionUrl(problemId, judgeId = null) {
  const params = new URLSearchParams({ space: '1', num: String(problemId) });
  if (judgeId) {
    params.set('JudgeID', judgeId);
  }
  return `${TIMUS_BASE_URL}/submit.aspx?${params.toString()}`;
}

/**
 * Open the Timus submission page for a problem in a new browser tab.
 * Direct browser-to-Timus POST is blocked by CORS, so we redirect the user
 * to the Timus website where they can submit using their account.
 * @param {number} problemId - Timus problem number
 * @param {string|null} judgeId - User's Timus judge ID (optional)
 */
export function openSubmissionPage(problemId, judgeId = null) {
  const url = getSubmissionUrl(problemId, judgeId);
  window.open(url, '_blank', 'noopener,noreferrer');
}

