export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeLatex(latex) {
  return latex
    .replace(/\\\\/g, '\\')
    .replace(/\\(?:ldots|dots|cdots)/g, '…')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\ne(?:q)?/g, '≠')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\oplus/g, '⊕')
    .replace(/\\infty/g, '∞')
    .replace(/\\sum/g, '∑')
    .replace(/\\min/g, 'min')
    .replace(/\\max/g, 'max')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\ /g, ' ')
    .replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, '$1');
}

export function renderMathExpression(latex) {
  let rendered = escapeHtml(normalizeLatex(latex).trim());

  rendered = rendered.replace(/\^\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '<sup>$1</sup>');
  rendered = rendered.replace(/_\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '<sub>$1</sub>');
  rendered = rendered.replace(/\^([A-Za-z0-9+-])/g, '<sup>$1</sup>');
  rendered = rendered.replace(/_([A-Za-z0-9+-])/g, '<sub>$1</sub>');

  return `<span class="problem-workspace-math" aria-label="${escapeHtml(latex.trim())}">${rendered}</span>`;
}

export function renderMathInHtml(html) {
  return html.replace(/\${1,3}([\s\S]*?)\${1,3}/g, (_, latex) => renderMathExpression(latex));
}

export function textToHtml(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map(paragraph => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`)
    .join('');
}
