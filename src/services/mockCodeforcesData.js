/**
 * Mock Codeforces contests data for testing and development
 */

export const mockCodeforcesContests = [
  {
    id: 2001,
    name: 'Codeforces Round 2001 (Div. 1)',
    type: 'CF',
    phase: 'BEFORE',
    frozen: false,
    durationSeconds: 8100,
    startTimeSeconds: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 1 week from now
    relativeTimeSeconds: -(7 * 24 * 60 * 60)
  },
  {
    id: 2002,
    name: 'Codeforces Round 2002 (Div. 2)',
    type: 'CF',
    phase: 'CODING',
    frozen: false,
    durationSeconds: 7200,
    startTimeSeconds: Math.floor(Date.now() / 1000) - 3600, // started 1 hour ago
    relativeTimeSeconds: 3600
  },
  {
    id: 2003,
    name: 'ICPC World Finals 2025',
    type: 'ICPC',
    phase: 'BEFORE',
    frozen: false,
    durationSeconds: 18000,
    startTimeSeconds: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60, // 2 weeks from now
    relativeTimeSeconds: -(14 * 24 * 60 * 60)
  }
];
