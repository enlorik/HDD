import { Buffer } from 'node:buffer';
import process from 'node:process';

const DEFAULT_REPOSITORY = 'enlorik/kotlin-cpp';
const DEFAULT_REF = 'main';
const DEFAULT_IMPORT_NAMESPACE = 'hdd.algos';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_LIBRARY_FILES = 100;
const MAX_LIBRARY_FILE_BYTES = 250_000;
const MAX_EXPANDED_SOURCE_BYTES = 750_000;

let cachedBundle = null;
let cachedBundleKey = '';
let cachedAt = 0;
let pendingBundle = null;

function configuredRepository() {
  const repository = process.env.KOTLIN_LIBRARY_REPOSITORY || DEFAULT_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('KOTLIN_LIBRARY_REPOSITORY must use the owner/repository format');
  }
  return repository;
}

function configuredRef() {
  const ref = process.env.KOTLIN_LIBRARY_REF || DEFAULT_REF;
  if (!/^[A-Za-z0-9._/-]+$/.test(ref) || ref.includes('..') || ref.startsWith('/') || ref.endsWith('/')) {
    throw new Error('KOTLIN_LIBRARY_REF contains unsupported characters');
  }
  return ref;
}

function configuredImportNamespace() {
  const namespace = process.env.KOTLIN_LIBRARY_IMPORT || DEFAULT_IMPORT_NAMESPACE;
  if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(namespace)) {
    throw new Error('KOTLIN_LIBRARY_IMPORT must be a dotted Kotlin identifier');
  }
  return namespace;
}

function rawUrl(repository, ref, filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(ref)}/${encodedPath}`;
}

function validateLibraryPath(filePath) {
  return typeof filePath === 'string'
    && filePath.endsWith('.kt')
    && filePath.length <= 200
    && !filePath.startsWith('/')
    && !filePath.includes('\\')
    && !filePath.split('/').some(part => part === '' || part === '.' || part === '..');
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'text/plain, application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Kotlin library fetch failed (HTTP ${response.status})`);
  }

  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_LIBRARY_FILE_BYTES) {
    throw new Error('Kotlin library file exceeds the maximum allowed size');
  }
  return text;
}

function splitLibraryDirectives(source, filePath) {
  const imports = [];
  const body = [];

  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*package\s+/.test(line)) continue;

    const importMatch = line.match(/^\s*import\s+(.+?)\s*;?\s*$/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    if (/^\s*@file:/.test(line)) {
      throw new Error(`Kotlin library file ${filePath} uses an unsupported file annotation`);
    }

    body.push(line);
  }

  const kotlin13Body = body
    .join('\n')
    // Judge0 CE language 78 uses Kotlin 1.3.70, where sumOf is not available.
    // The kotlin-cpp registry currently uses the Int-returning form below.
    .replace(/\.sumOf\s*\{\s*it\.size\s*\}/g, '.sumBy { it.size }')
    .trim();

  return { imports, body: kotlin13Body };
}

async function fetchLibraryBundle(fetchImpl) {
  const repository = configuredRepository();
  const ref = configuredRef();
  const registryText = await fetchText(rawUrl(repository, ref, 'tools/registry.json'), fetchImpl);

  let registry;
  try {
    registry = JSON.parse(registryText);
  } catch {
    throw new Error('Kotlin library registry is not valid JSON');
  }

  if (!Array.isArray(registry.files) || registry.files.length === 0) {
    throw new Error('Kotlin library registry does not list any files');
  }

  const files = [...new Set(registry.files)];
  if (files.length > MAX_LIBRARY_FILES || files.some(filePath => !validateLibraryPath(filePath))) {
    throw new Error('Kotlin library registry contains an unsafe or unsupported file path');
  }

  const sources = await Promise.all(
    files.map(async filePath => ({
      filePath,
      source: await fetchText(rawUrl(repository, ref, filePath), fetchImpl),
    })),
  );

  const imports = new Set();
  const bodies = [];
  for (const { filePath, source } of sources) {
    const part = splitLibraryDirectives(source, filePath);
    part.imports.forEach(value => imports.add(value));
    if (part.body) bodies.push(`// ${repository}/${filePath}\n${part.body}`);
  }

  const body = bodies.join('\n\n');
  if (/\bArrayDeque\s*</.test(body)) imports.add('java.util.ArrayDeque');

  return { body, imports: [...imports].sort(), repository, ref };
}

async function loadLibraryBundle(fetchImpl) {
  const key = `${configuredRepository()}@${configuredRef()}`;
  const now = Date.now();

  if (fetchImpl === globalThis.fetch && cachedBundle && cachedBundleKey === key && now - cachedAt < CACHE_TTL_MS) {
    return cachedBundle;
  }

  if (fetchImpl === globalThis.fetch && pendingBundle && cachedBundleKey === key) {
    return pendingBundle;
  }

  const request = fetchLibraryBundle(fetchImpl);
  if (fetchImpl !== globalThis.fetch) return request;

  cachedBundleKey = key;
  pendingBundle = request;
  try {
    cachedBundle = await request;
    cachedAt = Date.now();
    return cachedBundle;
  } finally {
    pendingBundle = null;
  }
}

function libraryImportPattern(namespace) {
  const escaped = namespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^\\s*import\\s+${escaped}(?:\\.\\*|\\.[A-Za-z_][A-Za-z0-9_]*)?(?:\\s+as\\s+[A-Za-z_][A-Za-z0-9_]*)?\\s*;?\\s*$`,
  );
}

function addImports(source, imports) {
  if (imports.length === 0) return source;

  const existing = new Set();
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*import\s+(.+?)\s*;?\s*$/);
    if (match) existing.add(match[1]);
  }

  const missing = imports.filter(value => !existing.has(value));
  if (missing.length === 0) return source;

  const lines = source.split('\n');
  const packageIndex = lines.findIndex(line => /^\s*package\s+/.test(line));
  let insertionIndex = packageIndex >= 0 ? packageIndex + 1 : 0;

  if (packageIndex < 0) {
    while (insertionIndex < lines.length && /^\s*(?:@file:|$)/.test(lines[insertionIndex])) {
      insertionIndex += 1;
    }
  }

  lines.splice(insertionIndex, 0, ...missing.map(value => `import ${value}`), '');
  return lines.join('\n');
}

export function resetKotlinLibraryCache() {
  cachedBundle = null;
  cachedBundleKey = '';
  cachedAt = 0;
  pendingBundle = null;
}

/**
 * Replaces HDD-only imports with the kotlin-cpp implementation immediately
 * before Judge0 submission. The editor and saved draft remain unchanged.
 */
export async function expandKotlinLibrary(code, { fetchImpl = globalThis.fetch } = {}) {
  const namespace = configuredImportNamespace();
  const importPattern = libraryImportPattern(namespace);
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const usesLibrary = lines.some(line => importPattern.test(line));

  if (!usesLibrary) return code;

  const userSource = lines.filter(line => !importPattern.test(line)).join('\n');
  const bundle = await loadLibraryBundle(fetchImpl);
  const sourceWithImports = addImports(userSource, bundle.imports);
  const expanded = `${sourceWithImports.trimEnd()}\n\n${bundle.body}\n`;

  if (Buffer.byteLength(expanded, 'utf8') > MAX_EXPANDED_SOURCE_BYTES) {
    throw new Error('Expanded Kotlin source exceeds the maximum allowed size');
  }

  return expanded;
}

