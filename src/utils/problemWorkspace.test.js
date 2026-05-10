import { describe, expect, it } from 'vitest';

import {
  buildProblemWorkspaceUrl,
  getDraftStorageKey,
  parseProblemWorkspaceQuery,
} from './problemWorkspace.js';

describe('problemWorkspace helpers', () => {
  it('builds per-problem draft storage keys', () => {
    expect(getDraftStorageKey(2050, 'C1')).toBe('hdd-codeforces-draft-2050-C1');
  });

  it('builds workspace URLs with available metadata only', () => {
    expect(
      buildProblemWorkspaceUrl({
        contestId: 2050,
        index: 'C1',
        name: 'Interesting Problem',
        rating: 1700,
        tags: ['dp', 'greedy'],
      }),
    ).toBe('/problem/2050/C1?name=Interesting+Problem&rating=1700&tags=dp%2Cgreedy');
  });

  it('parses workspace metadata from the query string', () => {
    expect(
      parseProblemWorkspaceQuery('?name=Interesting+Problem&rating=1700&tags=dp%2Cgreedy'),
    ).toEqual({
      name: 'Interesting Problem',
      rating: 1700,
      tags: ['dp', 'greedy'],
    });
  });
});
