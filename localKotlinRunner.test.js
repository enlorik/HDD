// @vitest-environment node
import { execSync } from 'node:child_process';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import { runKotlinSamplesLocal } from './localKotlinRunner.js';

// These are real integration tests - they actually invoke kotlinc/java,
// not mocks. That's deliberate: the whole point of this module is "does
// compiling and running real Kotlin code actually work," which a mock
// can't prove. CI doesn't have kotlinc installed, so skip gracefully
// there rather than failing the build; run for real wherever Kotlin is
// available (which production now requires anyway).
function kotlincAvailable() {
  try {
    execSync(`${process.env.KOTLINC_BIN || 'kotlinc'} -version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const describeIfKotlinc = kotlincAvailable() ? describe : describe.skip;

describeIfKotlinc('runKotlinSamplesLocal (real kotlinc/java)', () => {
  it('reports a matching sample for a correct solution', async () => {
    const code = `fun main() {
      val (a, b) = readLine()!!.trim().split(" ").map { it.toInt() }
      println(a + b)
    }`;
    const results = await runKotlinSamplesLocal(
      code,
      [{ input: '2 3\n', output: '5\n' }],
      { cpu_time_limit: 2 }
    );
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('matches');
    expect(results[0].matches).toBe(true);
  }, 30_000);

  it('reports a mismatch for an incorrect solution', async () => {
    const code = `fun main() {
      val (a, b) = readLine()!!.trim().split(" ").map { it.toInt() }
      println(a - b)
    }`;
    const results = await runKotlinSamplesLocal(
      code,
      [{ input: '2 3\n', output: '5\n' }],
      { cpu_time_limit: 2 }
    );
    expect(results[0].status).toBe('mismatch');
    expect(results[0].matches).toBe(false);
    expect(results[0].stdout).toBe('-1\n');
  }, 30_000);

  it('reports a compilation_error for code that does not compile, with the real diagnostic', async () => {
    const code = `fun main() {
      val x: Int = "not an int"
      println(x)
    }`;
    const results = await runKotlinSamplesLocal(
      code,
      [{ input: '2 3\n', output: '5\n' }],
      { cpu_time_limit: 2 }
    );
    expect(results[0].status).toBe('compilation_error');
    expect(results[0].compileOutput).toMatch(/type mismatch/i);
  }, 30_000);

  it('kills an infinite loop and reports time_limit instead of hanging', async () => {
    const code = `fun main() {
      while (true) {
        // spin forever
      }
    }`;
    const results = await runKotlinSamplesLocal(
      code,
      [{ input: '2 3\n', output: '5\n' }],
      { cpu_time_limit: 1 }
    );
    expect(results[0].status).toBe('time_limit');
    expect(results[0].matches).toBe(false);
  }, 30_000);

  it('evaluates multiple samples independently, in order', async () => {
    const code = `fun main() {
      val (a, b) = readLine()!!.trim().split(" ").map { it.toInt() }
      println(a + b)
    }`;
    const results = await runKotlinSamplesLocal(
      code,
      [
        { input: '2 3\n', output: '5\n' },
        { input: '10 20\n', output: '30\n' },
        { input: '1 1\n', output: '3\n' }, // deliberately wrong expected value
      ],
      { cpu_time_limit: 2 }
    );
    expect(results).toHaveLength(3);
    expect(results[0].sample).toBe(1);
    expect(results[0].matches).toBe(true);
    expect(results[1].sample).toBe(2);
    expect(results[1].matches).toBe(true);
    expect(results[2].sample).toBe(3);
    expect(results[2].matches).toBe(false);
  }, 30_000);
});
