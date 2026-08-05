// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCFProblemStatement } from './cfStatementParser.js';

// ---------------------------------------------------------------------------
// Minimal but realistic Codeforces problem page HTML fixture.
// The structure mirrors the actual CF page HTML that the parser targets.
// ---------------------------------------------------------------------------
const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
<div class="problem-statement">
  <div class="header">
    <div class="title">A. Two Sum</div>
    <div class="time-limit">
      <div class="property-title">time limit per test</div>2 seconds
    </div>
    <div class="memory-limit">
      <div class="property-title">memory limit per test</div>256 megabytes
    </div>
    <div class="input-file">
      <div class="property-title">input</div>standard input
    </div>
    <div class="output-file">
      <div class="property-title">output</div>standard output
    </div>
  </div>

  <p>You are given two integers <span class="tex-span"><i>a</i></span> and <span class="tex-span"><i>b</i><sup>2</sup></span>.</p>
  <p>Print their sum.</p>

  <div class="input-specification">
    <div class="section-title">Input</div>
    <p>The first line contains two integers $a$ and $b$ ($1 <= a, b <= 10^9$).</p>
  </div>

  <div class="output-specification">
    <div class="section-title">Output</div>
    <p>Print a single integer — the sum of $a$ and $b$.</p>
  </div>

  <div class="sample-tests">
    <div class="section-title">Examples</div>
    <div class="sample-test">
      <div class="input">
        <div class="title">Input</div>
        <pre>3 4</pre>
      </div>
      <div class="output">
        <div class="title">Output</div>
        <pre>7</pre>
      </div>
    </div>
    <div class="sample-test">
      <div class="input">
        <div class="title">Input</div>
        <pre>1000000000 1000000000</pre>
      </div>
      <div class="output">
        <div class="title">Output</div>
        <pre>2000000000</pre>
      </div>
    </div>
  </div>

  <div class="note">
    <div class="section-title">Note</div>
    <p>In the first example the answer is 7.</p>
  </div>
</div>
</body>
</html>
`;

// A page that contains no .problem-statement (e.g. 404 page, wrong URL).
const FIXTURE_NO_STATEMENT = `
<!DOCTYPE html>
<html>
<body>
<div class="content">Page not found</div>
</body>
</html>
`;

// A problem with multiple paragraphs in the body and a multi-line sample.
const FIXTURE_MULTI_PARA = `
<!DOCTYPE html>
<html>
<body>
<div class="problem-statement">
  <div class="header">
    <div class="title">B. Multi Para</div>
    <div class="time-limit">
      <div class="property-title">time limit per test</div>1 second
    </div>
    <div class="memory-limit">
      <div class="property-title">memory limit per test</div>512 megabytes
    </div>
  </div>

  <p>First paragraph.</p>
  <p>Second paragraph.</p>
  <p>Third paragraph.</p>

  <div class="input-specification">
    <div class="section-title">Input</div>
    <p>First line is $n$.</p>
    <p>Second line contains $n$ integers.</p>
  </div>

  <div class="output-specification">
    <div class="section-title">Output</div>
    <p>Print the answer.</p>
  </div>

  <div class="sample-tests">
    <div class="section-title">Examples</div>
    <div class="sample-test">
      <div class="input">
        <div class="title">Input</div>
        <pre>3
1 2 3</pre>
      </div>
      <div class="output">
        <div class="title">Output</div>
        <pre>6</pre>
      </div>
    </div>
  </div>
</div>
</body>
</html>
`;

// A problem where Codeforces encodes newlines inside <pre> as <br> elements
// (the actual format used on the live Codeforces site).
const FIXTURE_BR_SAMPLES = `
<!DOCTYPE html>
<html>
<body>
<div class="problem-statement">
  <div class="header">
    <div class="title">C. Br Newlines</div>
    <div class="time-limit">
      <div class="property-title">time limit per test</div>2 seconds
    </div>
    <div class="memory-limit">
      <div class="property-title">memory limit per test</div>256 megabytes
    </div>
  </div>

  <p>Given $n$ integers, sort them.</p>

  <div class="input-specification">
    <div class="section-title">Input</div>
    <p>First line is $n$, second line is the integers.</p>
  </div>

  <div class="output-specification">
    <div class="section-title">Output</div>
    <p>Print sorted integers.</p>
  </div>

  <div class="sample-tests">
    <div class="section-title">Examples</div>
    <div class="sample-test">
      <div class="input">
        <div class="title">Input</div>
        <pre>3<br>1 3 2</pre>
      </div>
      <div class="output">
        <div class="title">Output</div>
        <pre>1<br>2<br>3</pre>
      </div>
    </div>
  </div>
</div>
</body>
</html>
`;

describe('parseCFProblemStatement', () => {
  it('returns null when there is no .problem-statement element', () => {
    expect(parseCFProblemStatement(FIXTURE_NO_STATEMENT)).toBeNull();
  });

  it('parses the problem title', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.title).toBe('A. Two Sum');
  });

  it('parses the time limit without the property-title label', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.timeLimit).toBe('2 seconds');
  });

  it('parses the memory limit without the property-title label', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.memoryLimit).toBe('256 megabytes');
  });

  it('parses statement body paragraphs', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.statement).toContain('You are given two integers');
    expect(result.statement).toContain('Print their sum');
  });

  it('does not include special section text in the statement body', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.statement).not.toContain('Input');
    expect(result.statement).not.toContain('Output');
    expect(result.statement).not.toContain('Note');
    expect(result.statement).not.toContain('Examples');
  });

  it('parses input specification without section-title', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.inputSpecification).toContain('two integers');
    expect(result.inputSpecification).not.toContain('Input');
  });

  it('parses output specification without section-title', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.outputSpecification).toContain('sum of');
    expect(result.outputSpecification).not.toContain('Output');
  });

  it('parses sample tests into input/output pairs', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0]).toEqual({ input: '3 4', output: '7' });
    expect(result.samples[1]).toEqual({
      input: '1000000000 1000000000',
      output: '2000000000',
    });
  });

  it('returns all expected fields', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result).toMatchObject({
      title: expect.any(String),
      timeLimit: expect.any(String),
      memoryLimit: expect.any(String),
      statement: expect.any(String),
      statementHtml: expect.any(String),
      inputSpecification: expect.any(String),
      inputSpecificationHtml: expect.any(String),
      outputSpecification: expect.any(String),
      outputSpecificationHtml: expect.any(String),
      samples: expect.any(Array),
    });
  });

  it('preserves sanitized Codeforces math markup for rendering', () => {
    const result = parseCFProblemStatement(FIXTURE_HTML);
    expect(result.statementHtml).toContain('<span class="tex-span"><i>a</i></span>');
    expect(result.statementHtml).toContain('<sup>2</sup>');
  });

  it('handles multi-paragraph statement and multi-line sample input', () => {
    const result = parseCFProblemStatement(FIXTURE_MULTI_PARA);
    expect(result.title).toBe('B. Multi Para');
    expect(result.statement).toContain('First paragraph');
    expect(result.statement).toContain('Second paragraph');
    expect(result.statement).toContain('Third paragraph');
    expect(result.samples[0].input).toBe('3\n1 2 3');
    expect(result.samples[0].output).toBe('6');
  });

  it('converts <br> tags in sample <pre> blocks to newlines', () => {
    const result = parseCFProblemStatement(FIXTURE_BR_SAMPLES);
    expect(result.samples[0].input).toBe('3\n1 3 2');
    expect(result.samples[0].output).toBe('1\n2\n3');
  });
});
