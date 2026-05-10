import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
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

  return (
    <div className="problem-workspace-page">
      <div className="problem-workspace-layout">
        <aside className="problem-workspace-panel problem-workspace-panel--info">
          <div className="problem-workspace-section-label">Codeforces Problem</div>
          <h1 className="problem-workspace-title">
            {problemDetails.name || `${contestId} ${index}`}
          </h1>
          <div className="problem-workspace-problem-id">
            {contestId} {index}
          </div>

          <div className="problem-workspace-meta">
            {problemDetails.rating && (
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

          <a
            href={problemLink}
            target="_blank"
            rel="noopener noreferrer"
            className="problem-workspace-link"
          >
            Open original Codeforces page ↗
          </a>
        </aside>

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
