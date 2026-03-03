/**
 * Service for fetching upcoming and active Codeforces contests
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
