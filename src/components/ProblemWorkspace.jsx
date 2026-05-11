import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { fetchProblemStatement } from '../services/cfStatement';
import {
  getDraftStorageKey,
  parseProblemWorkspaceQuery,
} from '../utils/problemWorkspace';
import './ProblemWorkspace.css';

const DEFAULT_PLACEHOLDER = 'fun main() {\n\n}';

function loadDraft(storageKey) {
  try {
    return localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
}

function ProblemWorkspace() {
  const { contestId = '', index = '' } = useParams();
  const location = useLocation();

  const problemDetails = useMemo(() => {
    const stateProblem = location.state?.problem ?? {};
    const queryProblem = parseProblemWorkspaceQuery(location.search);

    return {
      name: stateProblem.name || queryProblem.name,
      rating: stateProblem.rating ?? queryProblem.rating,
      tags: stateProblem.tags?.length ? stateProblem.tags : queryProblem.tags,
    };
  }, [location.search, location.state]);

  const storageKey = useMemo(
    () => getDraftStorageKey(contestId, index),
    [contestId, index],
  );

  const [code, setCode] = useState(() => loadDraft(storageKey));

  // Statement fetch state
  const [stmtStatus, setStmtStatus] = useState('idle'); // 'idle' | 'loading' | 'ok' | 'error'
  const [statement, setStatement] = useState(null);
  const [stmtError, setStmtError] = useState('');

  useEffect(() => {
    if (!contestId || !index) return;
    let cancelled = false;
    setStmtStatus('loading');
    setStatement(null);
    setStmtError('');
    fetchProblemStatement(contestId, index)
      .then(data => {
        if (!cancelled) {
          setStatement(data);
          setStmtStatus('ok');
        }
      })
      .catch(err => {
        if (!cancelled) {
          setStmtError(err.message || 'Failed to load statement.');
          setStmtStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [contestId, index]);

  useEffect(() => {
    setCode(loadDraft(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, code);
    } catch (error) {
      console.error('Failed to save Codeforces draft:', error);
    }
  }, [code, storageKey]);

  const problemLink = `https://codeforces.com/problemset/problem/${contestId}/${index}`;

  const displayTitle =
    statement?.title || problemDetails.name || `${contestId} ${index}`;

  return (
    <div className="problem-workspace-page">
      <div className="problem-workspace-layout">
        {/* ---------------------------------------------------------------- */}
        {/* Left column: problem statement                                    */}
        {/* ---------------------------------------------------------------- */}
        <aside className="problem-workspace-panel problem-workspace-panel--statement">
          <div className="problem-workspace-section-label">Codeforces Problem</div>

          {stmtStatus === 'loading' && (
            <p className="problem-workspace-stmt-loading">Loading statement…</p>
          )}

          {stmtStatus === 'error' && (
            <div className="problem-workspace-stmt-error">
              <p>Could not load the problem statement.</p>
              <p className="problem-workspace-stmt-error-detail">{stmtError}</p>
              <a
                href={problemLink}
                target="_blank"
                rel="noopener noreferrer"
                className="problem-workspace-link"
              >
                Open on Codeforces ↗
              </a>
            </div>
          )}

          {(stmtStatus === 'idle' || stmtStatus === 'ok') && (
            <>
              <h1 className="problem-workspace-title">{displayTitle}</h1>

              <div className="problem-workspace-problem-id">
                {contestId} {index}
              </div>

              {(statement?.timeLimit || statement?.memoryLimit) && (
                <div className="problem-workspace-limits">
                  {statement.timeLimit && (
                    <span className="problem-workspace-limit-item">
                      ⏱ {statement.timeLimit}
                    </span>
                  )}
                  {statement.memoryLimit && (
                    <span className="problem-workspace-limit-item">
                      🗄 {statement.memoryLimit}
                    </span>
                  )}
                </div>
              )}

              <div className="problem-workspace-meta">
                {problemDetails.rating != null && (
                  <span className="problem-workspace-badge">
                    Rating {problemDetails.rating}
                  </span>
                )}
              </div>

              {problemDetails.tags?.length > 0 && (
                <div className="problem-workspace-tags">
                  {problemDetails.tags.map(tag => (
                    <span key={tag} className="problem-workspace-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {statement && (
                <div className="problem-workspace-stmt-body">
                  {statement.statement && (
                    <div className="problem-workspace-stmt-section">
                      <p className="problem-workspace-stmt-text">
                        {statement.statement}
                      </p>
                    </div>
                  )}

                  {statement.inputSpecification && (
                    <div className="problem-workspace-stmt-section">
                      <h3 className="problem-workspace-stmt-heading">Input</h3>
                      <p className="problem-workspace-stmt-text">
                        {statement.inputSpecification}
                      </p>
                    </div>
                  )}

                  {statement.outputSpecification && (
                    <div className="problem-workspace-stmt-section">
                      <h3 className="problem-workspace-stmt-heading">Output</h3>
                      <p className="problem-workspace-stmt-text">
                        {statement.outputSpecification}
                      </p>
                    </div>
                  )}

                  {statement.samples?.length > 0 && (
                    <div className="problem-workspace-stmt-section">
                      <h3 className="problem-workspace-stmt-heading">Examples</h3>
                      {statement.samples.map((sample, i) => (
                        <div key={i} className="problem-workspace-sample">
                          <div className="problem-workspace-sample-col">
                            <div className="problem-workspace-sample-label">Input</div>
                            <pre className="problem-workspace-sample-pre">
                              {sample.input}
                            </pre>
                          </div>
                          <div className="problem-workspace-sample-col">
                            <div className="problem-workspace-sample-label">Output</div>
                            <pre className="problem-workspace-sample-pre">
                              {sample.output}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <a
                href={problemLink}
                target="_blank"
                rel="noopener noreferrer"
                className="problem-workspace-link"
              >
                Open original Codeforces page ↗
              </a>
            </>
          )}
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Right column: editor + results                                    */}
        {/* ---------------------------------------------------------------- */}
        <section className="problem-workspace-main">
          <div className="problem-workspace-panel problem-workspace-panel--editor">
            <div className="problem-workspace-header">
              <h2>Kotlin</h2>
              <div className="problem-workspace-actions">
                <button type="button" disabled>
                  Run Samples
                </button>
                <button type="button" disabled>
                  Prepare Submit
                </button>
              </div>
            </div>

            <textarea
              className="problem-workspace-editor"
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder={DEFAULT_PLACEHOLDER}
              spellCheck="false"
              aria-label="Kotlin code editor"
            />
          </div>

          <div className="problem-workspace-panel problem-workspace-panel--results">
            <h2>Samples / Test Results</h2>
            <p>
              Sample execution and custom test output will appear here in a future update.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ProblemWorkspace;
