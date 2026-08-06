/**
 * Server-side helper: parse a Codeforces problem page HTML string into
 * structured fields safe to return to the React frontend.
 *
 * Returns null when the page does not contain a `.problem-statement` element
 * (e.g. the problem/contest does not exist or the URL was wrong).
 */

import * as cheerio from 'cheerio';

const ALLOWED_TAGS = new Set([
  'p', 'br', 'span', 'i', 'b', 'strong', 'em', 'sup', 'sub', 's', 'u',
  'ul', 'ol', 'li', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'code', 'pre', 'var',
]);

const ALLOWED_CLASS_PREFIXES = [
  'tex-',
  'MathJax',
  'mjx-',
];

function sanitizeClassName(className) {
  return className
    .split(/\s+/)
    .filter(name => ALLOWED_CLASS_PREFIXES.some(prefix => name.startsWith(prefix)))
    .join(' ');
}

/**
 * Return a conservative HTML fragment that preserves Codeforces' pre-rendered
 * math markup (for example tex-span, sup, sub and italic variables) while
 * stripping scripts, styles, event handlers, links and unrelated attributes.
 *
 * @param {import('cheerio').CheerioAPI} $ - cheerio root
 * @param {import('cheerio').Cheerio} el  - element to sanitize
 * @returns {string}
 */
function safeHtml($, el) {
  const clone = $(el).clone();
  clone.find('script, style, iframe, object, embed, link, meta').remove();

  clone.find('*').each((_, node) => {
    const tagName = node.tagName?.toLowerCase();
    const nodeEl = $(node);

    if (!ALLOWED_TAGS.has(tagName)) {
      nodeEl.replaceWith(nodeEl.contents());
      return;
    }

    const className = sanitizeClassName(nodeEl.attr('class') || '');
    for (const attr of Object.keys(node.attribs || {})) {
      nodeEl.removeAttr(attr);
    }
    if (className) {
      nodeEl.attr('class', className);
    }
  });

  return clone.html()?.trim() || '';
}

/**
 * Replace block-level children and <br> tags with newlines, then return the
 * trimmed text content of an element.  This preserves paragraph breaks without
 * leaking any HTML tags to the caller.
 *
 * @param {import('cheerio').CheerioAPI} $ - cheerio root
 * @param {import('cheerio').Cheerio} el  - element to extract text from
 * @returns {string}
 */

function sampleText($, preEl) {
  const $pre = $(preEl);
  const $divs = $pre.find('div');
  if ($divs.length) {
    return $divs.toArray()
      .map(div => $(div).text())
      .join('\n')
      .replace(/\r\n|\r/g, '\n')
      .trim();
  }
  const clone = $pre.clone();
  clone.find('br').replaceWith('\n');
  return clone.text().replace(/\r\n|\r/g, '\n').trim();
}

function blockText($, el) {
  const clone = $(el).clone();
  clone.find('br').replaceWith('\n');
  clone.find('p').each((_, p) => {
    $(p).prepend('\n').append('\n');
  });
  return clone
    .text()
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse a raw Codeforces problem page HTML string.
 *
 * @param {string} html - full HTML of the Codeforces problemset/problem page
 * @returns {{ title: string, timeLimit: string, memoryLimit: string,
 *             statement: string, statementHtml: string,
 *             inputSpecification: string, inputSpecificationHtml: string,
 *             outputSpecification: string, outputSpecificationHtml: string,
 *             samples: Array<{ input: string, output: string }> } | null}
 */
export function parseCFProblemStatement(html) {
  const $ = cheerio.load(html);

  const stmtEl = $('.problem-statement').first();
  if (!stmtEl.length) return null;

  const header = stmtEl.find('.header').first();

  // ---- title ----------------------------------------------------------------
  const title = header.find('.title').first().text().trim();

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
  const statementHtmlParts = [];
  stmtEl.children().each((_, child) => {
    const classes = ($(child).attr('class') || '').split(/\s+/);
    if (classes.some(c => SKIP_CLASSES.has(c))) return;
    const text = blockText($, child);
    if (text) statementParts.push(text);
    const html = safeHtml($, child);
    if (html) statementHtmlParts.push(html);
  });
  const statement = statementParts.join('\n\n');
  const statementHtml = statementHtmlParts.join('\n');

  // ---- input specification --------------------------------------------------
  const inputSpecClone = stmtEl.find('.input-specification').clone();
  inputSpecClone.find('.section-title').remove();
  const inputSpecification = blockText($, inputSpecClone);
  const inputSpecificationHtml = safeHtml($, inputSpecClone);

  // ---- output specification -------------------------------------------------
  const outputSpecClone = stmtEl.find('.output-specification').clone();
  outputSpecClone.find('.section-title').remove();
  const outputSpecification = blockText($, outputSpecClone);
  const outputSpecificationHtml = safeHtml($, outputSpecClone);

  // ---- sample tests ---------------------------------------------------------
  const samples = [];
  stmtEl.find('.sample-test').each((_, sampleEl) => {
    const input  = sampleText($, $(sampleEl).find('.input pre').first());
    const output = sampleText($, $(sampleEl).find('.output pre').first());
    samples.push({ input, output });
  });

  return {
    title,
    timeLimit,
    memoryLimit,
    statement,
    statementHtml,
    inputSpecification,
    inputSpecificationHtml,
    outputSpecification,
    outputSpecificationHtml,
    samples,
  };
}
