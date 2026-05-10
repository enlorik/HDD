import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAllDailyProblems, getProblemKey, pickDailyProblem } from './codeforcesService.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('codeforcesService helpers', () => {
  it('builds stable problem keys', () => {
    expect(getProblemKey({ contestId: 1234, index: 'A' })).toBe('1234-A');
  });

  it('excludes solved problems from daily picks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T00:00:00Z'));

    const problems = [
      { contestId: 200, index: 'A', rating: 1200 },
      { contestId: 199, index: 'B', rating: 1300 },
      { contestId: 198, index: 'C', rating: 1700 },
    ];

    const solvedIds = new Set(['200-A']);

    expect(pickDailyProblem(problems, 1200, solvedIds)).toEqual(problems[1]);
  });

  it('returns error entries when fetching the problemset fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));

    const problems = await fetchAllDailyProblems();

    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every(({ error, problem }) => error === true && problem === null)).toBe(true);
  });
});
