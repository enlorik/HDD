import { expandKotlinLibrary } from './kotlinLibrary.js';
import { outputsMatch } from './outputNormalize.js';

function judge0Url() {
  return (process.env.JUDGE0_URL || '').replace(/\/$/, '');
}

function judge0ApiKey() {
  return process.env.JUDGE0_API_KEY || '';
}

function kotlinLanguageId() {
  return parseInt(process.env.JUDGE0_KOTLIN_LANGUAGE_ID || '111', 10);
}

export const LIMITS = {
  MAX_CPU_SECONDS: 10,
  MAX_MEMORY_KB: 256_000,  // Judge0 CE ceiling
  DEFAULT_CPU_SECONDS: 5,
  DEFAULT_MEMORY_KB: 262_144, // 256 MB
};

const POLL_INTERVAL_MS = 1_500;
const MAX_POLL_ATTEMPTS = 20;
const FETCH_TIMEOUT_MS = 30_000;

// Judge0 status IDs >= 3 are terminal (finished).
const TERMINAL_THRESHOLD = 3;

export function parseLimits(timeLimit, memoryLimit) {
  let cpu = LIMITS.DEFAULT_CPU_SECONDS;
  let mem = LIMITS.DEFAULT_MEMORY_KB;

  if (typeof timeLimit === 'string') {
    const m = timeLimit.match(/(\d+(?:\.\d+)?)\s*second/i);
    if (m) cpu = Math.min(parseFloat(m[1]), LIMITS.MAX_CPU_SECONDS);
  }

  if (typeof memoryLimit === 'string') {
    const m = memoryLimit.match(/(\d+(?:\.\d+)?)\s*megabyte/i);
    if (m) mem = Math.min(Math.round(parseFloat(m[1]) * 1024), LIMITS.MAX_MEMORY_KB);
  }

  return { cpu_time_limit: cpu, memory_limit: mem };
}

// When JUDGE0_RAPIDAPI_HOST is set, send RapidAPI headers (X-RapidAPI-Key / X-RapidAPI-Host).
// Otherwise, fall back to X-Auth-Token for a self-hosted Judge0 instance.
function authHeaders() {
  const key = judge0ApiKey();
  const rapidApiHost = process.env.JUDGE0_RAPIDAPI_HOST || '';
  if (key && rapidApiHost) {
    return { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': rapidApiHost };
  }
  if (key) return { 'X-Auth-Token': key };
  return {};
}

async function submitBatch(submissions) {
  const res = await fetch(`${judge0Url()}/submissions/batch?base64_encoded=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ submissions }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Judge0 submit failed (HTTP ${res.status}): ${text}`);
  }
  return res.json();
}

async function pollBatch(tokens) {
  const joined = tokens.join(',');
  const res = await fetch(
    `${judge0Url()}/submissions/batch?tokens=${joined}&base64_encoded=false`,
    { headers: authHeaders(), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Judge0 poll failed (HTTP ${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.submissions;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function mapJudge0Result(j0, sampleExpected) {
  const statusId = j0.status?.id ?? 13;
  const stdout = j0.stdout ?? null;

  if (statusId === 5) {
    return { status: 'time_limit', matches: false, stdout, stderr: j0.stderr ?? null, compileOutput: j0.compile_output ?? null };
  }
  if (statusId === 6) {
    return { status: 'compilation_error', matches: false, stdout, stderr: j0.stderr ?? null, compileOutput: j0.compile_output ?? null };
  }
  if (statusId >= 7 && statusId <= 12) {
    return { status: 'runtime_error', matches: false, stdout, stderr: j0.stderr ?? null, compileOutput: j0.compile_output ?? null };
  }
  if (statusId >= 13) {
    return { status: 'internal_error', matches: false, stdout, stderr: j0.stderr ?? null, compileOutput: j0.compile_output ?? null };
  }

  // Status 3 or 4: program finished — do our own comparison.
  const matches = outputsMatch(stdout ?? '', sampleExpected);
  return {
    status: matches ? 'matches' : 'mismatch',
    matches,
    stdout,
    stderr: j0.stderr ?? null,
    compileOutput: j0.compile_output ?? null,
  };
}

export async function runKotlinSamples(code, samples, { cpu_time_limit, memory_limit }) {
  if (!judge0Url()) throw new Error('JUDGE0_URL is not configured');

  const sourceCode = await expandKotlinLibrary(code);
  const submissions = samples.map(s => ({
    source_code: sourceCode,
    language_id: kotlinLanguageId(),
    stdin: s.input,
    cpu_time_limit,
    memory_limit,
  }));

  const tokenObjs = await submitBatch(submissions);
  const invalid = tokenObjs.find(t => typeof t.token !== 'string' || !t.token);
  if (invalid) throw new Error(`Judge0 rejected submission: ${invalid.error ?? 'unknown error'}`);
  const tokens = tokenObjs.map(t => t.token);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const results = await pollBatch(tokens);
    const allDone = results.every(r => (r.status?.id ?? 0) >= TERMINAL_THRESHOLD);

    if (allDone) {
      return results.map((j0, i) => {
        const { status, matches, stdout, stderr, compileOutput } = mapJudge0Result(j0, samples[i].output);
        return {
          sample: i + 1,
          status,
          matches,
          stdout,
          expected: samples[i].output,
          stderr,
          compileOutput,
          time: j0.time ?? null,
          memory: j0.memory ?? null,
        };
      });
    }
  }

  throw new Error('Timed out waiting for Judge0 results');
}
