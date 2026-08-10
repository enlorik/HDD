// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeOutput, outputsMatch } from './outputNormalize.js';

describe('normalizeOutput', () => {
  it('returns an empty string for non-strings', () => {
    expect(normalizeOutput(null)).toBe('');
    expect(normalizeOutput(undefined)).toBe('');
    expect(normalizeOutput(42)).toBe('');
  });

  it('leaves simple output unchanged', () => {
    expect(normalizeOutput('7')).toBe('7');
  });

  it('strips trailing newline', () => {
    expect(normalizeOutput('7\n')).toBe('7');
  });

  it('strips multiple trailing newlines', () => {
    expect(normalizeOutput('7\n\n\n')).toBe('7');
  });

  it('strips trailing spaces from lines', () => {
    expect(normalizeOutput('hello   \nworld\t')).toBe('hello\nworld');
  });

  it('strips trailing tabs from lines', () => {
    expect(normalizeOutput('a\t\tb\t')).toBe('a\t\tb');
  });

  it('converts CRLF to LF', () => {
    expect(normalizeOutput('hello\r\nworld\r\n')).toBe('hello\nworld');
  });

  it('converts lone CR to LF', () => {
    expect(normalizeOutput('hello\rworld\r')).toBe('hello\nworld');
  });

  it('preserves meaningful internal whitespace', () => {
    expect(normalizeOutput('  indented line\nnormal')).toBe('  indented line\nnormal');
  });

  it('preserves multiple lines without trailing content', () => {
    expect(normalizeOutput('1\n2\n3')).toBe('1\n2\n3');
  });
});

describe('outputsMatch', () => {
  it('matches identical outputs', () => {
    expect(outputsMatch('7', '7')).toBe(true);
  });

  it('matches outputs that differ only by trailing newline', () => {
    expect(outputsMatch('7\n', '7')).toBe(true);
    expect(outputsMatch('7', '7\n')).toBe(true);
  });

  it('matches outputs that differ only by CRLF vs LF', () => {
    expect(outputsMatch('hello\r\nworld\r\n', 'hello\nworld')).toBe(true);
  });

  it('matches when actual has trailing whitespace but expected does not', () => {
    expect(outputsMatch('hello   \nworld  \n', 'hello\nworld')).toBe(true);
  });

  it('does not match genuinely different outputs', () => {
    expect(outputsMatch('7', '8')).toBe(false);
  });

  it('does not match outputs with different content on a line', () => {
    expect(outputsMatch('1 2', '1 3')).toBe(false);
  });

  it('does not match when line count differs', () => {
    expect(outputsMatch('1\n2', '1\n2\n3')).toBe(false);
  });
});
