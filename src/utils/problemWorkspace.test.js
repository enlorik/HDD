import { describe, expect, it } from 'vitest';

import { getDraftStorageKey } from './problemWorkspace.js';

describe('problemWorkspace helpers', () => {
  it('builds per-problem draft storage keys', () => {
    expect(getDraftStorageKey(2050, 'C1')).toBe('hdd-codeforces-draft-2050-C1');
  });
});
