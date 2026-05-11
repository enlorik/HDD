/**
 * Frontend service for fetching a Codeforces problem statement from the
 * server-side parser endpoint.  Raw HTML is never sent to the browser;
 * the server returns structured plain-text fields only.
 */

/**
 * @typedef {{ title: string, timeLimit: string, memoryLimit: string,
 *             statement: string, inputSpecification: string,
 *             outputSpecification: string,
 *             samples: Array<{ input: string, output: string }> }} ProblemStatement
 */

/**
 * Fetch the parsed problem statement for a Codeforces problem.
 *
 * @param {string|number} contestId
 * @param {string} index  - e.g. "A", "B", "C1"
 * @returns {Promise<ProblemStatement>}
 */
export async function fetchProblemStatement(contestId, index) {
  const res = await fetch(`/api/cf/problem/${contestId}/${index}/statement`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
