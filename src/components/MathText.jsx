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

function splitMathText(text) {
  if (!text) return [];

  const parts = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MATH_TOKEN_PATTERN)) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    parts.push({
      type: 'math',
      value: normalizeTex(stripMathDelimiters(match[0])),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

function MathText({ text, className = '' }) {
  const parts = splitMathText(text);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'math') {
          return (
            <span key={index} className="problem-workspace-math-token">
              {part.value}
            </span>
          );
        }

        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
}

export { splitMathText };
export default MathText;
