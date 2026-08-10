// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LIMITS, mapJudge0Result, parseLimits, runKotlinSamples } from './judge0.js';

// ---------------------------------------------------------------------------
// parseLimits
// ---------------------------------------------------------------------------
describe('parseLimits', () => {
  it('parses a plain seconds value', () => {
    expect(parseLimits('2 seconds', '256 megabytes')).toEqual({
      cpu_time_limit: 2,
      memory_limit: 256 * 1024,
    });
  });

  it('parses decimal seconds', () => {
    expect(parseLimits('1.5 seconds', '256 megabytes')).toEqual({
      cpu_time_limit: 1.5,
      memory_limit: 262_144,
    });
  });

  it('parses various memory sizes', () => {
    expect(parseLimits('2 seconds', '512 megabytes')).toEqual({
      cpu_time_limit: 2,
      memory_limit: 512 * 1024,
    });
  });

  it('falls back to defaults when inputs are absent', () => {
    expect(parseLimits(undefined, undefined)).toEqual({
      cpu_time_limit: LIMITS.DEFAULT_CPU_SECONDS,
      memory_limit: LIMITS.DEFAULT_MEMORY_KB,
    });
  });

  it('falls back to defaults when inputs cannot be parsed', () => {
    expect(parseLimits('N/A', 'unknown')).toEqual({
      cpu_time_limit: LIMITS.DEFAULT_CPU_SECONDS,
      memory_limit: LIMITS.DEFAULT_MEMORY_KB,
    });
  });

  it('clamps CPU time to the safe maximum', () => {
    const { cpu_time_limit } = parseLimits('99 seconds', '256 megabytes');
    expect(cpu_time_limit).toBe(LIMITS.MAX_CPU_SECONDS);
  });

  it('clamps memory to the safe maximum', () => {
    const { memory_limit } = parseLimits('2 seconds', '99999 megabytes');
    expect(memory_limit).toBe(LIMITS.MAX_MEMORY_KB);
  });
});

// ---------------------------------------------------------------------------
// mapJudge0Result
// ---------------------------------------------------------------------------
describe('mapJudge0Result', () => {
  it('returns matches:true when stdout equals expected', () => {
    const r = mapJudge0Result({ status: { id: 3 }, stdout: '7\n', stderr: null, compile_output: null }, '7');
    expect(r.status).toBe('matches');
    expect(r.matches).toBe(true);
  });

  it('returns mismatch when stdout differs from expected', () => {
    const r = mapJudge0Result({ status: { id: 3 }, stdout: '8\n', stderr: null, compile_output: null }, '7');
    expect(r.status).toBe('mismatch');
    expect(r.matches).toBe(false);
  });

  it('maps status id 5 to time_limit', () => {
    const r = mapJudge0Result({ status: { id: 5 }, stdout: null, stderr: null, compile_output: null }, '7');
    expect(r.status).toBe('time_limit');
    expect(r.matches).toBe(false);
  });

  it('maps status id 6 to compilation_error', () => {
    const r = mapJudge0Result({ status: { id: 6 }, stdout: null, stderr: null, compile_output: 'error: unresolved reference' }, '7');
    expect(r.status).toBe('compilation_error');
    expect(r.matches).toBe(false);
    expect(r.compileOutput).toBe('error: unresolved reference');
  });

  it('maps status id 7 to runtime_error', () => {
    const r = mapJudge0Result({ status: { id: 7 }, stdout: null, stderr: 'SIGSEGV', compile_output: null }, '7');
    expect(r.status).toBe('runtime_error');
    expect(r.matches).toBe(false);
  });

  it('maps status id 13 to internal_error', () => {
    const r = mapJudge0Result({ status: { id: 13 }, stdout: null, stderr: null, compile_output: null }, '7');
    expect(r.status).toBe('internal_error');
    expect(r.matches).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runKotlinSamples — network calls are mocked
// ---------------------------------------------------------------------------
describe('runKotlinSamples', () => {
  const ORIG_JUDGE0_URL = process.env.JUDGE0_URL;

  beforeEach(() => {
    process.env.JUDGE0_URL = 'https://judge0.example.com';
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.JUDGE0_URL = ORIG_JUDGE0_URL;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockFetch(submitTokens, pollResults) {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/submissions/batch') && callCount === 0) {
        callCount++;
        return {
          ok: true,
          json: async () => submitTokens,
          text: async () => JSON.stringify(submitTokens),
        };
      }
      return {
        ok: true,
        json: async () => ({ submissions: pollResults }),
        text: async () => JSON.stringify({ submissions: pollResults }),
      };
    });
  }

  it('returns matching result when stdout matches expected', async () => {
    mockFetch(
      [{ token: 'abc' }],
      [{ status: { id: 3 }, stdout: '7\n', stderr: null, compile_output: null, time: '0.1', memory: 1024 }],
    );

    const promise = runKotlinSamples(
      'fun main() { println(7) }',
      [{ input: '', output: '7' }],
      { cpu_time_limit: 2, memory_limit: 262_144 },
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('matches');
    expect(results[0].matches).toBe(true);
    expect(results[0].sample).toBe(1);
    expect(results[0].expected).toBe('7');
  });

  it('returns mismatch when stdout does not match expected', async () => {
    mockFetch(
      [{ token: 'abc' }],
      [{ status: { id: 3 }, stdout: '8\n', stderr: null, compile_output: null, time: '0.1', memory: 1024 }],
    );

    const promise = runKotlinSamples(
      'fun main() { println(8) }',
      [{ input: '', output: '7' }],
      { cpu_time_limit: 2, memory_limit: 262_144 },
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results[0].status).toBe('mismatch');
    expect(results[0].matches).toBe(false);
  });

  it('returns compilation_error on status 6', async () => {
    mockFetch(
      [{ token: 'abc' }],
      [{ status: { id: 6 }, stdout: null, stderr: null, compile_output: 'error: unresolved reference: foo', time: null, memory: null }],
    );

    const promise = runKotlinSamples(
      'fun main() { foo() }',
      [{ input: '', output: '7' }],
      { cpu_time_limit: 2, memory_limit: 262_144 },
    );
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results[0].status).toBe('compilation_error');
    expect(results[0].compileOutput).toContain('error');
  });

  it('throws when JUDGE0_URL is not configured', async () => {
    const saved = process.env.JUDGE0_URL;
    process.env.JUDGE0_URL = '';
    try {
      await expect(
        runKotlinSamples('fun main() {}', [{ input: '', output: '' }], { cpu_time_limit: 2, memory_limit: 262_144 }),
      ).rejects.toThrow('JUDGE0_URL is not configured');
    } finally {
      process.env.JUDGE0_URL = saved;
    }
  });
});
