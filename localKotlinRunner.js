/**
 * Self-hosted Kotlin sample runner — compiles and runs user Kotlin code
 * directly via `kotlinc`/`java`, without depending on a third-party
 * execution API (Judge0/RapidAPI). Built because the RapidAPI Judge0
 * subscription backing this app stopped working (403 "not subscribed"),
 * and self-hosting Judge0 itself is blocked on Railway: Judge0 requires
 * the `isolate` sandbox, which needs --privileged Docker mode, and
 * Railway does not allow privileged containers.
 *
 * This is NOT a hardened multi-tenant sandbox (no cgroups/namespaces).
 * That's an intentional scope decision: this app has exactly one user
 * (its own owner) running their own code, so the real threat model is
 * "an accidental infinite loop or runaway output shouldn't wedge the
 * server" - not "a malicious stranger escaping the sandbox." A wall-clock
 * timeout that force-kills the process, an output-size cap, and running
 * each submission in its own disposable temp directory cover that.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { expandKotlinLibrary } from './kotlinLibrary.js';
import { outputsMatch } from './outputNormalize.js';

const COMPILE_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 1_000_000; // 1 MB cap on stdout/stderr, same ballpark as Judge0's own ceilings

function kotlincBin() {
  return process.env.KOTLINC_BIN || 'kotlinc';
}

function javaBin() {
  return process.env.JAVA_BIN || 'java';
}

/**
 * Run a command with a hard wall-clock timeout that SIGKILLs the process
 * (and its children) if it doesn't finish in time, and a maxBuffer-style
 * cap on collected output so a runaway println loop can't exhaust memory.
 */
function runWithTimeout(command, args, { cwd, input, timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env });

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;

    const killer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const cap = (chunk, acc) => {
      if (truncated) return acc;
      const next = acc + chunk;
      if (next.length > MAX_OUTPUT_BYTES) {
        truncated = true;
        child.kill('SIGKILL');
        return next.slice(0, MAX_OUTPUT_BYTES);
      }
      return next;
    };

    child.stdout.on('data', (chunk) => { stdout = cap(chunk.toString(), stdout); });
    child.stderr.on('data', (chunk) => { stderr = cap(chunk.toString(), stderr); });

    child.on('error', (err) => {
      clearTimeout(killer);
      resolve({ code: null, stdout, stderr: `${stderr}\n${err.message}`, timedOut, truncated });
    });

    child.on('close', (code) => {
      clearTimeout(killer);
      resolve({ code, stdout, stderr, timedOut, truncated });
    });

    if (input != null) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

/**
 * Compile + run user Kotlin code against each sample's stdin, comparing
 * actual vs. expected stdout per sample. Returns the same shape the
 * Judge0-backed runKotlinSamples() returns, so server.js and the frontend
 * don't need to know which backend produced it.
 */
export async function runKotlinSamplesLocal(code, samples, { cpu_time_limit }) {
  const sourceCode = await expandKotlinLibrary(code);
  const workDir = await mkdtemp(path.join(tmpdir(), 'hdd-kotlin-'));
  const sourcePath = path.join(workDir, 'Main.kt');
  const jarPath = path.join(workDir, 'main.jar');

  try {
    await writeFile(sourcePath, sourceCode, 'utf-8');

    const compile = await runWithTimeout(
      kotlincBin(),
      [sourcePath, '-include-runtime', '-d', jarPath],
      { cwd: workDir, timeoutMs: COMPILE_TIMEOUT_MS }
    );

    if (compile.timedOut) {
      const message = 'Compilation timed out.';
      return samples.map((s, i) => ({
        sample: i + 1,
        status: 'internal_error',
        matches: false,
        stdout: null,
        expected: s.output,
        stderr: message,
        compileOutput: message,
        time: null,
        memory: null,
      }));
    }

    if (compile.code !== 0) {
      return samples.map((s, i) => ({
        sample: i + 1,
        status: 'compilation_error',
        matches: false,
        stdout: null,
        expected: s.output,
        stderr: null,
        compileOutput: compile.stderr || compile.stdout || 'Compilation failed.',
        time: null,
        memory: null,
      }));
    }

    // Run each sample's stdin through the compiled jar, sequentially -
    // this is a single-user app with at most a handful of samples per
    // problem, so there's no need for the complexity of a worker pool.
    const results = [];
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const runTimeoutMs = Math.max(1000, Math.round(cpu_time_limit * 1000)) + 2000; // headroom for JVM startup
      const startedAt = Date.now();
      const run = await runWithTimeout(
        javaBin(),
        ['-jar', jarPath],
        { cwd: workDir, input: sample.input, timeoutMs: runTimeoutMs }
      );
      const elapsedSeconds = (Date.now() - startedAt) / 1000;

      if (run.timedOut) {
        results.push({
          sample: i + 1,
          status: 'time_limit',
          matches: false,
          stdout: run.stdout || null,
          expected: sample.output,
          stderr: run.stderr || null,
          compileOutput: null,
          time: elapsedSeconds,
          memory: null,
        });
        continue;
      }

      if (run.code !== 0) {
        results.push({
          sample: i + 1,
          status: 'runtime_error',
          matches: false,
          stdout: run.stdout || null,
          expected: sample.output,
          stderr: run.stderr || null,
          compileOutput: null,
          time: elapsedSeconds,
          memory: null,
        });
        continue;
      }

      const matches = outputsMatch(run.stdout ?? '', sample.output);
      results.push({
        sample: i + 1,
        status: matches ? 'matches' : 'mismatch',
        matches,
        stdout: run.stdout,
        expected: sample.output,
        stderr: run.stderr || null,
        compileOutput: null,
        time: elapsedSeconds,
        memory: null,
      });
    }

    return results;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
