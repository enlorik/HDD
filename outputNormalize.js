/**
 * Normalize program output before comparing against the expected sample.
 *
 * Rules applied (in order):
 *   1. CRLF and lone CR -> LF
 *   2. Trailing spaces/tabs stripped from every line
 *   3. Trailing empty lines removed
 *
 * Meaningful whitespace inside a line is not modified.
 */
export function normalizeOutput(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function outputsMatch(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
