// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { expandKotlinLibrary, resetKotlinLibraryCache } from './kotlinLibrary.js';

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

describe('expandKotlinLibrary', () => {
  beforeEach(() => {
    resetKotlinLibraryCache();
    delete process.env.KOTLIN_LIBRARY_REPOSITORY;
    delete process.env.KOTLIN_LIBRARY_REF;
    delete process.env.KOTLIN_LIBRARY_IMPORT;
  });

  it('leaves ordinary Kotlin code unchanged without fetching the library', async () => {
    const fetchImpl = vi.fn();
    const code = 'fun main() { println(1) }';

    await expect(expandKotlinLibrary(code, { fetchImpl })).resolves.toBe(code);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('removes the virtual import and appends the registered library files', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/tools/registry.json')) {
        return response(JSON.stringify({ files: ['graph/GraphTypes.kt', 'graph/Queue.kt'] }));
      }
      if (url.endsWith('/graph/GraphTypes.kt')) {
        return response('class DSU(val n: Int)');
      }
      if (url.endsWith('/graph/Queue.kt')) {
        return response('class Queue { val q = ArrayDeque<Int>(); val size = listOf(q).sumOf { it.size } }');
      }
      return response('', 404);
    });

    const result = await expandKotlinLibrary(
      'import hdd.algos.*\n\nfun main() { println(DSU(3).n) }',
      { fetchImpl },
    );

    expect(result).not.toContain('import hdd.algos');
    expect(result).toContain('import java.util.ArrayDeque');
    expect(result).toContain('class DSU');
    expect(result).toContain('class Queue');
    expect(result).toContain('sumBy { it.size }');
    expect(result).not.toContain('sumOf');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('supports a specific virtual symbol import', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/tools/registry.json')) {
        return response(JSON.stringify({ files: ['graph/GraphTypes.kt'] }));
      }
      return response('class DSU(val n: Int)');
    });

    const result = await expandKotlinLibrary(
      'import hdd.algos.DSU\nfun main() { println(DSU(2).n) }',
      { fetchImpl },
    );

    expect(result).not.toContain('import hdd.algos.DSU');
    expect(result).toContain('class DSU');
  });

  it('rejects path traversal from a compromised registry', async () => {
    const fetchImpl = vi.fn(async () => response(JSON.stringify({ files: ['../secret.kt'] })));

    await expect(
      expandKotlinLibrary('import hdd.algos.*\nfun main() {}', { fetchImpl }),
    ).rejects.toThrow('unsafe or unsupported file path');
  });
});

