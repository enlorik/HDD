import { describe, expect, it } from 'vitest';
import { renderMathInHtml, textToHtml } from './renderMath.js';

describe('renderMathInHtml', () => {
  it('renders Codeforces triple-dollar math delimiters', () => {
    const html = renderMathInHtml('<p>There are $$$n+1$$$ vertices.</p>');

    expect(html).toContain('<span class="problem-workspace-math"');
    expect(html).toContain('n+1');
    expect(html).not.toContain('$$$');
  });

  it('renders common Codeforces latex commands and superscripts', () => {
    const html = renderMathInHtml('<p>Range $$$0,1,\\dots,n^2$$$.</p>');

    expect(html).toContain('0,1,…,n<sup>2</sup>');
  });

  it('escapes plain-text fallbacks before adding paragraph markup', () => {
    expect(textToHtml('<script>x</script>\n\nnext')).toBe(
      '<p>&lt;script&gt;x&lt;/script&gt;</p><p>next</p>',
    );
  });
});
