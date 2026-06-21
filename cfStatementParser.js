/**
 * Server-side helper: parse a Codeforces problem page HTML string into
 * structured, plain-text fields safe to return to the React frontend.
 *
 * Returns null when the page does not contain a `.problem-statement` element
 * (e.g. the problem/contest does not exist or the URL was wrong).
 */

import * as cheerio from 'cheerio';

const MATH_TOKEN_PATTERN = /(\$\$\$[\s\S]+?\$\$\$|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\n$]+?\$)/g;

const TEX_REPLACEMENTS = [
  [/\\leq?/g, '≤'],
  [/\\geq?/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\cdot/g, '⋅'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\ldots|\\dots/g, '…'],
  [/\\infty/g, '∞'],
  [/\\sum/g, '∑'],
  [/\\prod/g, '∏'],
  [/\\sqrt/g, '√'],
  [/\\log/g, 'log'],
  [/\\min/g, 'min'],
  [/\\max/g, 'max'],
  [/\\gcd/g, 'gcd'],
  [/\\bmod/g, 'mod'],
  [/\\mod/g, 'mod'],
  [/\\in/g, '∈'],
  [/\\notin/g, '∉'],
  [/\\to/g, '→'],
  [/\\rightarrow/g, '→'],
  [/\\left/g, ''],
  [/\\right/g, ''],
  [/\\,/g, ' '],
  [/\\ /g, ' '],
  [/\\_/g, '_'],
  [/\\\{/g, '{'],
  [/\\\}/g, '}'],
];

function stripMathDelimiters(token) {
  if (token.startsWith('$$$') && token.endsWith('$$$')) {
    return token.slice(3, -3);
  }
  if (token.startsWith('$$') && token.endsWith('$$')) {
    return token.slice(2, -2);
  }
  if (token.startsWith('\\[') && token.endsWith('\\]')) {
    return token.slice(2, -2);
  }
  if (token.startsWith('\\(') && token.endsWith('\\)')) {
    return token.slice(2, -2);
  }
  if (token.startsWith('$') && token.endsWith('$')) {
    return token.slice(1, -1);
  }
  return token;
}

function normalizeTex(tex) {
  let result = tex.trim();

  for (const [pattern, replacement] of TEX_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  return result
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMathMarkers(text) {
  return text.replace(MATH_TOKEN_PATTERN, token => normalizeTex(stripMathDelimiters(token)));
}

/**
 * Replace block-level children and <br> tags with newlines, then return the
 * trimmed text content of an element. This preserves paragraph breaks without
 * leaking any HTML tags to the caller.
 *
 * @param {import('cheerio').CheerioAPI} $ - cheerio root
 * @param {import('cheerio').Cheerio} el  - element to extract text from
 * @returns {string}
 */
function blockText($, el) {
  const clone = $(el).clone();
  clone.find('br').replaceWith('\n');
  clone.find('p').each((_, p) => {
    $(p).prepend('\n').append('\n');
  });
  return normalizeMathMarkers(clone
    .text()
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

/**
 * Parse a raw Codeforces problem page HTML string.
 *
 * @param {string} html - full HTML of the Codeforces problemset/problem page
 * @returns {{ title: string, timeLimit: string, memoryLimit: string,
 *             statement: string, inputSpecification: string,
 *             outputSpecification: string,
 *             samples: Array<{ input: string, output: string }> } | null}
 */
export function parseCFProblemStatement(html) {
  const $ = cheerio.load(html);

  const stmtEl = $('.problem-statement').first();
  if (!stmtEl.length) return null;

  const header = stmtEl.find('.header').first();

  // ---- title ----------------------------------------------------------------
  const title = normalizeMathMarkers(header.find('.title').first().text().trim());

  // ---- limits ---------------------------------------------------------------
  // The limit divs look like:
  //   <div class="time-limit">
  //     <div class="property-title">time limit per test</div>2 seconds
  //   </div>
  // We clone, remove the inner label, then read the remaining text.

  const timeLimitClone = header.find('.time-limit').clone();
  timeLimitClone.find('.property-title').remove();
  const timeLimit = timeLimitClone.text().trim();

  const memLimitClone = header.find('.memory-limit').clone();
  memLimitClone.find('.property-title').remove();
  const memoryLimit = memLimitClone.text().trim();

  // ---- problem statement body -----------------------------------------------
  // Collect direct children of .problem-statement that are NOT one of the
  // well-known named sections.
  const SKIP_CLASSES = new Set([
    'header',
    'input-specification',
    'output-specification',
    'sample-tests',
    'note',
  ]);

  const statementParts = [];
  stmtEl.children().each((_, child) => {
    const classes = ($(child).attr('class') || '').split(/\s+/);
    if (classes.some(c => SKIP_CLASSES.has(c))) return;
    const text = blockText($, child);
    if (text) statementParts.push(text);
  });
  const statement = statementParts.join('\n\n');

  // ---- input specification --------------------------------------------------
  const inputSpecClone = stmtEl.find('.input-specification').clone();
  inputSpecClone.find('.section-title').remove();
  const inputSpecification = blockText($, inputSpecClone);

  // ---- output specification -------------------------------------------------
  const outputSpecClone = stmtEl.find('.output-specification').clone();
  outputSpecClone.find('.section-title').remove();
  const outputSpecification = blockText($, outputSpecClone);

  // ---- sample tests ---------------------------------------------------------
  const samples = [];
  stmtEl.find('.sample-test').each((_, sampleEl) => {
    const input = $(sampleEl).find('.input pre').first().text().trim();
    const output = $(sampleEl).find('.output pre').first().text().trim();
    samples.push({ input, output });
  });

  return {
    title,
    timeLimit,
    memoryLimit,
    statement,
    inputSpecification,
    outputSpecification,
    samples,
  };
}
