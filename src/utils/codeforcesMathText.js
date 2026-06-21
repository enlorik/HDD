const DELIMITERS = [
  ['$$$', '$$$'],
  ['\\\\(', '\\\\)'],
  ['\\\\[', '\\\\]'],
  ['$$', '$$'],
  ['$', '$'],
];

const TEX_REPLACEMENTS = [
  [/\\\\leq?/g, '≤'],
  [/\\\\geq?/g, '≥'],
  [/\\\\neq/g, '≠'],
  [/\\\\lt/g, '<'],
  [/\\\\gt/g, '>'],
  [/\\\\times/g, '×'],
  [/\\\\cdot/g, '·'],
  [/\\\\dots|\\\\ldots/g, '…'],
  [/\\\\oplus/g, '⊕'],
  [/\\\\infty/g, '∞'],
  [/\\\\sum/g, '∑'],
  [/\\\\prod/g, '∏'],
  [/\\\\sqrt\{([^{}]+)\}/g, '√($1)'],
  [/\\\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)'],
  [/\\\\left|\\\\right/g, ''],
  [/\\\\,/g, ' '],
];

const SUPERSCRIPT = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
};

const SUBSCRIPT = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  n: 'ₙ',
};

function scriptText(value, map) {
  return value
    .split('')
    .map(char => map[char] || char)
    .join('');
}

export function normalizeCodeforcesMath(value) {
  let text = value.trim();

  TEX_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text
    .replace(/\^\{([^{}]+)\}/g, (_, body) => scriptText(body, SUPERSCRIPT))
    .replace(/_\{([^{}]+)\}/g, (_, body) => scriptText(body, SUBSCRIPT))
    .replace(/\^([A-Za-z0-9()+\-=])/g, (_, body) => scriptText(body, SUPERSCRIPT))
    .replace(/_([A-Za-z0-9()+\-=])/g, (_, body) => scriptText(body, SUBSCRIPT))
    .replace(/\\\\([A-Za-z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

function findNextDelimiter(text, fromIndex) {
  let best = null;

  DELIMITERS.forEach(([open, close]) => {
    const index = text.indexOf(open, fromIndex);
    if (index === -1) return;

    if (!best || index < best.index || (index === best.index && open.length > best.open.length)) {
      best = { index, open, close };
    }
  });

  return best;
}

export function parseCodeforcesMathText(text = '') {
  const segments = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = findNextDelimiter(text, cursor);

    if (!next) {
      segments.push({ type: 'text', value: text.slice(cursor) });
      break;
    }

    if (next.index > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, next.index) });
    }

    const mathStart = next.index + next.open.length;
    const mathEnd = text.indexOf(next.close, mathStart);

    if (mathEnd === -1) {
      segments.push({ type: 'text', value: text.slice(next.index) });
      break;
    }

    segments.push({
      type: 'math',
      value: normalizeCodeforcesMath(text.slice(mathStart, mathEnd)),
    });

    cursor = mathEnd + next.close.length;
  }

  return segments.filter(segment => segment.value.length > 0);
}
