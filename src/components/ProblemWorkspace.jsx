import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { fetchProblemStatement } from '../services/cfStatement';
import {
  getDraftStorageKey,
  parseProblemWorkspaceQuery,
} from '../utils/problemWorkspace';
import { renderMathInHtml, textToHtml } from '../utils/renderMath';
import { ikEditorExtensions } from './kotlinCodeMirrorTheme';
import './ProblemWorkspace.css';

const DEFAULT_KOTLIN_STARTER = `import hdd.algos.*

fun main() {
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
  const renderedHtml = renderMathInHtml(html || textToHtml(fallback));

  return (
    <div
      className="problem-workspace-stmt-text"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

const STATUS_LABEL = {
  matches: 'Matches sample',
  mismatch: 'Does not match sample',
  compilation_error: 'Compilation Error',
  runtime_error: 'Runtime Error',
  time_limit: 'Time Limit',
  internal_error: 'Internal Error',
};

function SampleResults({ runStatus, runResults, runError, hasSamples }) {
  if (!hasSamples) {
    return <p className="problem-workspace-run-placeholder">No samples available for this problem.</p>;
  }

  if (runStatus === 'idle') {
    return <p className="problem-workspace-run-placeholder">Run the sample tests to see results here.</p>;
  }

  if (runStatus === 'running') {
    return <p className="problem-workspace-run-placeholder">Running samples…</p>;
  }

  if (runStatus === 'error') {
    return <p className="problem-workspace-run-error">{runError}</p>;
  }

  if (!runResults?.length) {
    return <p className="problem-workspace-run-placeholder">No results returned.</p>;
  }

  // If every result has a compilation error, show the compile output once.
  const allCompileError = runResults.every(r => r.status === 'compilation_error');
  const sharedCompileOutput = allCompileError ? runResults[0].compileOutput : null;

  return (
    <div className="problem-workspace-results-list">
      {sharedCompileOutput && (
        <div className="problem-workspace-result-card problem-workspace-result-card--error">
          <div className="problem-workspace-result-status">Compilation Error</div>
          <div className="problem-workspace-result-label">Compiler output</div>
          <pre className="problem-workspace-result-pre">{sharedCompileOutput}</pre>
        </div>
      )}
      {runResults.map((r) => (
        <div
          key={r.sample}
          className={`problem-workspace-result-card problem-workspace-result-card--${r.matches ? 'ok' : 'fail'}`}
        >
          <div className="problem-workspace-result-header">
            <span className="problem-workspace-result-sample">Sample {r.sample}</span>
            <span className={`problem-workspace-result-status problem-workspace-result-status--${r.matches ? 'ok' : 'fail'}`}>
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
            {r.time != null && (
              <span className="problem-workspace-result-meta">{r.time}s</span>
            )}
            {r.memory != null && (
              <span className="problem-workspace-result-meta">{Math.round(r.memory / 1024)} MB</span>
            )}
          </div>
          <div className="problem-workspace-result-cols">
            <div className="problem-workspace-result-col">
              <div className="problem-workspace-result-label">Expected</div>
              <pre className="problem-workspace-result-pre">{r.expected}</pre>
            </div>
            <div className="problem-workspace-result-col">
              <div className="problem-workspace-result-label">Output</div>
              <pre className="problem-workspace-result-pre">{r.stdout ?? '(no output)'}</pre>
            </div>
          </div>
          {!allCompileError && r.compileOutput && (
            <>
              <div className="problem-workspace-result-label">Compiler output</div>
              <pre className="problem-workspace-result-pre problem-workspace-result-pre--err">{r.compileOutput}</pre>
            </>
          )}
          {r.stderr && (
            <>
              <div className="problem-workspace-result-label">Stderr</div>
              <pre className="problem-workspace-result-pre problem-workspace-result-pre--err">{r.stderr}</pre>
            </>
          )}
        </div>
      ))}
    </div>
  );
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
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [leftWidth, setLeftWidth] = useState(320);
  const containerRef = useRef(null);
  const runAbortRef = useRef(null);

  // Statement fetch state
  const [stmtStatus, setStmtStatus] = useState('idle'); // 'idle' | 'loading' | 'ok' | 'error'
  const [statement, setStatement] = useState(null);
  const [stmtError, setStmtError] = useState('');

  // Run samples state
  const [runStatus, setRunStatus] = useState('idle'); // 'idle' | 'running' | 'done' | 'error'
  const [runResults, setRunResults] = useState(null);
  const [runError, setRunError] = useState('');

  useEffect(() => {
    setRunStatus('idle');
    setRunResults(null);
    setRunError('');
    return () => { runAbortRef.current?.abort(); };
  }, [contestId, index]);

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

  const handleEditorChange = useCallback((value) => {
    setCode(value);
    setHasEdited(true);
  }, []);

  // Only call setCursorPos when the position actually changed. Without this
  // guard, every dispatch (including the no-op reconfigure effect below)
  // calls setCursorPos with a brand-new object every time, and since
  // useState compares by reference, React treats that as a real change and
  // re-renders - which recreates the editorBasicSetup object below, which
  // (per @uiw/react-codemirror's own reconfigure effect, keyed on that
  // object's identity) re-dispatches, calling this handler again. Confirmed
  // empirically before fixing: a single keystroke produced 4x the DOM
  // updates it should have, via a MutationObserver on the status bar.
  const handleEditorUpdate = useCallback((viewUpdate) => {
    const { state } = viewUpdate.view;
    const line = state.doc.lineAt(state.selection.main.head);
    const nextLine = line.number;
    const nextCol = state.selection.main.head - line.from + 1;
    setCursorPos(prev =>
      (prev.line === nextLine && prev.col === nextCol) ? prev : { line: nextLine, col: nextCol }
    );
  }, []);

  // Memoized so its reference stays stable across renders - passing a fresh
  // object literal here every render was the other half of the loop above.
  const editorBasicSetup = useMemo(() => ({
    tabSize: 4,
    highlightActiveLine: true,
    foldGutter: true,
  }), []);

  const canRunSamples =
    stmtStatus === 'ok' &&
    statement?.samples?.length > 0 &&
    runStatus !== 'running';

  const handleRunSamples = async () => {
    if (!canRunSamples) return;
    const controller = new AbortController();
    runAbortRef.current = controller;
    setRunStatus('running');
    setRunResults(null);
    setRunError('');
    try {
      const res = await fetch('/api/run/kotlin-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          samples: statement.samples,
          timeLimit: statement.timeLimit,
          memoryLimit: statement.memoryLimit,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setRunResults(data.results);
      setRunStatus('done');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setRunError(err.message || 'Failed to run samples.');
      setRunStatus('error');
    }
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

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    const onMouseMove = (ev) => {
      if (!containerRef.current) return;
      const left = containerRef.current.getBoundingClientRect().left;
      setLeftWidth(Math.min(800, Math.max(220, ev.clientX - left)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const problemLink = `https://codeforces.com/problemset/problem/${contestId}/${index}`;

  const displayTitle =
    statement?.title || problemDetails.name || `${contestId} ${index}`;

  return (
    <div className="problem-workspace-page">
      <div
        ref={containerRef}
        className="problem-workspace-layout"
        style={{ '--left-pane-width': `${leftWidth}px` }}
      >
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

                  {statement.samples?.length > 0 && statement.samples.map((sample, i) => (
                    <div key={i} className="problem-workspace-stmt-section">
                      <h3 className="problem-workspace-stmt-heading">Example {i + 1}</h3>
                      <div className="problem-workspace-sample">
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
                    </div>
                  ))}
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

        <div
          className="problem-workspace-divider"
          onMouseDown={handleDividerMouseDown}
          role="separator"
          aria-label="Resize panels"
        />

        {/* ---------------------------------------------------------------- */}
        {/* Right column: editor + results                                    */}
        {/* ---------------------------------------------------------------- */}
        <section className="problem-workspace-main">
          <div className="problem-workspace-panel problem-workspace-panel--editor">
            <div className="problem-workspace-header">
              <div className="problem-workspace-editor-tabs">
                <span className="problem-workspace-lang-tab">
                  <span className="problem-workspace-lang-dot" />
                  Kotlin
                </span>
              </div>
              <div className="problem-workspace-actions">
                <button
                  type="button"
                  className={canRunSamples ? 'problem-workspace-run-btn' : 'problem-workspace-placeholder-btn'}
                  disabled={!canRunSamples}
                  onClick={handleRunSamples}
                >
                  {runStatus === 'running' ? 'Running…' : '▶ Run Samples'}
                </button>
                <button
                  type="button"
                  className="problem-workspace-reset-btn"
                  onClick={handleResetDraft}
                  title="Reset this draft to the Kotlin starter code"
                >
                  ↺ Reset
                </button>
              </div>
            </div>

            <CodeMirror
              value={code}
              onChange={handleEditorChange}
              onUpdate={handleEditorUpdate}
              theme="none"
              extensions={ikEditorExtensions}
              placeholder={DEFAULT_KOTLIN_STARTER}
              basicSetup={editorBasicSetup}
              className="problem-workspace-editor-cm"
              aria-label="Kotlin code editor"
            />

            <div className="problem-workspace-editor-statusbar">
              <span>{hasEdited ? 'Saved' : 'No changes'}</span>
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            </div>
          </div>

          <div className="problem-workspace-panel problem-workspace-panel--results">
            <div className="problem-workspace-results-tabs">
              <span className="problem-workspace-results-tab problem-workspace-results-tab--active">
                Test Result
              </span>
            </div>
            <SampleResults
              runStatus={runStatus}
              runResults={runResults}
              runError={runError}
              hasSamples={statement?.samples?.length > 0}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default ProblemWorkspace;
