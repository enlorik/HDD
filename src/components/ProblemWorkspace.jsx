import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { fetchProblemStatement } from '../services/cfStatement';
import {
  getDraftStorageKey,
  parseProblemWorkspaceQuery,
} from '../utils/problemWorkspace';
import './ProblemWorkspace.css';

const DEFAULT_KOTLIN_STARTER = `fun main() {
    // solve here
}`;

function loadDraft(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === null ? DEFAULT_KOTLIN_STARTER : saved;
  } catch {
    return DEFAULT_KOTLIN_STARTER;
  }
}

function StatementHtml({ html, fallback }) {
  if (html) {
    return (
      <div
        className="problem-workspace-stmt-text"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <p className="problem-workspace-stmt-text">{fallback}</p>;
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
  const [hasEdited, setHasEdited] = useState(false);
  const editorRef = useRef(null);
  const pendingCaretRef = useRef(null);

  // Statement fetch state
  const [stmtStatus, setStmtStatus] = useState('idle'); // 'idle' | 'loading' | 'ok' | 'error'
  const [statement, setStatement] = useState(null);
  const [stmtError, setStmtError] = useState('');

  useEffect(() => {
    if (!contestId || !index) return;
    let cancelled = false;

    async function loadStatement() {
      setStmtStatus('loading');
      setStatement(null);
      setStmtError('');
      try {
        const data = await fetchProblemStatement(contestId, index);
        if (!cancelled) {
          setStatement(data);
          setStmtStatus('ok');
        }
      } catch (err) {
        if (!cancelled) {
          setStmtError(err.message || 'Failed to load statement.');
          setStmtStatus('error');
        }
      }
    }

    loadStatement();
    return () => { cancelled = true; };
  }, [contestId, index]);

  useEffect(() => {
    function syncDraft() {
      setCode(loadDraft(storageKey));
      setHasEdited(false);
    }

    syncDraft();
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, code);
    } catch (error) {
      console.error('Failed to save Codeforces draft:', error);
    }
  }, [code, storageKey]);

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || !editorRef.current) {
      return;
    }

    editorRef.current.selectionStart = pendingCaretRef.current;
    editorRef.current.selectionEnd = pendingCaretRef.current;
    pendingCaretRef.current = null;
  }, [code]);

  const handleEditorChange = event => {
    setCode(event.target.value);
    setHasEdited(true);
  };

  const handleEditorKeyDown = event => {
    if (event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    const editor = event.currentTarget;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const spaces = '    ';
    const nextCode = `${code.slice(0, start)}${spaces}${code.slice(end)}`;

    setCode(nextCode);
    setHasEdited(true);

    pendingCaretRef.current = start + spaces.length;
  };

  const handleResetDraft = () => {
    const shouldReset = window.confirm(
      'Reset this local draft to the Kotlin starter code?',
    );

    if (!shouldReset) {
      return;
    }

    setCode(DEFAULT_KOTLIN_STARTER);
    setHasEdited(true);
  };

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
                      <StatementHtml
                        html={statement.statementHtml}
                        fallback={statement.statement}
                      />
                    </div>
                  )}

                  {statement.inputSpecification && (
                    <div className="problem-workspace-stmt-section">
                      <h3 className="problem-workspace-stmt-heading">Input</h3>
                      <StatementHtml
                        html={statement.inputSpecificationHtml}
                        fallback={statement.inputSpecification}
                      />
                    </div>
                  )}

                  {statement.outputSpecification && (
                    <div className="problem-workspace-stmt-section">
                      <h3 className="problem-workspace-stmt-heading">Output</h3>
                      <StatementHtml
                        html={statement.outputSpecificationHtml}
                        fallback={statement.outputSpecification}
                      />
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
                className="problem-workspace-link problem-workspace-link--secondary"
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
              <div className="problem-workspace-editor-heading">
                <h2>Kotlin</h2>
                <span className="problem-workspace-language-badge">.kt</span>
                <span
                  className="problem-workspace-editor-problem-id"
                  aria-label={`Problem ${contestId} ${index}`}
                >
                  {contestId} {index}
                </span>
              </div>
              <div className="problem-workspace-actions">
                {hasEdited && (
                  <span className="problem-workspace-save-status">
                    Saved locally
                  </span>
                )}
                <button
                  type="button"
                  className="problem-workspace-placeholder-btn"
                  disabled
                >
                  Run Samples
                </button>
                <button
                  type="button"
                  className="problem-workspace-placeholder-btn"
                  disabled
                >
                  Prepare Submit
                </button>
                <button
                  type="button"
                  className="problem-workspace-reset-btn"
                  onClick={handleResetDraft}
                >
                  Reset Draft
                </button>
              </div>
            </div>

            <textarea
              ref={editorRef}
              className="problem-workspace-editor"
              value={code}
              onChange={handleEditorChange}
              onKeyDown={handleEditorKeyDown}
              placeholder={DEFAULT_KOTLIN_STARTER}
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
